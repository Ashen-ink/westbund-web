const crypto = require("crypto");
const fs = require("fs");
const http = require("http");
const os = require("os");
const path = require("path");
const { EventEmitter } = require("events");
const { Bonjour } = require("bonjour-service");
const { WebSocket, WebSocketServer } = require("ws");
const show = require("./show.cjs");

const PORT = 7733;
const SERVICE = "westbund";
const HEARTBEAT_MS = 5000;

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".map": "application/json",
};

const memoryStore = () => ({ load: () => null, save: () => {} });

function mdnsErrorHandler() {
  const reported = new Set();
  return (error) => {
    const key = error.code ?? error.message;
    if (reported.has(key)) return;
    reported.add(key);
    console.warn("mDNS unavailable; screens can still join by address:", error.message);
  };
}

function createBonjour(onError) {
  // The callback handles reply failures; multicast-dns socket errors use events.
  const bonjour = new Bonjour({}, onError);
  bonjour.server.mdns.on("error", onError);
  bonjour.server.mdns.on("warning", onError);
  return bonjour;
}

function addresses() {
  return Object.values(os.networkInterfaces())
    .flat()
    .filter((entry) => entry && entry.family === "IPv4" && !entry.internal)
    .map((entry) => entry.address);
}

function serveStatic(root, request, response) {
  if (!root || (request.method !== "GET" && request.method !== "HEAD")) {
    response.writeHead(404).end();
    return;
  }
  let pathname = decodeURIComponent(new URL(request.url, "http://hub").pathname);
  if (pathname.endsWith("/")) pathname += "index.html";
  let file = path.normalize(path.join(root, pathname));
  if (!file.startsWith(root)) {
    response.writeHead(403).end();
    return;
  }
  fs.stat(file, (error, stat) => {
    if (!error && stat.isDirectory()) file = path.join(file, "index.html");
    fs.readFile(file, (readError, data) => {
      if (readError) {
        response.writeHead(404, { "content-type": "text/plain" }).end("Not found");
        return;
      }
      response.writeHead(200, {
        "content-type": TYPES[path.extname(file)] ?? "application/octet-stream",
        "cache-control": "no-cache",
      });
      response.end(request.method === "HEAD" ? undefined : data);
    });
  });
}

async function createHub({ port = PORT, name = os.hostname(), id = crypto.randomUUID(), staticDir = null, store = memoryStore() } = {}) {
  const events = new EventEmitter();
  let state = show.sanitize(store.load());
  const clients = new Map();
  const root = staticDir && fs.existsSync(staticDir) ? path.resolve(staticDir) : null;
  const screenIds = () => [...clients].filter(([, client]) => !client.remote).map(([clientId]) => clientId);

  const roster = () =>
    [...clients].filter(([, client]) => !client.remote).map(([clientId, client]) => ({
      id: clientId,
      name: client.name,
      label: client.label,
      screen: state.assignments[clientId] ?? null,
    }));

  const broadcast = () => {
    const message = JSON.stringify({ t: "show", state, roster: roster() });
    for (const { socket } of clients.values()) if (socket.readyState === WebSocket.OPEN) socket.send(message);
    events.emit("change");
  };

  const apply = (command) => {
    const next = show.apply(state, command, screenIds());
    if (next === state) return false;
    state = next;
    store.save(state);
    return true;
  };

  const server = http.createServer((request, response) => {
    if (request.url === "/health") {
      response.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify({ hub: name, id }));
      return;
    }
    serveStatic(root, request, response);
  });
  const wss = new WebSocketServer({ server, path: "/ws" });
  wss.on("error", () => {});

  wss.on("connection", (socket) => {
    let clientId = null;
    socket.on("error", () => {});
    socket.on("pong", () => {
      if (clientId && clients.get(clientId)?.socket === socket) clients.get(clientId).alive = true;
    });
    socket.on("message", (raw) => {
      let message;
      try {
        message = JSON.parse(raw);
      } catch {
        return;
      }
      if (message.t === "hello" && typeof message.id === "string") {
        clientId = message.id;
        const previous = clients.get(clientId);
        const remote = message.role === "remote";
        clients.set(clientId, {
          socket,
          name: String(message.name ?? "Screen").slice(0, 80),
          label: String(message.label ?? "").slice(0, 80),
          remote,
          alive: true,
        });
        if (previous && previous.socket !== socket) previous.socket.terminate();
        if (!remote) apply({ type: "register", id: clientId, hint: message.hint });
        broadcast();
      } else if (message.t === "cmd" && clientId) {
        apply(message.cmd);
        broadcast();
      } else if (message.t === "ping") {
        if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ t: "pong", c0: message.c0, s: Date.now() }));
      }
    });
    socket.on("close", () => {
      if (clientId && clients.get(clientId)?.socket === socket) {
        clients.delete(clientId);
        broadcast();
      }
    });
  });

  const heartbeat = setInterval(() => {
    for (const client of clients.values()) {
      if (!client.alive) client.socket.terminate();
      else {
        client.alive = false;
        client.socket.ping();
      }
    }
  }, HEARTBEAT_MS);

  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "0.0.0.0", resolve);
  });
  const actualPort = server.address().port;

  let bonjour = null;
  let service = null;
  const onMdnsError = mdnsErrorHandler();
  const announce = () => {
    try {
      bonjour ??= createBonjour(onMdnsError);
      service = bonjour.publish({ name, type: SERVICE, port: actualPort, txt: { id } });
      service.on("error", onMdnsError);
    } catch (error) {
      onMdnsError(error);
    }
  };
  announce();

  return {
    id,
    get name() {
      return name;
    },
    port: actualPort,
    events,
    state: () => state,
    roster,
    addresses,
    serving: Boolean(root),
    command(command) {
      if (apply(command)) broadcast();
    },
    rename(next) {
      name = next;
      const previous = service;
      service = null;
      if (previous) previous.stop(announce);
      else announce();
    },
    async stop() {
      clearInterval(heartbeat);
      for (const { socket } of clients.values()) socket.terminate();
      clients.clear();
      const closed = (begin) =>
        Promise.race([new Promise((resolve) => begin(resolve)), new Promise((resolve) => setTimeout(resolve, 1000))]);
      await closed((done) => wss.close(() => done()));
      server.closeAllConnections?.();
      await closed((done) => server.close(() => done()));
      await closed((done) => (service ? service.stop(() => done()) : done()));
      bonjour?.destroy();
    },
  };
}

function discover(onChange, { ignoreId } = {}) {
  const onMdnsError = mdnsErrorHandler();
  let bonjour;
  let browser;
  try {
    bonjour = createBonjour(onMdnsError);
    browser = bonjour.find({ type: SERVICE });
    browser.on("error", onMdnsError);
  } catch (error) {
    onMdnsError(error);
    bonjour?.destroy();
    return () => {};
  }
  const found = new Map();
  const report = () => onChange([...found].map(([hubName, address]) => ({ name: hubName, address })));
  browser.on("up", (service) => {
    const address = service.addresses?.find((entry) => entry.includes("."));
    if (!address || service.txt?.id === ignoreId) return;
    found.set(service.name, address);
    report();
  });
  browser.on("down", (service) => {
    if (found.delete(service.name)) report();
  });
  return () => {
    browser.stop();
    bonjour.destroy();
  };
}

module.exports = { PORT, createHub, discover };

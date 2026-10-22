// One machine's place in the show: either the host (authoritative show state, serves the LAN)
// or a client (joins a host and mirrors its state). Same app either way; the role is a setting.
//
// Wire protocol, JSON over WebSocket:
//   client -> host   { t: "hello", keys }   { t: "cmd", cmd }   { t: "ping", c0 }
//   host -> client   { t: "state", state }  { t: "pong", c0, s }
// Only state changes travel. Motion is derived from the shared clock on each machine, so a
// machine that loses the host keeps playing; `offset` keeps their clocks aligned with the host's.

const { EventEmitter } = require("events");
const { Bonjour } = require("bonjour-service");
const { WebSocket, WebSocketServer } = require("ws");
const show = require("./show.cjs");

const PORT = 7733;
const SERVICE = "westbund";
const PING_MS = 2000;
const RETRY_MS = 1500;
const SAMPLES = 8;

class Node extends EventEmitter {
  constructor({ config, saveConfig, store }) {
    super();
    this.config = config;
    this.saveConfig = saveConfig;
    this.store = store;
    this.state = store.load() ?? show.initial();
    this.keys = []; // this machine's display keys
    this.offset = 0; // ms to add to the local clock to read the host's
    this.connected = false;
    this.peers = new Map(); // host side: socket -> display keys
    this.discovered = new Map(); // service name -> address
    this.samples = [];
    this.bonjour = new Bonjour();
    this.browser = this.bonjour.find({ type: SERVICE });
    this.browser.on("up", (service) => {
      const address = service.addresses?.find((a) => a.includes("."));
      if (!address || service.txt?.id === config.deviceId) return;
      this.discovered.set(service.name, address);
      this.#changed();
    });
    this.browser.on("down", (service) => {
      this.discovered.delete(service.name);
      this.#changed();
    });
  }

  start() {
    if (this.config.role === "host") this.#startHost();
    else this.#connect();
  }

  stop() {
    clearTimeout(this.retry);
    clearInterval(this.ping);
    this.socket?.removeAllListeners();
    this.socket?.close();
    this.socket = null;
    this.server?.close();
    this.server = null;
    this.service?.stop?.();
    this.service = null;
    this.peers.clear();
    this.connected = false;
  }

  destroy() {
    this.stop();
    this.browser.stop();
    this.bonjour.destroy();
  }

  /** `{ role: "host" }` or `{ role: "client", address? }`; saved, and survives restarts. */
  setRole({ role, address }) {
    if (role !== "host" && role !== "client") return;
    this.stop();
    this.config.role = role;
    this.config.hostAddress = role === "client" && address ? address : null;
    this.offset = 0;
    this.samples = [];
    this.saveConfig(this.config);
    this.start();
    this.#changed();
  }

  /** The keys of this machine's displays; the host gives new ones a screen. */
  registerDisplays(keys) {
    this.keys = keys;
    if (this.config.role === "host") this.#apply({ type: "register", keys });
    else this.#send({ t: "hello", keys });
  }

  /** From a local input or, later, the control page. The host applies it; a client forwards it. */
  command(cmd) {
    if (this.config.role === "host") this.#apply(cmd);
    else this.#send({ t: "cmd", cmd });
  }

  status() {
    return {
      role: this.config.role,
      name: this.config.name,
      host: this.config.role === "client" ? (this.hostAddress() ?? null) : null,
      connected: this.config.role === "host" ? Boolean(this.server) : this.connected,
      peers: this.peers.size,
      discovered: [...this.discovered].map(([name, address]) => ({ name, address })),
    };
  }

  hostAddress() {
    return this.config.hostAddress ?? this.discovered.values().next().value;
  }

  #changed() {
    this.emit("status", this.status());
  }

  #send(message) {
    if (this.socket?.readyState === WebSocket.OPEN) this.socket.send(JSON.stringify(message));
  }

  // ---- host

  #startHost() {
    const server = new WebSocketServer({ port: PORT });
    this.server = server;
    server.on("error", (error) => {
      console.error("Host could not listen:", error);
      if (this.server === server) this.server = null;
      this.#changed();
    });
    server.on("connection", (socket) => {
      socket.on("error", () => {});
      socket.on("message", (raw) => {
        let message;
        try {
          message = JSON.parse(raw);
        } catch {
          return;
        }
        if (message.t === "hello") {
          this.peers.set(socket, Array.isArray(message.keys) ? message.keys : []);
          socket.send(JSON.stringify({ t: "state", state: this.state }));
          this.#apply({ type: "register", keys: this.peers.get(socket) });
          this.#changed();
        } else if (message.t === "cmd") this.#apply(message.cmd);
        else if (message.t === "ping") socket.send(JSON.stringify({ t: "pong", c0: message.c0, s: Date.now() }));
      });
      socket.on("close", () => {
        this.peers.delete(socket);
        this.#changed();
      });
    });
    this.service = this.bonjour.publish({
      name: this.config.name,
      type: SERVICE,
      port: PORT,
      txt: { id: this.config.deviceId },
    });
    this.#apply({ type: "register", keys: this.keys });
    this.#changed();
  }

  #apply(cmd) {
    const live = [...this.keys, ...[...this.peers.values()].flat()];
    const next = show.apply(this.state, cmd, live);
    if (next === this.state) return;
    this.state = next;
    this.store.save(next);
    const message = JSON.stringify({ t: "state", state: next });
    for (const socket of this.peers.keys()) if (socket.readyState === WebSocket.OPEN) socket.send(message);
    this.emit("state", next);
  }

  // ---- client

  #connect() {
    if (this.config.role !== "client") return;
    const address = this.hostAddress();
    if (!address) {
      this.retry = setTimeout(() => this.#connect(), RETRY_MS);
      return;
    }
    const socket = new WebSocket(`ws://${address}:${PORT}`);
    this.socket = socket;
    socket.on("open", () => {
      this.connected = true;
      this.samples = [];
      this.#send({ t: "hello", keys: this.keys });
      const ping = () => this.#send({ t: "ping", c0: Date.now() });
      ping();
      this.ping = setInterval(ping, PING_MS);
      this.#changed();
    });
    socket.on("message", (raw) => {
      let message;
      try {
        message = JSON.parse(raw);
      } catch {
        return;
      }
      if (message.t === "state") {
        this.state = message.state;
        this.store.save(message.state);
        this.emit("state", this.state);
      } else if (message.t === "pong") this.#sample(message);
    });
    const lost = () => {
      if (this.socket !== socket) return;
      this.socket = null;
      this.connected = false;
      clearInterval(this.ping);
      this.#changed();
      this.retry = setTimeout(() => this.#connect(), RETRY_MS);
    };
    socket.on("close", lost);
    socket.on("error", () => {});
  }

  /** NTP-style: trust the sample with the shortest round trip, where the delay is most symmetric. */
  #sample({ c0, s }) {
    const now = Date.now();
    const rtt = now - c0;
    this.samples.push({ rtt, offset: s + rtt / 2 - now });
    if (this.samples.length > SAMPLES) this.samples.shift();
    this.offset = this.samples.reduce((best, sample) => (sample.rtt < best.rtt ? sample : best)).offset;
    this.emit("clock", this.offset);
  }
}

module.exports = { Node };

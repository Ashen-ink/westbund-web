const assert = require("node:assert/strict");
const dgram = require("node:dgram");
const { EventEmitter, once } = require("node:events");
const { setTimeout: delay } = require("node:timers/promises");
const { test } = require("node:test");
const packet = require("dns-packet");
const { WebSocket } = require("ws");
const { createHub, discover } = require("./hub.cjs");

const networkError = (code) => Object.assign(new Error(`send ${code} 224.0.0.251:5353`), { code });

function mockMulticast(t, { bindError, sendError } = {}) {
  const sockets = [];
  t.mock.method(dgram, "createSocket", () => {
    const socket = new EventEmitter();
    socket.sent = [];
    socket.bind = (_port, _address, callback) => process.nextTick(() => {
      if (bindError) socket.emit("error", bindError);
      else {
        socket.emit("listening");
        callback();
      }
    });
    socket.send = (buffer, _offset, _length, _port, _address, callback) => {
      socket.sent.push(packet.decode(buffer));
      process.nextTick(() => callback(sendError));
    };
    socket.close = (callback) => process.nextTick(() => callback?.());
    for (const method of ["addMembership", "dropMembership", "setMulticastTTL", "setMulticastLoopback", "setMulticastInterface"]) {
      socket[method] = () => {};
    }
    sockets.push(socket);
    return socket;
  });
  return sockets;
}

async function assertDirectConnection(hub, t) {
  const response = await fetch(`http://127.0.0.1:${hub.port}/health`);
  assert.equal(response.status, 200);
  assert.equal((await response.json()).id, hub.id);

  const client = new WebSocket(`ws://127.0.0.1:${hub.port}/ws`);
  t.after(() => client.terminate());
  await once(client, "open");
  const greeting = once(client, "message");
  client.send(JSON.stringify({ t: "hello", id: "test-screen", hint: 1 }));
  const [raw] = await greeting;
  assert.equal(JSON.parse(raw).state.assignments["test-screen"], 1);
  const update = once(client, "message");
  client.send(JSON.stringify({ t: "cmd", cmd: { type: "scene", scene: 2 } }));
  const [changed] = await update;
  assert.equal(JSON.parse(changed).state.scene, 2);
}

test("mDNS reply and socket errors preserve HTTP and WebSocket control", { timeout: 5000 }, async (t) => {
  const warning = t.mock.method(console, "warn", () => {});
  const sockets = mockMulticast(t, { sendError: networkError("EADDRNOTAVAIL") });
  const stopDiscovery = discover(() => {});
  t.after(stopDiscovery);
  const hub = await createHub({ port: 0 });
  t.after(() => hub.stop());

  // Wait for the real Bonjour registry to publish, then ask it to reply.
  const publisher = sockets[1];
  for (let i = 0; i < 100 && !publisher.sent.some((message) => message.type === "response"); i++) await delay(20);
  assert.ok(publisher.sent.some((message) => message.type === "response"));
  const query = packet.encode({ type: "query", questions: [{ name: "_westbund._tcp.local", type: "PTR" }] });
  publisher.emit("message", query, { address: "192.0.2.1", port: 5353 });
  publisher.emit("message", query, { address: "192.0.2.1", port: 5353 });
  await delay(0);
  assert.equal(warning.mock.callCount(), 1, "repeated send errors should be logged once");
  assert.match(warning.mock.calls[0].arguments[1], /EADDRNOTAVAIL/);

  for (const socket of sockets) {
    socket.emit("error", networkError("EACCES"));
    socket.emit("error", networkError("EADDRNOTAVAIL"));
  }
  await assertDirectConnection(hub, t);
  hub.rename("Renamed host");
  assert.equal(hub.name, "Renamed host");
});

test("mDNS bind failure preserves direct connections and shutdown", { timeout: 5000 }, async (t) => {
  t.mock.method(console, "warn", () => {});
  mockMulticast(t, { bindError: networkError("EACCES") });
  const stopDiscovery = discover(() => {});
  t.after(stopDiscovery);
  const hub = await createHub({ port: 0 });
  t.after(() => hub.stop());
  await assertDirectConnection(hub, t);
});

test("mDNS initialization failure preserves direct connections and shutdown", { timeout: 5000 }, async (t) => {
  t.mock.method(console, "warn", () => {});
  t.mock.method(dgram, "createSocket", () => { throw networkError("EADDRNOTAVAIL"); });
  const stopDiscovery = discover(() => {});
  t.after(stopDiscovery);
  const hub = await createHub({ port: 0 });
  t.after(() => hub.stop());
  await assertDirectConnection(hub, t);
});

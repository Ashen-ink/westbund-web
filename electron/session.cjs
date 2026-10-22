const { EventEmitter } = require("events");
const { PORT, createHub, discover } = require("../hub/hub.cjs");

class Session extends EventEmitter {
  constructor({ config, saveConfig, store, outDir }) {
    super();
    this.config = config;
    this.saveConfig = saveConfig;
    this.store = store;
    this.outDir = outDir;
    this.hub = null;
    this.hubError = null;
    this.discovered = [];
    this.stopDiscovery = discover(
      (hosts) => {
        this.discovered = hosts;
        this.emit("change");
      },
      { ignoreId: config.deviceId },
    );
  }

  async start() {
    if (this.config.role === "host") await this.#startHub();
  }

  async stop() {
    this.stopDiscovery();
    await this.#stopHub();
  }

  async setRole({ role, address }) {
    if (role !== "host" && role !== "client") return;
    await this.#stopHub();
    this.config.role = role;
    this.config.hostAddress = role === "client" && address ? String(address).trim() : null;
    this.saveConfig(this.config);
    if (role === "host") await this.#startHub();
    this.emit("change");
  }

  setName(name) {
    const clean = String(name ?? "").trim().slice(0, 60);
    if (!clean || clean === this.config.name) return;
    this.config.name = clean;
    this.saveConfig(this.config);
    this.hub?.rename(clean);
    this.emit("change");
  }

  info() {
    const client = this.config.role === "client";
    const address = client ? (this.config.hostAddress ?? this.discovered[0]?.address ?? null) : null;
    return {
      role: this.config.role,
      name: this.config.name,
      hubUrl: client
        ? address && `ws://${address.includes(":") ? address : `${address}:${PORT}`}/ws`
        : this.hub && `ws://127.0.0.1:${this.hub.port}/ws`,
      hosting: this.hub && { port: this.hub.port, addresses: this.hub.addresses(), serving: this.hub.serving },
      hubError: this.hubError,
      discovered: this.discovered,
    };
  }

  async #startHub() {
    this.hubError = null;
    try {
      this.hub = await createHub({
        name: this.config.name,
        id: this.config.deviceId,
        staticDir: this.outDir,
        store: this.store,
      });
    } catch (error) {
      this.hub = null;
      this.hubError =
        error.code === "EADDRINUSE" ? `Port ${PORT} is already in use: another host may be running here.` : `Could not start the host: ${error.message}`;
    }
  }

  async #stopHub() {
    const hub = this.hub;
    this.hub = null;
    await hub?.stop();
  }
}

module.exports = { Session };

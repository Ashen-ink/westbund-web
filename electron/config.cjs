const { app } = require("electron");
const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");

const file = (name) => path.join(app.getPath("userData"), name);

function readJson(name) {
  try {
    return JSON.parse(fs.readFileSync(file(name), "utf8"));
  } catch {
    return null;
  }
}

function writeJson(name, value) {
  try {
    fs.mkdirSync(app.getPath("userData"), { recursive: true });
    fs.writeFileSync(file(name), JSON.stringify(value, null, 2));
  } catch (error) {
    console.error(`Could not save ${name}:`, error);
  }
}

/** This machine's identity and role: { deviceId, name, role: "host" | "client", hostAddress }. */
function loadConfig() {
  const config = {
    deviceId: crypto.randomUUID(),
    name: os.hostname(),
    role: "host", // a lone machine works out of the box
    hostAddress: null, // null: join whichever host is discovered
    ...readJson("config.json"),
  };
  writeJson("config.json", config);
  return config;
}

const saveConfig = (config) => writeJson("config.json", config);

/** The last known show state, so a restart (or a lost host) keeps the wall as it was. */
const showStore = { load: () => readJson("show.json"), save: (state) => writeJson("show.json", state) };

module.exports = { loadConfig, saveConfig, showStore };

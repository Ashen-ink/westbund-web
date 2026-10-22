const { BrowserWindow, ipcMain, screen } = require("electron");
const path = require("path");
const { SCREEN_COUNT } = require("./show.cjs");

const DEBUG = true; // shows the debug badge (screen number, network role) in every window

// display id -> { win, display }
const windows = new Map();

/**
 * One fullscreen window per local display (at most SCREEN_COUNT). Which screen of the wall a
 * window shows, and the mode, come from the show state held by `node`.
 */
function start({ url, node, deviceId }) {
  const keyOf = (display) => `${deviceId}:${display.id}`;

  function stateOf({ display }) {
    const { width, height } = display.bounds;
    return {
      screen: node.state.assignments[keyOf(display)] ?? null,
      screens: SCREEN_COUNT,
      mode: node.state.mode,
      debug: DEBUG,
      display: `${width}×${height}`,
      network: node.status(),
      clockOffset: node.offset,
    };
  }

  const push = (entry) => {
    if (!entry.win.isDestroyed()) entry.win.webContents.send("westbund:state", stateOf(entry));
  };
  const pushAll = () => windows.forEach(push);

  function create(display) {
    const win = new BrowserWindow({
      x: display.bounds.x,
      y: display.bounds.y,
      width: display.bounds.width,
      height: display.bounds.height,
      show: false,
      frame: false,
      autoHideMenuBar: true,
      backgroundColor: "#ffffff",
      webPreferences: {
        preload: path.join(__dirname, "preload.cjs"),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        backgroundThrottling: false,
      },
    });
    const entry = { win, display };
    windows.set(display.id, entry);

    win.once("ready-to-show", () => {
      win.show();
      // macOS: simple fullscreen stays on this display without creating a new Space.
      if (process.platform === "darwin") win.setSimpleFullScreen(true);
      else win.setFullScreen(true);
    });
    win.on("closed", () => {
      if (windows.get(display.id) === entry) windows.delete(display.id);
    });
    // An unattended exhibit should recover from a renderer crash on its own.
    win.webContents.on("render-process-gone", () => win.reload());
    // Left/right arrows switch this display's screen, M toggles overview.
    win.webContents.on("before-input-event", (event, input) => {
      if (input.type !== "keyDown") return;
      if (input.key.toLowerCase() === "m") {
        event.preventDefault();
        node.command({ type: "toggle-mode" });
        return;
      }
      const delta = input.key === "ArrowRight" ? 1 : input.key === "ArrowLeft" ? -1 : 0;
      if (!delta) return;
      event.preventDefault();
      node.command({ type: "step", key: keyOf(display), delta });
    });
    win.loadURL(url);
  }

  /** One window per connected display; screens go left to right by display position. */
  function sync() {
    const displays = screen
      .getAllDisplays()
      .sort((a, b) => a.bounds.x - b.bounds.x || a.bounds.y - b.bounds.y)
      .slice(0, SCREEN_COUNT);
    const present = new Set(displays.map((display) => display.id));

    for (const [id, entry] of [...windows]) {
      if (!present.has(id)) {
        windows.delete(id);
        entry.win.destroy();
      }
    }
    for (const display of displays) {
      const entry = windows.get(display.id);
      const b = entry?.display.bounds;
      const moved = entry && (b.x !== display.bounds.x || b.y !== display.bounds.y || b.width !== display.bounds.width || b.height !== display.bounds.height);
      if (entry && !moved) continue;
      if (entry) {
        windows.delete(display.id);
        entry.win.destroy();
      }
      create(display);
    }
    node.registerDisplays(displays.map(keyOf));
    pushAll();
  }

  ipcMain.handle("westbund:get-state", (event) => {
    const entry = [...windows.values()].find((candidate) => candidate.win.webContents === event.sender);
    return entry ? stateOf(entry) : null;
  });
  node.on("state", pushAll);
  node.on("status", pushAll);
  node.on("clock", pushAll);

  let timer;
  const resync = () => {
    clearTimeout(timer);
    timer = setTimeout(sync, 250);
  };
  screen.on("display-added", resync);
  screen.on("display-removed", resync);
  screen.on("display-metrics-changed", resync);
  sync();
}

module.exports = { start };

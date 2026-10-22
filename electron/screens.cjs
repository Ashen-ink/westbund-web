const { BrowserWindow, ipcMain, screen } = require("electron");
const path = require("path");
const { SCREEN_COUNT } = require("../hub/show.cjs");

const windows = new Map();

function start({ url, session, deviceId }) {
  const infoOf = ({ display, hint }) => {
    const { width, height } = display.bounds;
    return { ...session.info(), displayKey: `${deviceId}:${display.id}`, label: `${width}×${height}`, hint };
  };
  const push = (entry) => {
    if (!entry.win.isDestroyed()) entry.win.webContents.send("westbund:info", infoOf(entry));
  };

  function create(display, hint) {
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
    const entry = { win, display, hint };
    windows.set(display.id, entry);

    win.once("ready-to-show", () => {
      win.show();
      if (process.platform === "darwin") win.setSimpleFullScreen(true);
      else win.setFullScreen(true);
    });
    win.on("closed", () => {
      if (windows.get(display.id) === entry) windows.delete(display.id);
    });
    win.webContents.on("render-process-gone", () => win.reload());
    const load = () => win.loadURL(url).catch(() => {});
    win.webContents.on("did-fail-load", (_event, code, _description, _url, isMainFrame) => {
      if (isMainFrame && code !== -3 && !win.isDestroyed()) setTimeout(() => !win.isDestroyed() && load(), 1000);
    });
    load();
  }

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
    displays.forEach((display, index) => {
      const entry = windows.get(display.id);
      const b = entry?.display.bounds;
      const moved = entry && (b.x !== display.bounds.x || b.y !== display.bounds.y || b.width !== display.bounds.width || b.height !== display.bounds.height);
      if (entry && !moved) {
        entry.hint = index + 1;
        return;
      }
      if (entry) {
        windows.delete(display.id);
        entry.win.destroy();
      }
      create(display, index + 1);
    });
  }

  ipcMain.handle("westbund:info", (event) => {
    const entry = [...windows.values()].find((candidate) => candidate.win.webContents === event.sender);
    return entry ? infoOf(entry) : null;
  });
  session.on("change", () => windows.forEach(push));

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

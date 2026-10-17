const { BrowserWindow, ipcMain, screen } = require("electron");
const path = require("path");

const SCREEN_COUNT = 3;
const DEBUG = true; // shows the screen badge in every window

const wrap = (n) => ((((n - 1) % SCREEN_COUNT) + SCREEN_COUNT) % SCREEN_COUNT) + 1;

// display id -> { win, display, screen }
const windows = new Map();
let mode = "screen"; // "screen" | "overview", shared by every window
let url;

function stateOf({ display, screen: number }) {
  const { width, height } = display.bounds;
  return { screen: number, screens: SCREEN_COUNT, mode, debug: DEBUG, display: `${width}×${height} #${display.id}` };
}

function push(entry) {
  if (!entry.win.isDestroyed()) entry.win.webContents.send("westbund:state", stateOf(entry));
}

function create(display, number) {
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
  const entry = { win, display, screen: number };
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
  // Left/right arrows switch this display's screen, M toggles overview. A backend will call assign()/setMode() instead.
  win.webContents.on("before-input-event", (event, input) => {
    if (input.type !== "keyDown") return;
    if (input.key.toLowerCase() === "m") {
      event.preventDefault();
      setMode(mode === "screen" ? "overview" : "screen");
      return;
    }
    const step = input.key === "ArrowRight" ? 1 : input.key === "ArrowLeft" ? -1 : 0;
    if (!step) return;
    event.preventDefault();
    assign(display.id, entry.screen + step);
  });
  win.loadURL(url);
}

/** "screen": each window fills with its screen. "overview": each window shows the whole wall. */
function setMode(next) {
  mode = next;
  windows.forEach(push);
}

/** Show `number` (1-based, wraps) on the display with this id. */
function assign(displayId, number) {
  const entry = windows.get(displayId);
  if (!entry) return;
  entry.screen = wrap(number);
  push(entry);
}

/** One window per connected display; new displays take the next screen by left-to-right position. */
function sync() {
  const displays = screen
    .getAllDisplays()
    .sort((a, b) => a.bounds.x - b.bounds.x || a.bounds.y - b.bounds.y);
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
    if (entry && !moved) return;
    const number = entry ? entry.screen : wrap(index + 1);
    if (entry) {
      windows.delete(display.id);
      entry.win.destroy();
    }
    create(display, number);
  });
}

function start(appUrl) {
  url = appUrl;
  ipcMain.handle("westbund:get-state", (event) => {
    const entry = [...windows.values()].find((candidate) => candidate.win.webContents === event.sender);
    return entry ? stateOf(entry) : null;
  });
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

module.exports = { start, assign, setMode };

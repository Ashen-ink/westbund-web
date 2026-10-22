const { app, ipcMain, protocol, net, powerSaveBlocker, globalShortcut } = require("electron");
const path = require("path");
const { pathToFileURL } = require("url");
const { loadConfig, saveConfig, showStore } = require("./config.cjs");
const { Session } = require("./session.cjs");
const screens = require("./screens.cjs");

const OUT = path.join(__dirname, "..", "out");
const DEV_URL = process.env.ELECTRON_START_URL;

protocol.registerSchemesAsPrivileged([
  { scheme: "app", privileges: { standard: true, secure: true, supportFetchAPI: true } },
]);

if (!app.requestSingleInstanceLock()) app.quit();

app.whenReady().then(async () => {
  protocol.handle("app", (request) => {
    let pathname = decodeURIComponent(new URL(request.url).pathname);
    if (pathname.endsWith("/")) pathname += "index.html";
    const file = path.normalize(path.join(OUT, pathname));
    if (!file.startsWith(OUT)) return new Response("Forbidden", { status: 403 });
    return net.fetch(pathToFileURL(file).toString());
  });
  powerSaveBlocker.start("prevent-display-sleep");
  globalShortcut.register("CommandOrControl+Shift+Q", () => app.quit());

  const config = loadConfig();
  const session = new Session({ config, saveConfig, store: showStore, outDir: OUT });
  ipcMain.handle("westbund:set-role", (_event, choice) => session.setRole(choice));
  ipcMain.handle("westbund:set-name", (_event, name) => session.setName(name));
  app.on("before-quit", () => void session.stop());

  await session.start();
  screens.start({ url: DEV_URL ?? "app://exhibit/", session, deviceId: config.deviceId });
});

app.on("window-all-closed", () => app.quit());
app.on("will-quit", () => globalShortcut.unregisterAll());

const { app, protocol, net, powerSaveBlocker, globalShortcut } = require("electron");
const path = require("path");
const { pathToFileURL } = require("url");
const screens = require("./screens.cjs");

const OUT = path.join(__dirname, "..", "out");
const DEV_URL = process.env.ELECTRON_START_URL;

// Serve the static export over app:// so canvas reads of local images are not tainted (as file:// would be).
protocol.registerSchemesAsPrivileged([
  { scheme: "app", privileges: { standard: true, secure: true, supportFetchAPI: true } },
]);

if (!app.requestSingleInstanceLock()) app.quit();

app.whenReady().then(() => {
  protocol.handle("app", (request) => {
    let pathname = decodeURIComponent(new URL(request.url).pathname);
    if (pathname.endsWith("/")) pathname += "index.html";
    const file = path.normalize(path.join(OUT, pathname));
    if (!file.startsWith(OUT)) return new Response("Forbidden", { status: 403 });
    return net.fetch(pathToFileURL(file).toString());
  });
  powerSaveBlocker.start("prevent-display-sleep");
  globalShortcut.register("CommandOrControl+Shift+Q", () => app.quit());
  screens.start(DEV_URL ?? "app://exhibit/");
});

app.on("window-all-closed", () => app.quit());
app.on("will-quit", () => globalShortcut.unregisterAll());

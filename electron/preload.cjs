const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("westbund", {
  getInfo: () => ipcRenderer.invoke("westbund:info"),
  onInfo: (callback) => {
    const listener = (_event, info) => callback(info);
    ipcRenderer.on("westbund:info", listener);
    return () => ipcRenderer.removeListener("westbund:info", listener);
  },
  setRole: (choice) => ipcRenderer.invoke("westbund:set-role", choice),
  setName: (name) => ipcRenderer.invoke("westbund:set-name", name),
});

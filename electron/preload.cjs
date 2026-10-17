const { contextBridge, ipcRenderer } = require("electron");

// The host decides which screen of the wall this window shows (see screens.cjs).
contextBridge.exposeInMainWorld("westbund", {
  getState: () => ipcRenderer.invoke("westbund:get-state"),
  onState: (callback) => {
    const listener = (_event, state) => callback(state);
    ipcRenderer.on("westbund:state", listener);
    return () => ipcRenderer.removeListener("westbund:state", listener);
  },
});

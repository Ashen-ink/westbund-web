const { contextBridge, ipcRenderer } = require("electron");

// The host app decides which screen of the wall this window shows and keeps it in step
// with the other machines (see node.cjs and screens.cjs).
contextBridge.exposeInMainWorld("westbund", {
  getState: () => ipcRenderer.invoke("westbund:get-state"),
  onState: (callback) => {
    const listener = (_event, state) => callback(state);
    ipcRenderer.on("westbund:state", listener);
    return () => ipcRenderer.removeListener("westbund:state", listener);
  },
  command: (cmd) => ipcRenderer.invoke("westbund:command", cmd),
  setRole: (role) => ipcRenderer.invoke("westbund:set-role", role),
});

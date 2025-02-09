const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  openRomDialog: () => ipcRenderer.invoke("dialog:open-rom"),
  readRomFile: (filePath) => ipcRenderer.invoke("fs:read-rom", filePath),
  setWindowFullscreen: (nextState) =>
    ipcRenderer.invoke("window:set-fullscreen", nextState),
  onWindowFullscreenChanged: (callback) => {
    const listener = (_event, isFullscreen) => callback(isFullscreen);
    ipcRenderer.on("window:fullscreen-changed", listener);

    return () => {
      ipcRenderer.removeListener("window:fullscreen-changed", listener);
    };
  },
});

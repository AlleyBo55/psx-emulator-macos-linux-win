const path = require("node:path");
const fs = require("node:fs/promises");
const { app, BrowserWindow, dialog, ipcMain } = require("electron");

const isDevelopment = Boolean(process.env.ELECTRON_START_URL);

function bufferToArrayBuffer(buffer) {
  return buffer.buffer.slice(
    buffer.byteOffset,
    buffer.byteOffset + buffer.byteLength,
  );
}

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1540,
    height: 980,
    minWidth: 1240,
    minHeight: 820,
    backgroundColor: "#f4f6f9",
    title: "AetherStation",
    titleBarStyle: "hiddenInset",
    trafficLightPosition: { x: 16, y: 18 },
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  mainWindow.on("enter-full-screen", () => {
    mainWindow.webContents.send("window:fullscreen-changed", true);
  });

  mainWindow.on("leave-full-screen", () => {
    mainWindow.webContents.send("window:fullscreen-changed", false);
  });

  if (isDevelopment) {
    mainWindow.loadURL(process.env.ELECTRON_START_URL);
    mainWindow.webContents.openDevTools({ mode: "detach" });
    return;
  }

  mainWindow.loadFile(path.join(app.getAppPath(), "out", "index.html"));
}

async function readRomDescriptor(filePath) {
  try {
    const bytes = await fs.readFile(filePath);

    return {
      name: path.basename(filePath),
      path: filePath,
      data: bufferToArrayBuffer(bytes),
    };
  } catch {
    return null;
  }
}

ipcMain.handle("dialog:open-rom", async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    title: "Open PlayStation disc image",
    properties: ["openFile"],
    filters: [
      {
        name: "PS1 disc images",
        extensions: ["bin", "img", "iso", "mdf"],
      },
    ],
  });

  if (canceled || filePaths.length === 0) {
    return null;
  }

  return readRomDescriptor(filePaths[0]);
});

ipcMain.handle("fs:read-rom", async (_event, filePath) => {
  if (typeof filePath !== "string" || filePath.length === 0) {
    return null;
  }

  return readRomDescriptor(filePath);
});

ipcMain.handle("window:set-fullscreen", (event, nextState) => {
  const window = BrowserWindow.fromWebContents(event.sender);

  if (!window) {
    return false;
  }

  window.setFullScreen(Boolean(nextState));
  return window.isFullScreen();
});

app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

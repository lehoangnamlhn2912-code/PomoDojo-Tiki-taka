var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// electron/main.js
var import_electron = require("electron");
var import_path = __toESM(require("path"), 1);
var mainWindow = null;
function createWindow() {
  mainWindow = new import_electron.BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: "Eye Care & Focus AI",
    backgroundColor: "#0f172a",
    autoHideMenuBar: true,
    webPreferences: {
      preload: import_path.default.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });
  const devServerUrl = process.env.VITE_DEV_SERVER_URL || "http://localhost:3000";
  const isDev = process.env.NODE_ENV === "development" || !!process.env.VITE_DEV_SERVER_URL;
  if (isDev) {
    mainWindow.loadURL(devServerUrl).catch((err) => {
      console.error("Failed to load dev server URL in Electron:", err);
    });
  } else {
    mainWindow.loadFile(import_path.default.join(__dirname, "../dist/index.html"));
  }
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}
import_electron.ipcMain.handle("app:get-system-info", () => {
  return {
    platform: process.platform,
    arch: process.arch,
    version: import_electron.app.getVersion(),
    electronVersion: process.versions.electron,
    chromeVersion: process.versions.chrome,
    nodeVersion: process.versions.node
  };
});
import_electron.ipcMain.handle("app:minimize", () => {
  if (mainWindow) mainWindow.minimize();
});
import_electron.ipcMain.handle("app:maximize", () => {
  if (mainWindow) {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  }
});
import_electron.ipcMain.handle("app:close", () => {
  if (mainWindow) mainWindow.close();
});
import_electron.ipcMain.handle("app:is-maximized", () => {
  return mainWindow ? mainWindow.isMaximized() : false;
});
import_electron.ipcMain.handle("app:show-notification", (_event, payload) => {
  if (import_electron.Notification.isSupported()) {
    const title = typeof payload === "string" ? payload : payload?.title || "Notification";
    const body = typeof payload === "object" ? payload?.body || "" : "";
    new import_electron.Notification({ title, body }).show();
    return true;
  }
  return false;
});
import_electron.app.whenReady().then(() => {
  createWindow();
  import_electron.app.on("activate", () => {
    if (import_electron.BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});
import_electron.app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    import_electron.app.quit();
  }
});

// electron/preload.js
var import_electron = require("electron");
import_electron.contextBridge.exposeInMainWorld("electronAPI", {
  getSystemInfo: () => import_electron.ipcRenderer.invoke("app:get-system-info"),
  minimize: () => import_electron.ipcRenderer.invoke("app:minimize"),
  maximize: () => import_electron.ipcRenderer.invoke("app:maximize"),
  close: () => import_electron.ipcRenderer.invoke("app:close"),
  isMaximized: () => import_electron.ipcRenderer.invoke("app:is-maximized"),
  showNotification: (payload) => import_electron.ipcRenderer.invoke("app:show-notification", payload)
});

// electron/preload.js
var import_electron = require("electron");
import_electron.contextBridge.exposeInMainWorld("electronAPI", {
  app: {
    getName: () => import_electron.ipcRenderer.invoke("app:get-name"),
    getVersion: () => import_electron.ipcRenderer.invoke("app:get-version")
  },
  shell: {
    openExternal: (url) => import_electron.ipcRenderer.invoke("shell:open-external", url)
  },
  platform: process.platform,
  isDesktop: true
});

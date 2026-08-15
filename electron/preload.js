import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  app: {
    getName: () => ipcRenderer.invoke('app:get-name'),
    getVersion: () => ipcRenderer.invoke('app:get-version')
  },
  shell: {
    openExternal: (url) => ipcRenderer.invoke('shell:open-external', url)
  },
  platform: process.platform,
  isDesktop: true
})
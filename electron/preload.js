import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  app: {
    getName: () => ipcRenderer.invoke('app:get-name'),
    getVersion: () => ipcRenderer.invoke('app:get-version')
  },

  shell: {
    openExternal: (url) =>
      ipcRenderer.invoke('shell:open-external', url)
  },

  screen: {
    setDim: (enabled) => {
      console.log(
        '[Preload] screen.setDim:',
        enabled
      )

      ipcRenderer.send(
        'screen-dim',
        Boolean(enabled)
      )
    }
  },

  platform: process.platform,
  isDesktop: true
})
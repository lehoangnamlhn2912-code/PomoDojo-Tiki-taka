// electron/preload.js

const {
  contextBridge,
  ipcRenderer
} = require('electron');

contextBridge.exposeInMainWorld(
  'electronAPI',
  {
    setScreenDimming: (payload) =>
      ipcRenderer.send(
        'set-screen-dimming',
        payload
      ),

    triggerAlarm: (payload) =>
      ipcRenderer.send(
        'trigger-alarm',
        payload
      ),

    getSystemStatus: () =>
      ipcRenderer.invoke(
        'get-system-status'
      )
  }
);
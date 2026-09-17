import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  getSystemInfo: () => ipcRenderer.invoke('app:get-system-info'),
  minimize: () => ipcRenderer.invoke('app:minimize'),
  maximize: () => ipcRenderer.invoke('app:maximize'),
  close: () => ipcRenderer.invoke('app:close'),
  isMaximized: () => ipcRenderer.invoke('app:is-maximized'),
  showNotification: (payload) => ipcRenderer.invoke('app:show-notification', payload)
});

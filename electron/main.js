import { app, BrowserWindow, ipcMain, Notification } from 'electron';
import path from 'path';

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: 'Eye Care & Focus AI',
    backgroundColor: '#0f172a',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  const devServerUrl = process.env.VITE_DEV_SERVER_URL || 'http://localhost:3000';
  const isDev = process.env.NODE_ENV === 'development' || !!process.env.VITE_DEV_SERVER_URL;

  if (isDev) {
    mainWindow.loadURL(devServerUrl).catch((err) => {
      console.error('Failed to load dev server URL in Electron:', err);
    });
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// System & Window IPC Handlers
ipcMain.handle('app:get-system-info', () => {
  return {
    platform: process.platform,
    arch: process.arch,
    version: app.getVersion(),
    electronVersion: process.versions.electron,
    chromeVersion: process.versions.chrome,
    nodeVersion: process.versions.node
  };
});

ipcMain.handle('app:minimize', () => {
  if (mainWindow) mainWindow.minimize();
});

ipcMain.handle('app:maximize', () => {
  if (mainWindow) {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  }
});

ipcMain.handle('app:close', () => {
  if (mainWindow) mainWindow.close();
});

ipcMain.handle('app:is-maximized', () => {
  return mainWindow ? mainWindow.isMaximized() : false;
});

ipcMain.handle('app:show-notification', (_event, payload) => {
  if (Notification.isSupported()) {
    const title = typeof payload === 'string' ? payload : (payload?.title || 'Notification');
    const body = typeof payload === 'object' ? (payload?.body || '') : '';
    new Notification({ title, body }).show();
    return true;
  }
  return false;
});

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

import { app, BrowserWindow, ipcMain, shell } from 'electron'
import path from 'node:path'

const isDev = !!process.env.VITE_DEV_SERVER_URL
const devServerUrl = process.env.VITE_DEV_SERVER_URL

let mainWindow = null

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1100,
    minHeight: 720,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#0f172a',
    title: 'Eye Care Focus AI',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
  })

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  mainWindow.webContents.on('did-fail-load', (_, code, desc, url) => {
    console.error('did-fail-load', code, desc, url)
  })

  if (isDev && devServerUrl) {
    mainWindow.loadURL(devServerUrl)
    mainWindow.webContents.openDevTools({ mode: 'detach' })
  } else {
    mainWindow.loadFile(path.join(app.getAppPath(), 'dist', 'index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

function registerIpcHandlers() {
  ipcMain.handle('app:get-version', () => app.getVersion())
  ipcMain.handle('app:get-name', () => app.getName())
  ipcMain.handle('shell:open-external', async (_, url) => {
    if (!url || typeof url !== 'string') return false
    await shell.openExternal(url)
    return true
  })
}

process.on('uncaughtException', (err) => {
  console.error('uncaughtException:', err)
})

process.on('unhandledRejection', (err) => {
  console.error('unhandledRejection:', err)
})

app.whenReady().then(() => {
  registerIpcHandlers()
  createMainWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
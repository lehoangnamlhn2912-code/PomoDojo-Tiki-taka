import {
  app,
  BrowserWindow,
  ipcMain,
  shell,
  screen
} from 'electron'
import path from 'node:path'


const isDev = !!process.env.VITE_DEV_SERVER_URL
const devServerUrl = process.env.VITE_DEV_SERVER_URL

let mainWindow = null
let dimWindow = null


// ============================================================
// SCREEN DIM OVERLAY
// ============================================================

function createDimWindow() {
  if (dimWindow && !dimWindow.isDestroyed()) {
    return dimWindow
  }

  console.log('[EyeGuard] Creating screen dim window...')

  // ----------------------------------------------------------
  // Xác định monitor mà EduMotion đang nằm trên
  // ----------------------------------------------------------

  const mainBounds = mainWindow?.getBounds()

  let targetDisplay

  if (mainBounds) {
    targetDisplay = screen.getDisplayNearestPoint({
      x: Math.round(mainBounds.x + mainBounds.width / 2),
      y: Math.round(mainBounds.y + mainBounds.height / 2)
    })
  } else {
    targetDisplay = screen.getPrimaryDisplay()
  }

  const { x, y, width, height } = targetDisplay.bounds

  console.log(
    '[EyeGuard] Target display:',
    { x, y, width, height }
  )


  // ----------------------------------------------------------
  // Tạo overlay window
  // ----------------------------------------------------------

  dimWindow = new BrowserWindow({
    x,
    y,
    width,
    height,

    frame: false,

    // KHÔNG dùng transparent để tránh vấn đề render trên Windows
    transparent: false,

    // Màu nền thật
    backgroundColor: '#000000',

    // Độ tối của toàn bộ cửa sổ
    opacity: 0.72,

    alwaysOnTop: true,
    skipTaskbar: true,

    // Không cướp focus
    focusable: false,

    show: false,

    autoHideMenuBar: true,

    resizable: false,
    movable: false,

    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })


  // Không chặn chuột
  dimWindow.setIgnoreMouseEvents(true)

  // Luôn nằm trên các cửa sổ bình thường
  dimWindow.setAlwaysOnTop(
    true,
    'screen-saver'
  )


  // ----------------------------------------------------------
  // HTML tối giản
  // ----------------------------------------------------------

  const overlayHTML = `
    <!DOCTYPE html>

    <html>
      <head>
        <meta charset="UTF-8">

        <style>
          html,
          body {
            margin: 0;
            padding: 0;
            width: 100%;
            height: 100%;
            overflow: hidden;
            background: #000000;
          }
        </style>
      </head>

      <body></body>
    </html>
  `


  // ----------------------------------------------------------
  // Load overlay
  // ----------------------------------------------------------

  dimWindow.loadURL(
    `data:text/html;charset=utf-8,${encodeURIComponent(
      overlayHTML
    )}`
  )


  // ----------------------------------------------------------
  // CHỈ HIỆN SAU KHI HTML LOAD XONG
  // ----------------------------------------------------------

  dimWindow.webContents.once(
    'did-finish-load',
    () => {

      console.log(
        '[EyeGuard] Dim overlay finished loading.'
      )

      if (
        dimWindow &&
        !dimWindow.isDestroyed()
      ) {
        dimWindow.showInactive()

        console.log(
          '[EyeGuard] Dim overlay SHOWN.'
        )
      }
    }
  )


  // ----------------------------------------------------------
  // Error
  // ----------------------------------------------------------

  dimWindow.webContents.on(
    'did-fail-load',
    (_, errorCode, errorDescription) => {
      console.error(
        '[EyeGuard] Overlay failed to load:',
        errorCode,
        errorDescription
      )
    }
  )


  // ----------------------------------------------------------
  // Cleanup
  // ----------------------------------------------------------

  dimWindow.on(
    'closed',
    () => {
      console.log(
        '[EyeGuard] Dim overlay CLOSED.'
      )

      dimWindow = null
    }
  )


  return dimWindow
}


// ============================================================
// SHOW / HIDE SCREEN DIM
// ============================================================

function setScreenDim(enabled) {

  console.log(
    `[EyeGuard] setScreenDim(${enabled})`
  )


  // ==========================================================
  // ENABLE
  // ==========================================================

  if (enabled) {

    const overlay = createDimWindow()

    // Nếu overlay đã load xong rồi thì show ngay
    if (
      overlay &&
      !overlay.isDestroyed() &&
      overlay.webContents.isLoading() === false
    ) {
      overlay.showInactive()

      console.log(
        '[EyeGuard] Dim overlay shown immediately.'
      )
    }

    return
  }


  // ==========================================================
  // DISABLE
  // ==========================================================

  if (
    dimWindow &&
    !dimWindow.isDestroyed()
  ) {

    console.log(
      '[EyeGuard] Hiding dim overlay.'
    )

    dimWindow.hide()
  }
}


// ============================================================
// MAIN WINDOW
// ============================================================

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
      preload: path.join(
        __dirname,
        'preload.cjs'
      ),

      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })


  // ----------------------------------------------------------
  // Show main window
  // ----------------------------------------------------------

  mainWindow.once(
    'ready-to-show',
    () => {
      mainWindow?.show()
    }
  )


  // ----------------------------------------------------------
  // External links
  // ----------------------------------------------------------

  mainWindow.webContents.setWindowOpenHandler(
    ({ url }) => {

      shell.openExternal(url)

      return {
        action: 'deny'
      }
    }
  )


  // ----------------------------------------------------------
  // Load errors
  // ----------------------------------------------------------

  mainWindow.webContents.on(
    'did-fail-load',
    (_, code, desc, url) => {

      console.error(
        'did-fail-load',
        code,
        desc,
        url
      )
    }
  )


  // ----------------------------------------------------------
  // DEV / PRODUCTION
  // ----------------------------------------------------------

  if (
    isDev &&
    devServerUrl
  ) {

    console.log(
      '[Electron] Loading dev server:',
      devServerUrl
    )

    mainWindow.loadURL(
      devServerUrl
    )

    mainWindow.webContents.openDevTools({
      mode: 'detach'
    })

  } else {

    mainWindow.loadFile(
      path.join(
        app.getAppPath(),
        'dist',
        'index.html'
      )
    )
  }


  // ----------------------------------------------------------
  // Cleanup
  // ----------------------------------------------------------

  mainWindow.on(
    'closed',
    () => {

      if (
        dimWindow &&
        !dimWindow.isDestroyed()
      ) {
        dimWindow.close()
      }

      dimWindow = null
      mainWindow = null
    }
  )
}


// ============================================================
// IPC
// ============================================================

function registerIpcHandlers() {

  ipcMain.handle(
    'app:get-version',
    () => app.getVersion()
  )


  ipcMain.handle(
    'app:get-name',
    () => app.getName()
  )


  ipcMain.handle(
    'shell:open-external',
    async (_, url) => {

      if (
        !url ||
        typeof url !== 'string'
      ) {
        return false
      }

      await shell.openExternal(url)

      return true
    }
  )


  // ==========================================================
  // EYE GUARD
  // ==========================================================

  ipcMain.on(
    'screen-dim',
    (_, enabled) => {

      console.log(
        '[EyeGuard] IPC screen-dim received:',
        enabled
      )

      setScreenDim(
        Boolean(enabled)
      )
    }
  )
}


// ============================================================
// ERROR HANDLING
// ============================================================

process.on(
  'uncaughtException',
  (err) => {

    console.error(
      'uncaughtException:',
      err
    )
  }
)


process.on(
  'unhandledRejection',
  (err) => {

    console.error(
      'unhandledRejection:',
      err
    )
  }
)


// ============================================================
// APP LIFECYCLE
// ============================================================

app.whenReady().then(() => {

  registerIpcHandlers()

  createMainWindow()


  app.on(
    'activate',
    () => {

      if (
        BrowserWindow.getAllWindows().length === 0
      ) {
        createMainWindow()
      }
    }
  )
})


app.on(
  'window-all-closed',
  () => {

    if (
      process.platform !== 'darwin'
    ) {
      app.quit()
    }
  }
)
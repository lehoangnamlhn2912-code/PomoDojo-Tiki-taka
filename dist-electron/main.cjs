// electron/main.js
var {
  app,
  BrowserWindow,
  ipcMain,
  screen,
  Notification
} = require("electron");
var path = require("path");
var mainWindow = null;
var overlayWindow = null;
function createOverlayWindow() {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width, height } = primaryDisplay.bounds;
  overlayWindow = new BrowserWindow({
    x: 0,
    y: 0,
    width,
    height,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    hasShadow: false,
    focusable: false,
    resizable: false,
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false
    }
  });
  overlayWindow.setAlwaysOnTop(true, "screen-saver");
  overlayWindow.setIgnoreMouseEvents(true, {
    forward: true
  });
  const overlayHtml = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">

        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }

          html,
          body {
            width: 100%;
            height: 100%;
            overflow: hidden;
          }

          body {
            background-color: rgba(0, 0, 0, 0.3);
            transition: background-color 0.4s ease;
            pointer-events: none;
          }
        </style>
      </head>

      <body></body>
    </html>
  `;
  overlayWindow.loadURL(
    "data:text/html;charset=utf-8," + encodeURIComponent(overlayHtml)
  );
  screen.on("display-metrics-changed", () => {
    if (!overlayWindow || overlayWindow.isDestroyed()) {
      return;
    }
    const updatedDisplay = screen.getPrimaryDisplay();
    overlayWindow.setBounds(
      updatedDisplay.bounds
    );
  });
}
function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 850,
    minWidth: 900,
    minHeight: 650,
    backgroundColor: "#030712",
    title: "PomoDojo - AI Focus & Eye Guard",
    webPreferences: {
      // IMPORTANT:
      // package.json builds preload.js -> preload.cjs
      preload: path.join(
        __dirname,
        "preload.cjs"
      ),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });
  const isDev = !app.isPackaged;
  if (isDev) {
    mainWindow.loadURL(
      "http://localhost:3000"
    );
  } else {
    mainWindow.loadFile(
      path.join(
        __dirname,
        "../dist/index.html"
      )
    );
  }
  mainWindow.webContents.on(
    "did-fail-load",
    (_event, errorCode, errorDescription) => {
      console.error(
        "[Electron] Failed to load:",
        errorCode,
        errorDescription
      );
    }
  );
  mainWindow.webContents.on(
    "console-message",
    (_event, level, message) => {
      console.log(
        `[Renderer ${level}] ${message}`
      );
    }
  );
  mainWindow.on("closed", () => {
    mainWindow = null;
    if (overlayWindow && !overlayWindow.isDestroyed()) {
      overlayWindow.close();
    }
    overlayWindow = null;
  });
}
ipcMain.on(
  "set-screen-dimming",
  (_event, payload = {}) => {
    if (!overlayWindow || overlayWindow.isDestroyed()) {
      return;
    }
    const {
      isDimmed = false,
      opacity = 0.3
    } = payload;
    if (!isDimmed) {
      overlayWindow.hide();
      return;
    }
    const safeOpacity = Math.max(
      0,
      Math.min(1, Number(opacity) || 0.3)
    );
    overlayWindow.webContents.executeJavaScript(`
        document.body.style.backgroundColor =
          "rgba(0, 0, 0, ${safeOpacity})";
      `).catch((error) => {
      console.error(
        "[Electron] Overlay update failed:",
        error
      );
    });
    overlayWindow.showInactive();
  }
);
ipcMain.on(
  "trigger-alarm",
  (_event, payload = {}) => {
    console.log(
      "[Electron] Alarm triggered:",
      payload
    );
    if (Notification.isSupported()) {
      const notification = new Notification({
        title: payload.title || "PomoDojo",
        body: payload.body || "Time for a break!"
      });
      notification.show();
    }
  }
);
ipcMain.handle(
  "get-system-status",
  () => {
    return {
      platform: process.platform,
      arch: process.arch,
      electronVersion: process.versions.electron,
      chromeVersion: process.versions.chrome,
      nodeVersion: process.versions.node,
      appVersion: app.getVersion()
    };
  }
);
app.whenReady().then(() => {
  createOverlayWindow();
  createMainWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

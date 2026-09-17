# Desktop App Screen Overlay Architecture (Electron / Tauri)

Khi đóng gói PomoDojo thành ứng dụng máy tính (Desktop App qua Electron hoặc Tauri), bạn có thể tạo một **cửa sổ phụ trong suốt toàn màn hình (Secondary Transparent Always-On-Top Window)** để làm tối màn hình OS 30% khi mặt sát màn hình quá 10s, kể cả khi ứng dụng đang chạy nền (background) hoặc người dùng đang dùng Word, Excel, Chrome, Visual Studio Code,...

---

## 1. Cơ chế hoạt động (Electron)

Trong file `electron/main.js`:

```javascript
const { app, BrowserWindow, ipcMain, screen } = require('electron');

let mainWindow;
let overlayWindow;

function createOverlayWindow() {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width, height } = primaryDisplay.bounds;

  overlayWindow = new BrowserWindow({
    x: 0,
    y: 0,
    width: width,
    height: height,
    transparent: true,         // Trong suốt hoàn toàn
    frame: false,               // Không thanh tiêu đề / viền
    alwaysOnTop: true,          // Nổi trên mọi ứng dụng khác của OS
    focusable: false,           // Không cướp focus của người dùng
    skipTaskbar: true,          // Không hiện icon dưới taskbar
    hasShadow: false,
    fullscreen: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    }
  });

  // Cho phép chuột click xuyên thấu qua cửa sổ làm tối để không cản trở người dùng
  overlayWindow.setIgnoreMouseEvents(true, { forward: true });

  // Tải trang HTML hoặc màu nền đen mờ 30%
  overlayWindow.loadURL(`data:text/html,
    <style>
      body {
        margin: 0;
        padding: 0;
        width: 100vw;
        height: 100vh;
        background-color: rgba(0, 0, 0, 0.30);
        backdrop-filter: brightness(0.70);
        transition: opacity 0.5s ease;
      }
    </style>
    <body></body>
  `);

  overlayWindow.hide();
}

// Nhận tín hiệu từ PomoDojo webapp qua DesktopOverlayService
ipcMain.on('set-screen-dimming', (event, { isDimmed, opacity, durationSeconds }) => {
  if (!overlayWindow) return;

  if (isDimmed) {
    overlayWindow.showInactive(); // Hiện overlay nổi lên mà không cướp focus
    overlayWindow.setAlwaysOnTop(true, 'screen-saver'); // Cấp cao nhất
  } else {
    overlayWindow.hide();
  }
});
```

---

## 2. Trong Web App PomoDojo

PomoDojo đã được tích hợp sẵn:
- Service: `src/services/desktopOverlayService.js` tự động phát tín hiệu `electronAPI.setScreenDimming` và `BroadcastChannel`.
- Khi ở chế độ Web trong trình duyệt: Overlay `bg-black/30` phủ toàn bộ trang web với `pointer-events: none`.
- Khi ở chế độ Desktop App: Cửa sổ phụ trong suốt của OS sẽ được kích hoạt tức thì.

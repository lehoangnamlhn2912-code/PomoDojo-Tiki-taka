/**
 * Desktop & Web Transparent Screen Dimming Bridge
 * 
 * In Web Browser Mode:
 *   Triggers a transparent fullscreen 30% dark overlay across the entire window.
 * 
 * In Desktop App Mode (Electron / Tauri):
 *   Sends an IPC command to the Main process to show a secondary frameless, transparent,
 *   always-on-top window spanning the full OS display (across all virtual desktops),
 *   allowing clicks to pass through (ignoreMouseEvents) while dimming the screen by 30% for 15 seconds.
 */

class DesktopOverlayService {
  constructor() {
    this.broadcastChannel = typeof BroadcastChannel !== 'undefined' 
      ? new BroadcastChannel('pomodojo_screen_dim') 
      : null;
  }

  /**
   * Trigger screen dimming
   * @param {boolean} isDimmed - true to dim 30%, false to restore normal brightness
   * @param {number} opacity - Dim level, default 0.30 (30% darkness)
   * @param {number} durationSeconds - Duration to hold continuously (e.g., 15s)
   */
  setScreenDimming(isDimmed, opacity = 0.30, durationSeconds = 15) {
    // 1. Dispatch custom event for DOM components
    window.dispatchEvent(new CustomEvent('pomodojo:dim-change', {
      detail: { isDimmed, opacity, durationSeconds }
    }));

    // 2. Broadcast to other browser windows/tabs
    if (this.broadcastChannel) {
      this.broadcastChannel.postMessage({ isDimmed, opacity, durationSeconds });
    }

    // 3. Electron Desktop App IPC (if running inside Electron wrapper)
    if (window.electronAPI && typeof window.electronAPI.setScreenDimming === 'function') {
      window.electronAPI.setScreenDimming({ isDimmed, opacity, durationSeconds });
    } else if (window.ipcRenderer) {
      window.ipcRenderer.send('set-screen-dimming', { isDimmed, opacity, durationSeconds });
    }

    // 4. Tauri Desktop App invoke (if running inside Tauri wrapper)
    if (window.__TAURI__ && window.__TAURI__.invoke) {
      window.__TAURI__.invoke('set_screen_dimming', { isDimmed, opacity, durationSeconds }).catch(() => {});
    }
  }
}

export const desktopOverlayService = new DesktopOverlayService();

import React, { useState, useEffect, useRef } from 'react';
import { Header } from './components/Header.jsx';
import { Navigation } from './components/Navigation.jsx';
import { BioReset } from './components/BioReset.jsx';
import { FocusMode } from './components/FocusMode.jsx';
import { BlindBreak } from './components/BlindBreak.jsx';
import { MascotStreak } from './components/MascotStreak.jsx';
import { FatigueAnalytics } from './components/FatigueAnalytics.jsx';
import { PrivacyShieldModal } from './components/PrivacyShieldModal.jsx';
import { PermissionModal } from './components/PermissionModal.jsx';
import {
  loadMascotState,
  saveMascotState,
  syncMascotWithDeviceRealTime
} from './utils/dataStore.js';

export default function App() {
  const [activeTab, setActiveTab] = useState('focus');

  // =========================
  // Eye / Noise states
  // =========================
  const [eyeDistanceCm, setEyeDistanceCm] = useState(30);
  const [noiseDb, setNoiseDb] = useState(0);

  // =========================
  // Mascot
  // =========================
  const [mascot, setMascot] = useState(loadMascotState);

  // =========================
  // Modals
  // =========================
  const [isPrivacyModalOpen, setIsPrivacyModalOpen] = useState(false);
  const [isPermissionModalOpen, setIsPermissionModalOpen] = useState(false);

  // =========================
  // Hardware Permissions
  // =========================
  const [cameraEnabled, setCameraEnabled] = useState(false);
  const [micEnabled, setMicEnabled] = useState(false);

  const [cameraPermissionStatus, setCameraPermissionStatus] =
    useState('prompt');

  const [micPermissionStatus, setMicPermissionStatus] =
    useState('prompt');

  // =========================
  // Media Streams
  // =========================
  const [cameraStream, setCameraStream] = useState(null);
  const [micStream, setMicStream] = useState(null);

  // ============================================================
  // EYE DISTANCE GUARD
  // ============================================================

  // Theo dõi timer khi mắt ở quá gần
  const dangerTimerRef = useRef(null);

  // Trạng thái hiện tại của fullscreen dim overlay
  const [isScreenDimmed, setIsScreenDimmed] = useState(false);

  const isTooClose =
    typeof eyeDistanceCm === 'number' &&
    eyeDistanceCm > 0 &&
    eyeDistanceCm < 35;
  useEffect(() => {
    if (isTooClose) {
      if (!dangerTimerRef.current) {
        console.log(
          '[EyeGuard] Eye distance < 35cm. Starting 10-second timer...'
        );

        dangerTimerRef.current = setTimeout(() => {
          console.log(
            '[EyeGuard] Eye distance < 35cm for 10 seconds. Dimming screen.'
          );

          setIsScreenDimmed(true);

          if (window.electronAPI?.screen?.setDim) {
            window.electronAPI.screen.setDim(true);
          } else {
            console.warn(
              '[EyeGuard] electronAPI.screen.setDim is not available.'
            );
          }

          dangerTimerRef.current = null;
        }, 5000);
      }

      return;
    }

    // ========================================================
    // MẮT ĐÃ RA XA
    // ========================================================

    if (dangerTimerRef.current) {
      console.log(
        '[EyeGuard] Eye distance returned to safe range. Cancelling timer.'
      );

      clearTimeout(dangerTimerRef.current);
      dangerTimerRef.current = null;
    }

    setIsScreenDimmed(false);

    if (window.electronAPI?.screen?.setDim) {
      window.electronAPI.screen.setDim(false);
    }

  }, [isTooClose]);
  // ============================================================
  // CLEANUP EYE GUARD KHI APP UNMOUNT
  // ============================================================

  useEffect(() => {
    return () => {
      if (dangerTimerRef.current) {
        clearTimeout(dangerTimerRef.current);
        dangerTimerRef.current = null;
      }

      if (window.electronAPI?.screen?.setDim) {
        window.electronAPI.screen.setDim(false);
      }
    };
  }, []);

  // ============================================================
  // SAVE MASCOT STATE
  // ============================================================

  useEffect(() => {
    saveMascotState(mascot);
  }, [mascot]);

  // ============================================================
  // DEVICE TIME SYNC
  // ============================================================

  useEffect(() => {
    const handleDeviceTimeSync = () => {
      setMascot((prev) => syncMascotWithDeviceRealTime(prev));
    };

    // Kiểm tra mỗi 60 giây
    const intervalId = setInterval(handleDeviceTimeSync, 60000);

    // Khi user quay lại app
    window.addEventListener('focus', handleDeviceTimeSync);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        handleDeviceTimeSync();
      }
    };

    document.addEventListener(
      'visibilitychange',
      handleVisibilityChange
    );

    return () => {
      clearInterval(intervalId);
      window.removeEventListener('focus', handleDeviceTimeSync);
      document.removeEventListener(
        'visibilitychange',
        handleVisibilityChange
      );
    };
  }, []);

  // ============================================================
  // CAMERA STREAM CLEANUP
  // ============================================================

  useEffect(() => {
    return () => {
      if (cameraStream) {
        cameraStream.getTracks().forEach((track) => {
          track.stop();
        });
      }
    };
  }, [cameraStream]);

  // ============================================================
  // MICROPHONE STREAM CLEANUP
  // ============================================================

  useEffect(() => {
    return () => {
      if (micStream) {
        micStream.getTracks().forEach((track) => {
          track.stop();
        });
      }
    };
  }, [micStream]);

  // ============================================================
  // RENDER
  // ============================================================

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col font-sans selection:bg-blue-500 selection:text-white">

      {/* ======================================================
          TOP BAR HEADER
      ======================================================= */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        mascot={mascot}
        onOpenPrivacyModal={() => setIsPrivacyModalOpen(true)}
        onOpenPermissionModal={() => setIsPermissionModalOpen(true)}
        cameraEnabled={cameraEnabled}
        micEnabled={micEnabled}
        eyeDistanceCm={eyeDistanceCm}
        noiseDb={noiseDb}
      />

      {/* ======================================================
          MAIN NAVIGATION
      ======================================================= */}
      <Navigation
        activeTab={activeTab}
        setActiveTab={setActiveTab}
      />

      {/* ======================================================
          MAIN CONTENT
      ======================================================= */}
      <main className="flex-1 pb-12">

        {/* BIO RESET */}
        {activeTab === 'bio_reset' && (
          <BioReset
            onComplete={() => setActiveTab('focus')}
          />
        )}

        {/* FOCUS MODE */}
        {activeTab === 'focus' && (
          <FocusMode
            eyeDistanceCm={eyeDistanceCm}
            setEyeDistanceCm={setEyeDistanceCm}

            noiseDb={noiseDb}
            setNoiseDb={setNoiseDb}

            onTriggerBlindBreak={() =>
              setActiveTab('blind_break')
            }

            cameraEnabled={cameraEnabled}
            setCameraEnabled={setCameraEnabled}

            micEnabled={micEnabled}
            setMicEnabled={setMicEnabled}

            cameraStream={cameraStream}
            setCameraStream={setCameraStream}

            micStream={micStream}
            setMicStream={setMicStream}

            onOpenPermissionModal={() =>
              setIsPermissionModalOpen(true)
            }
          />
        )}

        {/* BLIND BREAK */}
        {activeTab === 'blind_break' && (
          <BlindBreak
            mascot={mascot}
            setMascot={setMascot}
            onFinishBreak={() => setActiveTab('focus')}
          />
        )}

        {/* MASCOT */}
        {activeTab === 'mascot' && (
          <MascotStreak
            mascot={mascot}
            setMascot={setMascot}
          />
        )}

        {/* ANALYTICS */}
        {activeTab === 'analytics' && (
          <FatigueAnalytics
            mascot={mascot}
            noiseDb={noiseDb}
          />
        )}

      </main>

      {/* ======================================================
          FOOTER
      ======================================================= */}
      <footer className="h-10 px-6 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-500 font-mono select-none">

        <div className="flex items-center space-x-3">

          <span className="flex items-center space-x-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />

            <span className="text-slate-400">
              STATUS: EDGE_AI_OPERATIONAL
            </span>
          </span>

          <span className="hidden sm:inline text-slate-700">
            |
          </span>

          <span className="hidden sm:inline text-slate-500">
            PRIVACY: 100% LOCAL ZERO-DATA
          </span>

        </div>

        <div className="flex items-center space-x-4">

          <span>
            MEM: 128MB
          </span>

          <span>
            LATENCY: 8ms
          </span>

          <span className="text-emerald-400 flex items-center space-x-1">

            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />

            <span>
              CAM: {cameraEnabled ? 'ON' : 'OFF'} |
              MIC: {micEnabled ? 'ON' : 'OFF'}
            </span>

          </span>

        </div>

      </footer>

      {/* ======================================================
          PRIVACY SHIELD MODAL
      ======================================================= */}
      <PrivacyShieldModal
        isOpen={isPrivacyModalOpen}
        onClose={() => setIsPrivacyModalOpen(false)}
      />

      {/* ======================================================
          DEVICE PERMISSIONS MODAL
      ======================================================= */}
      <PermissionModal
        isOpen={isPermissionModalOpen}
        onClose={() => setIsPermissionModalOpen(false)}

        cameraEnabled={cameraEnabled}
        setCameraEnabled={setCameraEnabled}

        micEnabled={micEnabled}
        setMicEnabled={setMicEnabled}

        cameraPermissionStatus={cameraPermissionStatus}
        setCameraPermissionStatus={setCameraPermissionStatus}

        micPermissionStatus={micPermissionStatus}
        setMicPermissionStatus={setMicPermissionStatus}

        cameraStream={cameraStream}
        setCameraStream={setCameraStream}

        micStream={micStream}
        setMicStream={setMicStream}
      />

    </div>
  );
}
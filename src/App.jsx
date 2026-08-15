import React, { useState, useEffect } from 'react';
import { Header } from './components/Header.jsx';
import { Navigation } from './components/Navigation.jsx';
import { BioReset } from './components/BioReset.jsx';
import { FocusMode } from './components/FocusMode.jsx';
import { BlindBreak } from './components/BlindBreak.jsx';
import { MascotStreak } from './components/MascotStreak.jsx';
import { FatigueAnalytics } from './components/FatigueAnalytics.jsx';
import { PrivacyShieldModal } from './components/PrivacyShieldModal.jsx';
import { PermissionModal } from './components/PermissionModal.jsx';
import { loadMascotState, saveMascotState, syncMascotWithDeviceRealTime } from './utils/dataStore.js';

export default function App() {
  const [activeTab, setActiveTab] = useState('focus');
  const [eyeDistanceCm, setEyeDistanceCm] = useState(65);
  const [noiseDb, setNoiseDb] = useState(0);
  const [mascot, setMascot] = useState(loadMascotState);
  const [isPrivacyModalOpen, setIsPrivacyModalOpen] = useState(false);
  const [isPermissionModalOpen, setIsPermissionModalOpen] = useState(false);

  // Hardware Permissions & Stream States
  const [cameraEnabled, setCameraEnabled] = useState(false);
  const [micEnabled, setMicEnabled] = useState(false);
  const [cameraPermissionStatus, setCameraPermissionStatus] = useState('prompt'); // 'prompt' | 'granted' | 'denied'
  const [micPermissionStatus, setMicPermissionStatus] = useState('prompt');
  const [cameraStream, setCameraStream] = useState(null);
  const [micStream, setMicStream] = useState(null);

  // Save mascot state to local storage whenever updated
  useEffect(() => {
    saveMascotState(mascot);
  }, [mascot]);

  // Đồng bộ thời gian thực từ đồng hồ thiết bị (kiểm tra qua ngày mới, qua 30 ngày)
  useEffect(() => {
    const handleDeviceTimeSync = () => {
      setMascot((prev) => syncMascotWithDeviceRealTime(prev));
    };

    // Kiểm tra định kỳ mỗi 60 giây và khi user quay lại tab ứng dụng
    const intervalId = setInterval(handleDeviceTimeSync, 60000);
    window.addEventListener('focus', handleDeviceTimeSync);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        handleDeviceTimeSync();
      }
    });

    return () => {
      clearInterval(intervalId);
      window.removeEventListener('focus', handleDeviceTimeSync);
    };
  }, []);

  // Clean up media streams independently
  useEffect(() => {
    return () => {
      if (cameraStream) {
        cameraStream.getTracks().forEach((t) => t.stop());
      }
    };
  }, [cameraStream]);

  useEffect(() => {
    return () => {
      if (micStream) {
        micStream.getTracks().forEach((t) => t.stop());
      }
    };
  }, [micStream]);

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col font-sans selection:bg-blue-500 selection:text-white">
      {/* Top Bar Header */}
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

      {/* Main Navigation Tabs */}
      <Navigation activeTab={activeTab} setActiveTab={setActiveTab} />

      {/* Main Active Tab Content */}
      <main className="flex-1 pb-12">
        {activeTab === 'bio_reset' && (
          <BioReset onComplete={() => setActiveTab('focus')} />
        )}

        {activeTab === 'focus' && (
          <FocusMode
            eyeDistanceCm={eyeDistanceCm}
            setEyeDistanceCm={setEyeDistanceCm}
            noiseDb={noiseDb}
            setNoiseDb={setNoiseDb}
            onTriggerBlindBreak={() => setActiveTab('blind_break')}
            cameraEnabled={cameraEnabled}
            setCameraEnabled={setCameraEnabled}
            micEnabled={micEnabled}
            setMicEnabled={setMicEnabled}
            cameraStream={cameraStream}
            setCameraStream={setCameraStream}
            micStream={micStream}
            setMicStream={setMicStream}
            onOpenPermissionModal={() => setIsPermissionModalOpen(true)}
          />
        )}

        {activeTab === 'blind_break' && (
          <BlindBreak
            mascot={mascot}
            setMascot={setMascot}
            onFinishBreak={() => setActiveTab('focus')}
          />
        )}

        {activeTab === 'mascot' && (
          <MascotStreak mascot={mascot} setMascot={setMascot} />
        )}

        {activeTab === 'analytics' && (
          <FatigueAnalytics mascot={mascot} noiseDb={noiseDb} />
        )}
      </main>

      {/* Footer Status Bar */}
      <footer className="h-10 px-6 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-500 font-mono select-none">
        <div className="flex items-center space-x-3">
          <span className="flex items-center space-x-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-slate-400">STATUS: EDGE_AI_OPERATIONAL</span>
          </span>
          <span className="hidden sm:inline text-slate-700">|</span>
          <span className="hidden sm:inline text-slate-500">PRIVACY: 100% LOCAL ZERO-DATA</span>
        </div>

        <div className="flex items-center space-x-4">
          <span>MEM: 128MB</span>
          <span>LATENCY: 8ms</span>
          <span className="text-emerald-400 flex items-center space-x-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span>CAM: {cameraEnabled ? 'ON' : 'OFF'} | MIC: {micEnabled ? 'ON' : 'OFF'}</span>
          </span>
        </div>
      </footer>

      {/* Privacy Shield Modal */}
      <PrivacyShieldModal
        isOpen={isPrivacyModalOpen}
        onClose={() => setIsPrivacyModalOpen(false)}
      />

      {/* Device Permissions Modal */}
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

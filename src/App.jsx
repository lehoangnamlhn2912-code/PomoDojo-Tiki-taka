import React, { useState, useEffect, useCallback } from 'react';
import { Header } from './components/Header.jsx';
import { Navigation } from './components/Navigation.jsx';
import { BioReset } from './components/BioReset.jsx';
import { FocusMode } from './components/FocusMode.jsx';
import { BlindBreak } from './components/BlindBreak.jsx';
import { PureMovement } from './components/PureMovement.jsx';
import { VisualRestOverlay } from './components/VisualRestOverlay.jsx';
import { BreakChoiceModal } from './components/BreakChoiceModal.jsx';
import { MascotStreak } from './components/MascotStreak.jsx';
import { FatigueAnalytics } from './components/FatigueAnalytics.jsx';
import { PermissionModal } from './components/PermissionModal.jsx';
import { loadMascotState, saveMascotState, syncMascotWithDeviceRealTime } from './utils/dataStore.js';
import { desktopOverlayService } from './services/desktopOverlayService.js';
import { audioEngine } from './utils/audioEngine.js';
import { telemetryStore } from './utils/telemetryStore.js';

export default function App() {
  const [activeTab, setActiveTab] = useState('focus');
  const [eyeDistanceCm, setEyeDistanceCm] = useState(65);
  const [noiseDb, setNoiseDb] = useState(0);
  const [mascot, setMascot] = useState(loadMascotState);
  // Show permission setup modal as the very first screen upon launching the app
  const [isPermissionModalOpen, setIsPermissionModalOpen] = useState(true);

  // Full-screen transparent screen dimming state (~30% opacity, held for 15s continuously)
  const [isDimmed, setIsDimmed] = useState(false);
  const [dimHoldSeconds, setDimHoldSeconds] = useState(0);

  // Hardware Permissions & Stream States
  const [cameraEnabled, setCameraEnabled] = useState(false);
  const [micEnabled, setMicEnabled] = useState(false);
  const [cameraPermissionStatus, setCameraPermissionStatus] = useState('prompt'); // 'prompt' | 'granted' | 'denied'
  const [micPermissionStatus, setMicPermissionStatus] = useState('prompt');
  const [cameraStream, setCameraStream] = useState(null);
  const [micStream, setMicStream] = useState(null);

  // Pomodoro Cycle & Session Configuration (1 Cycle = 30s Bio Reset + Study + Break)
  const [studyMinutes, setStudyMinutes] = useState(25);
  const [breakMinutes, setBreakMinutes] = useState(5);
  const [totalCycles, setTotalCycles] = useState(4);

  // Active Session Running State
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [isSessionPaused, setIsSessionPaused] = useState(false);
  const [sessionPhase, setSessionPhase] = useState('idle'); // 'idle' | 'bio_reset' | 'study' | 'break' | 'completed'
  const [currentCycle, setCurrentCycle] = useState(1); // 1-indexed: 1, 2, ..., totalCycles

  // Break Mode Choice: 'blind_break' | 'pure_movement' | 'visual_rest' | null
  const [breakStyle, setBreakStyle] = useState(null);
  const [isBreakChoiceOpen, setIsBreakChoiceOpen] = useState(false);

  // Single source-of-truth countdown timer (in seconds) for current phase
  const [secondsLeft, setSecondsLeft] = useState(25 * 60);

  // Keep countdown timer in sync with configuration while idle
  useEffect(() => {
    if (!isSessionActive && sessionPhase === 'idle') {
      setSecondsLeft(studyMinutes * 60);
      setCurrentCycle(1);
    }
  }, [studyMinutes, isSessionActive, sessionPhase]);

  // Central Countdown Timer Loop for Pomodoro Cycles
  // Keeps interval perfectly stable without mid-second resetting
  useEffect(() => {
    if (!isSessionActive || isSessionPaused) return;

    const interval = setInterval(() => {
      setSecondsLeft((prev) => (prev > 0 ? prev - 1 : 0));
      if (sessionPhase === 'study') {
        telemetryStore.recordFocusSecond();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [isSessionActive, isSessionPaused, sessionPhase]);

  // Clean Phase Transitions when secondsLeft hits 0
  useEffect(() => {
    if (!isSessionActive || isSessionPaused || secondsLeft > 0) return;

    if (sessionPhase === 'bio_reset') {
      // 30s Bio-Reset finished -> Enter Focus Study
      setSessionPhase('study');
      setSecondsLeft(studyMinutes * 60);
      setActiveTab('focus');
      audioEngine.playSuccessSound();
    } else if (sessionPhase === 'study') {
      // Study phase finished -> Enter Break
      setSessionPhase('break');
      setSecondsLeft(breakMinutes * 60);
      setIsBreakChoiceOpen(true);
      audioEngine.playSuccessSound();
      if (breakStyle === 'pure_movement') {
        setActiveTab('pure_movement');
      } else if (breakStyle === 'visual_rest') {
        setActiveTab('focus');
      } else if (breakStyle === 'blind_break') {
        setActiveTab('blind_break');
      }
    } else if (sessionPhase === 'break') {
      // Break phase finished -> 1 Full Cycle complete
      setIsBreakChoiceOpen(false);
      setBreakStyle(null);

      if (currentCycle < totalCycles) {
        setCurrentCycle((prevCycle) => prevCycle + 1);
        // Bio-Reset is only for Cycle 1. From Cycle 2 onwards, return directly to Focus (Study)
        setSessionPhase('study');
        setSecondsLeft(studyMinutes * 60);
        setActiveTab('focus');
        audioEngine.playSuccessSound();
      } else {
        // All cycles completed!
        setIsSessionActive(false);
        setSessionPhase('completed');
        setActiveTab('focus');
        audioEngine.playSuccessSound();
      }
    }
  }, [secondsLeft, isSessionActive, isSessionPaused, sessionPhase, currentCycle, totalCycles, studyMinutes, breakMinutes, breakStyle]);

  // Start Focus Session: Begins with 30s Bio-Reset for Cycle 1
  const handleStartSession = () => {
    setIsSessionActive(true);
    setIsSessionPaused(false);
    setCurrentCycle(1);
    setSessionPhase('bio_reset');
    setSecondsLeft(30);
    setBreakStyle(null);
    setIsBreakChoiceOpen(false);
    setActiveTab('bio_reset');
  };

  // Finish Break (either naturally or manually) -> advance directly to next cycle's Study phase (No bio_reset in cycles 2+)
  const handleFinishBreak = () => {
    setIsBreakChoiceOpen(false);
    setBreakStyle(null);

    if (currentCycle < totalCycles) {
      setCurrentCycle((prevCycle) => prevCycle + 1);
      setSessionPhase('study');
      setSecondsLeft(studyMinutes * 60);
      setActiveTab('focus');
      audioEngine.playSuccessSound();
    } else {
      // All cycles completed!
      setIsSessionActive(false);
      setSessionPhase('completed');
      setActiveTab('focus');
      audioEngine.playSuccessSound();
    }
  };

  // Called when 30s Bio-Reset finishes (either via countdown or skip button)
  const handleBioResetComplete = useCallback(() => {
    if (!isSessionActive) {
      setActiveTab('focus');
      return;
    }
    setSessionPhase('study');
    setSecondsLeft(studyMinutes * 60);
    setActiveTab('focus');
    audioEngine.playSuccessSound();
  }, [isSessionActive, studyMinutes]);

  // Handle user selecting one of the 3 break choices
  const handleSelectBreakChoice = (choiceId) => {
    setBreakStyle(choiceId);
    setIsBreakChoiceOpen(false);
    if (choiceId === 'blind_break') {
      setActiveTab('blind_break');
    } else if (choiceId === 'pure_movement') {
      setActiveTab('pure_movement');
    } else if (choiceId === 'visual_rest') {
      setActiveTab('focus');
    }
  };

  const handleTogglePause = () => {
    setIsSessionPaused((prev) => !prev);
  };

  const handleStopSessionEarly = () => {
    // Early termination: reset the whole cycle and unlock configuration
    setIsSessionActive(false);
    setIsSessionPaused(false);
    setSessionPhase('idle');
    setCurrentCycle(1);
    setSecondsLeft(studyMinutes * 60);
    setBreakStyle(null);
    setIsBreakChoiceOpen(false);
    setActiveTab('focus');
  };

  // Save mascot state to local storage whenever updated
  useEffect(() => {
    saveMascotState(mascot);
  }, [mascot]);

  // Real-time synchronization from device clock (check new day, 30-day cycle)
  useEffect(() => {
    const handleDeviceTimeSync = () => {
      setMascot((prev) => syncMascotWithDeviceRealTime(prev));
    };

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

  // Sync screen dimming state with Desktop App / Secondary Transparent Window
  useEffect(() => {
    desktopOverlayService.setScreenDimming(isDimmed, 0.30, 15);
  }, [isDimmed]);

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col font-sans selection:bg-blue-500 selection:text-white">
      {/* Top Bar Header */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        mascot={mascot}
        onOpenPermissionModal={() => setIsPermissionModalOpen(true)}
        cameraEnabled={cameraEnabled}
        micEnabled={micEnabled}
        eyeDistanceCm={eyeDistanceCm}
        noiseDb={noiseDb}
      />

      {/* Main Navigation Tabs */}
      <Navigation
        activeTab={activeTab === 'pure_movement' ? 'blind_break' : activeTab}
        setActiveTab={setActiveTab}
      />

      {/* Main Active Tab Content */}
      <main className="flex-1 pb-12">
        {activeTab === 'bio_reset' && (
          <BioReset
            onComplete={handleBioResetComplete}
            isSessionActive={isSessionActive}
            sessionSecondsLeft={sessionPhase === 'bio_reset' ? secondsLeft : null}
            currentCycle={currentCycle}
            totalCycles={totalCycles}
            onStopSessionEarly={handleStopSessionEarly}
          />
        )}

        {activeTab === 'focus' && (
          <FocusMode
            eyeDistanceCm={eyeDistanceCm}
            setEyeDistanceCm={setEyeDistanceCm}
            noiseDb={noiseDb}
            setNoiseDb={setNoiseDb}
            onTriggerBlindBreak={() => {
              if (sessionPhase === 'break') {
                setIsBreakChoiceOpen(true);
              } else {
                setActiveTab('blind_break');
              }
            }}
            cameraEnabled={cameraEnabled}
            setCameraEnabled={setCameraEnabled}
            micEnabled={micEnabled}
            setMicEnabled={setMicEnabled}
            cameraStream={cameraStream}
            setCameraStream={setCameraStream}
            micStream={micStream}
            setMicStream={setMicStream}
            onOpenPermissionModal={() => setIsPermissionModalOpen(true)}
            isDimmed={isDimmed}
            setIsDimmed={setIsDimmed}
            dimHoldSeconds={dimHoldSeconds}
            setDimHoldSeconds={setDimHoldSeconds}
            // Cycle & Session Control Props
            studyMinutes={studyMinutes}
            setStudyMinutes={setStudyMinutes}
            breakMinutes={breakMinutes}
            setBreakMinutes={setBreakMinutes}
            totalCycles={totalCycles}
            setTotalCycles={setTotalCycles}
            isSessionActive={isSessionActive}
            isSessionPaused={isSessionPaused}
            sessionPhase={sessionPhase}
            currentCycle={currentCycle}
            secondsLeft={secondsLeft}
            onStartSession={handleStartSession}
            onTogglePause={handleTogglePause}
            onStopSessionEarly={handleStopSessionEarly}
            breakStyle={breakStyle}
            onChangeBreakStyle={() => setIsBreakChoiceOpen(true)}
          />
        )}

        {activeTab === 'blind_break' && (
          <BlindBreak
            mascot={mascot}
            setMascot={setMascot}
            onFinishBreak={isSessionActive && sessionPhase === 'break' ? handleFinishBreak : () => setActiveTab('focus')}
            cameraEnabled={cameraEnabled}
            setCameraEnabled={setCameraEnabled}
            cameraStream={cameraStream}
            setCameraStream={setCameraStream}
            onOpenPermissionModal={() => setIsPermissionModalOpen(true)}
            // Session cycle props (1 Cycle = 1 Study + 1 Break)
            secondsLeft={secondsLeft}
            isSessionActive={isSessionActive}
            isSessionPaused={isSessionPaused}
            sessionPhase={sessionPhase}
            totalCycles={totalCycles}
            currentCycle={currentCycle}
            onChangeBreakStyle={() => setIsBreakChoiceOpen(true)}
            onStopSessionEarly={handleStopSessionEarly}
          />
        )}

        {activeTab === 'pure_movement' && (
          <PureMovement
            cameraEnabled={cameraEnabled}
            setCameraEnabled={setCameraEnabled}
            cameraStream={cameraStream}
            setCameraStream={setCameraStream}
            onOpenPermissionModal={() => setIsPermissionModalOpen(true)}
            onFinishBreak={isSessionActive && sessionPhase === 'break' ? handleFinishBreak : () => setActiveTab('focus')}
            secondsLeft={secondsLeft}
            currentCycle={currentCycle}
            totalCycles={totalCycles}
            onChangeBreakStyle={() => setIsBreakChoiceOpen(true)}
            onStopSessionEarly={handleStopSessionEarly}
          />
        )}

        {activeTab === 'mascot' && (
          <MascotStreak mascot={mascot} setMascot={setMascot} />
        )}

        {activeTab === 'analytics' && (
          <FatigueAnalytics mascot={mascot} noiseDb={noiseDb} />
        )}
      </main>

      {/* Break Choice Selection Modal (3 options: Blind Break, Pure Movement, Visual Rest) */}
      <BreakChoiceModal
        isOpen={isBreakChoiceOpen}
        onClose={() => {
          setIsBreakChoiceOpen(false);
          // If no break style selected yet, default to blind break
          if (!breakStyle) {
            handleSelectBreakChoice('blind_break');
          }
        }}
        onSelectChoice={handleSelectBreakChoice}
        currentCycle={currentCycle}
        totalCycles={totalCycles}
        breakMinutes={breakMinutes}
        secondsLeft={secondsLeft}
      />

      {/* Visual Rest 50% Screen Dimming Overlay */}
      {sessionPhase === 'break' && breakStyle === 'visual_rest' && (
        <VisualRestOverlay
          secondsLeft={secondsLeft}
          currentCycle={currentCycle}
          totalCycles={totalCycles}
          onChangeBreakStyle={() => setIsBreakChoiceOpen(true)}
          onStopSessionEarly={handleStopSessionEarly}
        />
      )}

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

      {/* Pure Transparent Dark Dimming Overlay (Distance guard trigger) */}
      {isDimmed && (
        <div
          id="screen-dim-overlay"
          className="fixed inset-0 z-[99999] pointer-events-none transition-opacity duration-700 select-none bg-black/30"
          style={{
            backdropFilter: 'brightness(0.70)',
            WebkitBackdropFilter: 'brightness(0.70)'
          }}
          aria-hidden="true"
        />
      )}
    </div>
  );
}

import React, { useState, useEffect, useRef } from 'react';
import { 
  Play, 
  Pause, 
  RotateCcw, 
  Eye, 
  ShieldAlert, 
  Volume2, 
  ShieldCheck, 
  Sliders, 
  Camera, 
  Mic, 
  MicOff, 
  CameraOff, 
  Crosshair, 
  Scan, 
  Activity, 
  VolumeX,
  Radio,
  Zap,
  RefreshCw,
  AlertCircle,
  Clock,
  Plus,
  Minus,
  Lock,
  BookOpen,
  Coffee,
  Repeat,
  Square
} from 'lucide-react';
import { audioEngine } from '../utils/audioEngine.js';
import { useEyeDistanceTracker } from '../hooks/useEyeDistanceTracker.js';
import { EyeTrackingOverlay } from './EyeTrackingOverlay.jsx';
import { telemetryStore } from '../utils/telemetryStore.js';

export const FocusMode = ({
  eyeDistanceCm,
  setEyeDistanceCm,
  noiseDb,
  setNoiseDb,
  onTriggerBlindBreak,
  cameraEnabled,
  setCameraEnabled,
  micEnabled,
  setMicEnabled,
  cameraStream,
  setCameraStream,
  micStream,
  setMicStream,
  onOpenPermissionModal,
  isDimmed,
  setIsDimmed,
  dimHoldSeconds,
  setDimHoldSeconds,
  // Cycle & Session Control Props
  studyMinutes = 25,
  setStudyMinutes,
  breakMinutes = 5,
  setBreakMinutes,
  totalCycles = 4,
  setTotalCycles,
  isSessionActive = false,
  isSessionPaused = false,
  sessionPhase = 'idle',
  currentCycle = 1,
  secondsLeft = 25 * 60,
  onStartSession,
  onTogglePause,
  onStopSessionEarly
}) => {
  // Eye Distance Guard State
  const [tooCloseSeconds, setTooCloseSeconds] = useState(0);
  const [showHUDOverlay, setShowHUDOverlay] = useState(true);

  // Real Camera Error State
  const [cameraError, setCameraError] = useState(null);
  const [isConnectingCam, setIsConnectingCam] = useState(false);

  // Acoustic Shield State
  const [soundState, setSoundState] = useState({
    isPlaying: false,
    soundType: 'rain',
    volume: 0.5,
    autoTriggered: false
  });
  const [autoTriggeredAt, setAutoTriggeredAt] = useState(null);

  // Audio Spectrum Frequency Data for Real Noise Meter Visualizer
  const [freqBars, setFreqBars] = useState(new Array(16).fill(10));
  const [peakNoiseDb, setPeakNoiseDb] = useState(0);
  const [simulatedNoiseDb, setSimulatedNoiseDb] = useState(null);

  // Video element ref for Real Physical WebCam
  const videoRef = useRef(null);

  // MediaPipe Face Landmark & PnP 3D Eye Distance Tracking Hook
  const {
    eyeData,
    inferenceMode,
    fps
  } = useEyeDistanceTracker(videoRef, cameraEnabled);

  // Stable refs to prevent cascading re-renders across frame updates
  const lastReportedDistanceRef = useRef(null);
  const lastDistanceReportTimeRef = useRef(0);
  const latestEyeDistanceRef = useRef(eyeDistanceCm);
  latestEyeDistanceRef.current = eyeDistanceCm;

  const latestEyeStatusRef = useRef(eyeData.status);
  latestEyeStatusRef.current = eyeData.status;

  const latestLookingDownRef = useRef(eyeData.pose?.isLookingDown);
  latestLookingDownRef.current = eyeData.pose?.isLookingDown;

  const latestMeasuredNoiseDbRef = useRef(noiseDb);
  latestMeasuredNoiseDbRef.current = noiseDb;

  const focusNoiseRampDoneRef = useRef(false);

  // Sync eye distance cm estimate to parent App throttled (no 60fps re-render loops)
  useEffect(() => {
    if (!setEyeDistanceCm) return;
    const now = Date.now();

    if (eyeData.detected && eyeData.distance_cm !== null && eyeData.distance_cm !== undefined) {
      const rounded = Math.round(eyeData.distance_cm);
      if (rounded !== lastReportedDistanceRef.current && (now - lastDistanceReportTimeRef.current >= 400 || Math.abs(rounded - (lastReportedDistanceRef.current || 0)) >= 5)) {
        lastReportedDistanceRef.current = rounded;
        lastDistanceReportTimeRef.current = now;
        setEyeDistanceCm(rounded);
        telemetryStore.recordDistance(rounded);
        if (typeof eyeData.eyeOscillationsPerSec === 'number') {
          telemetryStore.recordEyeOscillation(eyeData.eyeOscillationsPerSec);
        }
      }
    } else if (!cameraEnabled) {
      if (lastReportedDistanceRef.current !== 55) {
        lastReportedDistanceRef.current = 55;
        setEyeDistanceCm(55);
      }
    }
  }, [eyeData.detected, eyeData.distance_cm, eyeData.eyeOscillationsPerSec, cameraEnabled, setEyeDistanceCm]);

  // Bind real camera stream to video element when camera is enabled
  useEffect(() => {
    const video = videoRef.current;
    if (video) {
      if (cameraStream && cameraEnabled) {
        video.srcObject = cameraStream;
        video.play().catch((err) => {
          console.warn("Real webcam video play failed:", err);
        });
      } else {
        video.srcObject = null;
      }
    }
  }, [cameraStream, cameraEnabled]);

  // Real Microphone Audio SPL Metering & Frequency Analyser Loop (throttled)
  const lastNoiseDbRef = useRef(0);
  const lastNoiseReportTimeRef = useRef(0);

  useEffect(() => {
    let audioCtx;
    let analyser;
    let animFrame;
    let source;

    if (micEnabled && micStream) {
      try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        audioCtx = new AudioCtx();
        source = audioCtx.createMediaStreamSource(micStream);
        analyser = audioCtx.createAnalyser();
        analyser.fftSize = 64;
        analyser.smoothingTimeConstant = 0.8;
        source.connect(analyser);

        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);

        const updateAudioMeter = () => {
          if (!analyser) return;
          analyser.getByteFrequencyData(dataArray);

          // Calculate real sound decibel
          let sum = 0;
          for (let i = 0; i < bufferLength; i++) {
            sum += dataArray[i];
          }
          const avg = sum / bufferLength;
          const currentDb = Math.round(30 + (avg / 255) * 60);

          const now = Date.now();
          if (Math.abs(currentDb - lastNoiseDbRef.current) >= 2 && now - lastNoiseReportTimeRef.current >= 400) {
            lastNoiseDbRef.current = currentDb;
            lastNoiseReportTimeRef.current = now;
            if (setNoiseDb) setNoiseDb(currentDb);
            setPeakNoiseDb((prev) => Math.max(prev, currentDb));
            telemetryStore.recordNoise(currentDb);
          }

          // Compute 16 spectrum bar heights (percentage 10% - 100%)
          const step = Math.floor(bufferLength / 16) || 1;
          const bars = [];
          for (let i = 0; i < 16; i++) {
            const val = dataArray[i * step] || 0;
            bars.push(Math.max(10, Math.round((val / 255) * 100)));
          }
          setFreqBars(bars);

          animFrame = requestAnimationFrame(updateAudioMeter);
        };

        updateAudioMeter();
      } catch (err) {
        console.warn("Real mic analyser error:", err);
      }
    } else {
      if (lastNoiseDbRef.current !== 0) {
        lastNoiseDbRef.current = 0;
        if (setNoiseDb) setNoiseDb(0);
      }
      setFreqBars(new Array(16).fill(8));
    }

    return () => {
      if (animFrame) cancelAnimationFrame(animFrame);
      if (audioCtx && audioCtx.state !== 'closed') {
        try {
          audioCtx.close();
        } catch (e) {}
      }
    };
  }, [micEnabled, micStream, setNoiseDb]);

  // Monitor eye distance threshold and trigger full-screen 30% dimming if too close for >= 10 seconds
  useEffect(() => {
    let checkInterval;
    const isMonitoring = cameraEnabled && isSessionActive && sessionPhase === 'study' && !isSessionPaused;
    
    if (isMonitoring) {
      checkInterval = setInterval(() => {
        const curDist = latestEyeDistanceRef.current;
        const isTooClose = curDist < 30;

        if (isTooClose) {
          setTooCloseSeconds((prev) => {
            const next = prev + 1;
            if (next >= 10 && !isDimmed) {
              setIsDimmed(true);
              setDimHoldSeconds(5);
              audioEngine.playWarningChime();
              telemetryStore.recordDimEvent();
            }
            return next;
          });
        } else {
          if (curDist >= 38) {
            setTooCloseSeconds((prev) => (prev !== 0 ? 0 : prev));
          }
        }
      }, 1000);
    } else {
      setTooCloseSeconds((prev) => (prev !== 0 ? 0 : prev));
    }

    return () => {
      if (checkInterval) clearInterval(checkInterval);
    };
  }, [cameraEnabled, isSessionActive, sessionPhase, isSessionPaused, isDimmed, setIsDimmed, setDimHoldSeconds]);

  // Continuous 5-second hold timer when dimmed
  useEffect(() => {
    let holdInterval;
    if (isDimmed && dimHoldSeconds > 0) {
      holdInterval = setInterval(() => {
        setDimHoldSeconds((prev) => {
          if (prev <= 1) {
            const curDist = latestEyeDistanceRef.current;
            const isLookingDown = latestLookingDownRef.current;
            if (curDist >= 35 || isLookingDown) {
              setIsDimmed(false);
              setTooCloseSeconds(0);
              return 0;
            } else {
              return 5;
            }
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (holdInterval) clearInterval(holdInterval);
    };
  }, [isDimmed, dimHoldSeconds, setIsDimmed, setDimHoldSeconds]);

  // Calculate dynamic screen dimming opacity (0% at >=50cm, scaling up to 45% at <=30cm)
  const dynamicDimOpacity =
    eyeDistanceCm <= 30
      ? 0.45
      : eyeDistanceCm < 50
      ? ((50 - eyeDistanceCm) / 20) * 0.4
      : 0;

  const isFocusPhase =
    isSessionActive && (sessionPhase === 'study' || sessionPhase === 'focus');
  const isFocusPhaseActive =
    isFocusPhase && !isSessionPaused;

  useEffect(() => {
    let rampInterval;

    if (!isFocusPhase) {
      focusNoiseRampDoneRef.current = false;
      setSimulatedNoiseDb(null);
      return;
    }

    if (!isFocusPhaseActive || focusNoiseRampDoneRef.current) {
      return;
    }

    const startedAt = Date.now();
    setSimulatedNoiseDb(40);

    rampInterval = setInterval(() => {
      const elapsed = Date.now() - startedAt;

      if (elapsed <= 5000) {
        const progress = elapsed / 5000;
        setSimulatedNoiseDb(Math.round(40 + (65 - 40) * progress));
        return;
      }

      if (elapsed <= 8000) {
        const progress = (elapsed - 5000) / 3000;
        const realNoiseDb = latestMeasuredNoiseDbRef.current ?? 0;
        setSimulatedNoiseDb(Math.round(65 + (realNoiseDb - 65) * progress));
        return;
      }

      focusNoiseRampDoneRef.current = true;
      setSimulatedNoiseDb(null);
      clearInterval(rampInterval);
    }, 100);

    return () => {
      if (rampInterval) clearInterval(rampInterval);
    };
  }, [isFocusPhase, isFocusPhaseActive]);

  const effectiveNoiseDb = simulatedNoiseDb ?? noiseDb;

  // Auto-trigger Acoustic Noise Masking if ambient noise reaches 65dB during focus/study phase
  const lastNoiseSpikeTimeRef = useRef(0);
  useEffect(() => {
    if (isFocusPhaseActive && effectiveNoiseDb >= 65) {
      const now = Date.now();
      if (now - lastNoiseSpikeTimeRef.current >= 4000) {
        lastNoiseSpikeTimeRef.current = now;
        telemetryStore.recordNoiseSpike();
      }

      if (!soundState.isPlaying) {
        audioEngine.playAmbientSound(soundState.soundType, soundState.volume);
        setSoundState((prev) => ({ ...prev, isPlaying: true, autoTriggered: true }));
        setAutoTriggeredAt(effectiveNoiseDb);
      }
    }
  }, [isFocusPhaseActive, effectiveNoiseDb, soundState.isPlaying, soundState.soundType, soundState.volume]);

  // Format MM:SS for countdown timer
  const formatTime = (totalSec) => {
    const safeSec = Math.max(0, totalSec || 0);
    const m = Math.floor(safeSec / 60);
    const s = safeSec % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Helper adjustment handlers for the 3 customizable rows (strictly blocked during active session)
  const handleAdjustStudyMinutes = (delta) => {
    if (isSessionActive) return;
    setStudyMinutes((prev) => Math.max(1, Math.min(180, (parseInt(prev, 10) || 25) + delta)));
  };

  const handleAdjustBreakMinutes = (delta) => {
    if (isSessionActive) return;
    setBreakMinutes((prev) => Math.max(1, Math.min(60, (parseInt(prev, 10) || 5) + delta)));
  };

  const handleAdjustTotalCycles = (delta) => {
    if (isSessionActive) return;
    setTotalCycles((prev) => Math.max(1, Math.min(20, (parseInt(prev, 10) || 4) + delta)));
  };

  const handleToggleSound = () => {
    if (soundState.isPlaying) {
      audioEngine.stopAmbientSound();
      setSoundState((prev) => ({ ...prev, isPlaying: false, autoTriggered: false }));
    } else {
      audioEngine.playAmbientSound(soundState.soundType, soundState.volume);
      setSoundState((prev) => ({ ...prev, isPlaying: true, autoTriggered: false }));
    }
  };

  const handleChangeSoundType = (type) => {
    setSoundState((prev) => ({ ...prev, soundType: type }));
    if (soundState.isPlaying) {
      audioEngine.playAmbientSound(type, soundState.volume);
    }
  };

  const handleChangeVolume = (e) => {
    const vol = parseFloat(e.target.value);
    setSoundState((prev) => ({ ...prev, volume: vol }));
    audioEngine.setVolume(vol);
  };

  // Turn on real physical webcam directly
  const handleQuickEnableRealCamera = async () => {
    setCameraError(null);
    setIsConnectingCam(true);
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Browser does not support webcam access.");
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { 
          width: { ideal: 640 }, 
          height: { ideal: 480 }, 
          facingMode: 'user' 
        }
      });
      setCameraStream(stream);
      setCameraEnabled(true);
    } catch (err) {
      console.error("Quick enable camera error:", err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setCameraError("Webcam permission blocked. Please click 'Allow' in the browser prompt or adjust site permissions.");
      } else {
        setCameraError(err.message || "Could not start real webcam.");
      }
      onOpenPermissionModal();
    } finally {
      setIsConnectingCam(false);
    }
  };

  // Turn on real physical mic directly
  const handleQuickEnableRealMic = async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Browser does not support microphone access.");
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setMicStream(stream);
      setMicEnabled(true);
    } catch (err) {
      console.error("Quick enable mic error:", err);
      onOpenPermissionModal();
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6 relative select-none">
      {/* Main Focus Control Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Pomodoro & Live Distance Protection & Webcam (7 Cols) */}
        <div className="lg:col-span-7 bg-slate-900/90 rounded-2xl border border-slate-800 p-6 shadow-2xl flex flex-col space-y-6">
          
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
                <Eye className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-100 uppercase tracking-wider">Ambient Eye Guard & Pomodoro</h2>
                <p className="text-xs text-slate-400">Live distance monitoring via real WebCam & focus study timer</p>
              </div>
            </div>

            {/* Tracking Status Badge */}
            <div className="flex items-center space-x-2 text-xs font-mono">
              <span className={`w-2 h-2 rounded-full ${cameraEnabled ? 'bg-emerald-500 animate-pulse' : 'bg-slate-600'}`} />
              <span className="text-slate-400">{cameraEnabled ? 'REAL CAM ACTIVE' : 'CAM OFF'}</span>
            </div>
          </div>

          {/* Pomodoro Timer Clock Visualizer & 3 Custom Setting Rows */}
          <div className="bg-slate-950 p-6 sm:p-7 rounded-2xl border border-slate-800/80 flex flex-col items-center justify-center space-y-6 relative">
            
            {/* Countdown Display & Phase Indicator */}
            <div className="text-center space-y-2">
              <div className="text-6xl sm:text-7xl font-mono font-black tracking-tight text-white drop-shadow-md">
                {formatTime(secondsLeft)}
              </div>
              <div className="text-xs uppercase font-mono tracking-widest font-bold flex items-center justify-center space-x-2">
                {sessionPhase === 'completed' && (
                  <span className="text-emerald-400">🎉 Completed all {totalCycles} Cycles!</span>
                )}
                {isSessionActive && !isSessionPaused && sessionPhase === 'bio_reset' && (
                  <span className="text-blue-400 flex items-center space-x-1.5">
                    <span className="w-2 h-2 rounded-full bg-blue-400 animate-ping inline-block" />
                    <span>Cycle {currentCycle} / {totalCycles} • Bio-Reset (30s Calibration)</span>
                  </span>
                )}
                {isSessionActive && !isSessionPaused && sessionPhase === 'study' && (
                  <span className="text-cyan-400 flex items-center space-x-1.5">
                    <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping inline-block" />
                    <span>Cycle {currentCycle} / {totalCycles} • Phase: Focus (Study)</span>
                  </span>
                )}
                {isSessionActive && !isSessionPaused && sessionPhase === 'break' && (
                  <span className="text-emerald-400 flex items-center space-x-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping inline-block" />
                    <span>Cycle {currentCycle} / {totalCycles} • Phase: Break (Rest)</span>
                  </span>
                )}
                {isSessionActive && isSessionPaused && (
                  <span className="text-amber-400">Paused • Cycle {currentCycle} / {totalCycles}</span>
                )}
              </div>

              {/* Notice when user visits Focus tab while in Break Phase */}
              {isSessionActive && sessionPhase === 'break' && (
                <div className="mt-2 p-2.5 bg-emerald-950/60 border border-emerald-500/30 rounded-xl text-emerald-300 text-xs flex items-center justify-between gap-3 max-w-md mx-auto">
                  <span className="text-left leading-relaxed">
                    ☕ You are in the break phase of <strong>Cycle {currentCycle}/{totalCycles}</strong>. Choose between Blind Break, Pure Movement, or Visual Rest.
                  </span>
                  <button
                    onClick={onTriggerBlindBreak}
                    className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold rounded-lg text-[11px] whitespace-nowrap cursor-pointer transition"
                  >
                    Break Options
                  </button>
                </div>
              )}
            </div>

            {/* 3 Customizable Configuration Rows (Study, Break, Cycles) - No presets, locked during active session */}
            <div className="w-full space-y-2.5 bg-slate-900/90 p-4 rounded-xl border border-slate-800 text-xs font-mono">
              
              {/* Row 1: Study Time */}
              <div className="flex items-center justify-between gap-3 p-2 bg-slate-950/70 rounded-lg border border-slate-800/80">
                <div className="flex items-center space-x-2 text-slate-300">
                  <BookOpen className="w-4 h-4 text-blue-400" />
                  <span className="font-semibold text-slate-200">Study Time:</span>
                </div>

                <div className="flex items-center space-x-2">
                  <div className={`flex items-center bg-slate-950 rounded-lg border border-slate-800 overflow-hidden ${isSessionActive ? 'opacity-50' : ''}`}>
                    <button
                      onClick={() => handleAdjustStudyMinutes(-1)}
                      disabled={isSessionActive || studyMinutes <= 1}
                      className="px-2.5 py-1.5 hover:bg-slate-800 text-slate-400 hover:text-slate-200 disabled:opacity-30 transition cursor-pointer"
                      title="Decrease 1 minute"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>

                    <input
                      type="number"
                      min="1"
                      max="180"
                      disabled={isSessionActive}
                      value={studyMinutes}
                      onChange={(e) => {
                        if (isSessionActive) return;
                        const val = Math.max(1, Math.min(180, parseInt(e.target.value, 10) || 1));
                        setStudyMinutes(val);
                      }}
                      className="w-12 bg-transparent text-center text-blue-300 font-bold text-xs focus:outline-none py-1 disabled:cursor-not-allowed"
                      title="Study duration (minutes)"
                    />
                    <span className="text-[10px] text-slate-500 pr-2">min</span>

                    <button
                      onClick={() => handleAdjustStudyMinutes(1)}
                      disabled={isSessionActive || studyMinutes >= 180}
                      className="px-2.5 py-1.5 hover:bg-slate-800 text-slate-400 hover:text-slate-200 disabled:opacity-30 transition cursor-pointer"
                      title="Increase 1 minute"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  {isSessionActive && <Lock className="w-3.5 h-3.5 text-amber-400/80" title="Locked during active session" />}
                </div>
              </div>

              {/* Row 2: Break Time */}
              <div className="flex items-center justify-between gap-3 p-2 bg-slate-950/70 rounded-lg border border-slate-800/80">
                <div className="flex items-center space-x-2 text-slate-300">
                  <Coffee className="w-4 h-4 text-emerald-400" />
                  <span className="font-semibold text-slate-200">Break Time:</span>
                </div>

                <div className="flex items-center space-x-2">
                  <div className={`flex items-center bg-slate-950 rounded-lg border border-slate-800 overflow-hidden ${isSessionActive ? 'opacity-50' : ''}`}>
                    <button
                      onClick={() => handleAdjustBreakMinutes(-1)}
                      disabled={isSessionActive || breakMinutes <= 1}
                      className="px-2.5 py-1.5 hover:bg-slate-800 text-slate-400 hover:text-slate-200 disabled:opacity-30 transition cursor-pointer"
                      title="Decrease 1 minute"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>

                    <input
                      type="number"
                      min="1"
                      max="60"
                      disabled={isSessionActive}
                      value={breakMinutes}
                      onChange={(e) => {
                        if (isSessionActive) return;
                        const val = Math.max(1, Math.min(60, parseInt(e.target.value, 10) || 1));
                        setBreakMinutes(val);
                      }}
                      className="w-12 bg-transparent text-center text-emerald-300 font-bold text-xs focus:outline-none py-1 disabled:cursor-not-allowed"
                      title="Break duration (minutes)"
                    />
                    <span className="text-[10px] text-slate-500 pr-2">min</span>

                    <button
                      onClick={() => handleAdjustBreakMinutes(1)}
                      disabled={isSessionActive || breakMinutes >= 60}
                      className="px-2.5 py-1.5 hover:bg-slate-800 text-slate-400 hover:text-slate-200 disabled:opacity-30 transition cursor-pointer"
                      title="Increase 1 minute"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  {isSessionActive && <Lock className="w-3.5 h-3.5 text-amber-400/80" title="Locked during active session" />}
                </div>
              </div>

              {/* Row 3: Total Cycles */}
              <div className="flex items-center justify-between gap-3 p-2 bg-slate-950/70 rounded-lg border border-slate-800/80">
                <div className="flex items-center space-x-2 text-slate-300">
                  <Repeat className="w-4 h-4 text-purple-400" />
                  <span className="font-semibold text-slate-200">Total Cycles:</span>
                </div>

                <div className="flex items-center space-x-2">
                  <div className={`flex items-center bg-slate-950 rounded-lg border border-slate-800 overflow-hidden ${isSessionActive ? 'opacity-50' : ''}`}>
                    <button
                      onClick={() => handleAdjustTotalCycles(-1)}
                      disabled={isSessionActive || totalCycles <= 1}
                      className="px-2.5 py-1.5 hover:bg-slate-800 text-slate-400 hover:text-slate-200 disabled:opacity-30 transition cursor-pointer"
                      title="Decrease 1 cycle"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>

                    <input
                      type="number"
                      min="1"
                      max="20"
                      disabled={isSessionActive}
                      value={totalCycles}
                      onChange={(e) => {
                        if (isSessionActive) return;
                        const val = Math.max(1, Math.min(20, parseInt(e.target.value, 10) || 1));
                        setTotalCycles(val);
                      }}
                      className="w-12 bg-transparent text-center text-purple-300 font-bold text-xs focus:outline-none py-1 disabled:cursor-not-allowed"
                      title="Total repeating cycles"
                    />
                    <span className="text-[10px] text-slate-500 pr-2">cycles</span>

                    <button
                      onClick={() => handleAdjustTotalCycles(1)}
                      disabled={isSessionActive || totalCycles >= 20}
                      className="px-2.5 py-1.5 hover:bg-slate-800 text-slate-400 hover:text-slate-200 disabled:opacity-30 transition cursor-pointer"
                      title="Increase 1 cycle"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  {isSessionActive && <Lock className="w-3.5 h-3.5 text-amber-400/80" title="Locked during active session" />}
                </div>
              </div>

            </div>

            {/* Session Action Controls */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 w-full pt-1">
              {!isSessionActive ? (
                <button
                  onClick={onStartSession}
                  className="w-full sm:w-auto px-10 py-3 rounded-xl font-bold text-sm shadow-xl flex items-center justify-center space-x-2.5 bg-gradient-to-r from-blue-600 to-emerald-500 hover:from-blue-500 hover:to-emerald-400 text-white shadow-blue-500/25 transition transform active:scale-95 cursor-pointer"
                  title={`1 Cycle includes ${studyMinutes} minutes study + ${breakMinutes} minutes break. Repeats ${totalCycles} times.`}
                >
                  <Play className="w-5 h-5 fill-white" />
                  <span>Start Focus Session ({totalCycles} cycles)</span>
                </button>
              ) : (
                <>
                  {/* Pause / Resume Button */}
                  <button
                    onClick={onTogglePause}
                    className={`px-6 py-2.5 rounded-xl font-bold text-xs shadow-lg flex items-center space-x-2 transition transform active:scale-95 cursor-pointer ${
                      isSessionPaused
                        ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/20'
                        : 'bg-amber-600 hover:bg-amber-500 text-white shadow-amber-600/20'
                    }`}
                  >
                    {isSessionPaused ? <Play className="w-4 h-4 fill-white" /> : <Pause className="w-4 h-4" />}
                    <span>{isSessionPaused ? 'Resume' : 'Pause'}</span>
                  </button>

                  {/* Stop Session Early (Resets everything and unlocks settings) */}
                  <button
                    onClick={onStopSessionEarly}
                    className="px-6 py-2.5 rounded-xl bg-red-950/80 hover:bg-red-900 border border-red-500/50 text-red-200 font-bold text-xs transition flex items-center space-x-2 cursor-pointer active:scale-95 shadow-lg shadow-red-950/30"
                    title="Stop Early - End session and reconfigure from scratch"
                  >
                    <Square className="w-4 h-4 fill-red-400 text-red-400" />
                    <span>Stop Early (Reset)</span>
                  </button>
                </>
              )}
            </div>

            {/* Lock Notice */}
            {isSessionActive && (
              <p className="text-[11px] text-amber-400/80 font-mono text-center flex items-center justify-center space-x-1.5">
                <Lock className="w-3.5 h-3.5" />
                <span>Settings are locked during an active session. Click <strong>"Stop Early"</strong> to end and reconfigure.</span>
              </p>
            )}

          </div>

          {/* Live Distance Safety & Dimming Notifications (Only shown when relevant) */}
          <div className="space-y-3">

            {/* Live 10s Countdown Notice (Before 30% Dimming) */}
            {tooCloseSeconds > 0 && tooCloseSeconds < 10 && !isDimmed && (
              <div className="p-3 bg-amber-950/60 border border-amber-500/50 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs text-amber-200 font-mono">
                <div className="flex items-center space-x-2">
                  <ShieldAlert className="w-4 h-4 text-amber-400 flex-shrink-0 animate-pulse" />
                  <span>
                    Sitting too close (&lt;30cm)! Screen will dim 30% in <strong className="text-white text-sm underline">{10 - tooCloseSeconds}s</strong>...
                  </span>
                </div>
                <div className="flex items-center space-x-2 w-full sm:w-auto">
                  <div className="w-28 h-2 bg-slate-900 rounded-full overflow-hidden border border-amber-500/40 flex-shrink-0">
                    <div
                      className="h-full bg-amber-500 transition-all duration-300"
                      style={{ width: `${(tooCloseSeconds / 10) * 100}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-amber-300 font-bold">{tooCloseSeconds}/10s</span>
                </div>
              </div>
            )}

            {/* Active Dimming Status Banner */}
            {isDimmed && (
              <div className="p-3 bg-slate-950/90 border border-slate-700 rounded-xl flex items-center justify-between text-xs font-mono text-slate-300">
                <div className="flex items-center space-x-2">
                  <span className="w-2 h-2 rounded-full bg-blue-400 animate-ping" />
                  <span>Screen dimmed 30% (holding continuously for <strong>{dimHoldSeconds}s</strong>)</span>
                </div>
                <button
                  onClick={() => {
                    setIsDimmed(false);
                    setDimHoldSeconds(0);
                    setTooCloseSeconds(0);
                  }}
                  className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[10px] border border-slate-600 transition cursor-pointer"
                >
                  Restore Brightness
                </button>
              </div>
            )}

          </div>

          {/* Camera Feed */}
          <div className="bg-slate-950 rounded-xl border border-slate-800 overflow-hidden shadow-inner relative space-y-2 p-3">
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center space-x-2 text-xs font-mono text-slate-300">
                <Camera className={`w-4 h-4 ${cameraEnabled ? 'text-emerald-400' : 'text-slate-500'}`} />
                <span className="font-bold">Camera Feed</span>
              </div>

              <div className="flex items-center space-x-2">
                {cameraEnabled && (
                  <button
                    onClick={() => setShowHUDOverlay(!showHUDOverlay)}
                    className={`text-[10px] font-mono px-2 py-0.5 rounded border transition cursor-pointer flex items-center space-x-1 ${
                      showHUDOverlay 
                        ? 'bg-blue-600/30 border-blue-500 text-blue-300' 
                        : 'bg-slate-900 border-slate-700 text-slate-400'
                    }`}
                  >
                    <Scan className="w-3 h-3" />
                    <span>{showHUDOverlay ? 'HUD: ON' : 'HUD: OFF'}</span>
                  </button>
                )}
                <button
                  onClick={onOpenPermissionModal}
                  className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition cursor-pointer"
                >
                  Permissions
                </button>
              </div>
            </div>

            {/* Video Feed Canvas Area */}
            <div className="w-full h-64 bg-slate-900/90 rounded-lg overflow-hidden border border-slate-800 relative flex items-center justify-center">
              {cameraEnabled ? (
                <>
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover scale-x-[-1]"
                  />

                  {/* High-Precision MediaPipe 3D Metric Distance HUD (No eye bounding boxes) */}
                  {showHUDOverlay && (
                    <EyeTrackingOverlay
                      eyeData={eyeData}
                      videoRef={videoRef}
                      inferenceMode={inferenceMode}
                      fps={fps}
                    />
                  )}
                </>
              ) : (
                <div className="flex flex-col items-center justify-center p-6 text-center space-y-3">
                  <div className="w-12 h-12 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400">
                    <CameraOff className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider">WebCam Is Disabled</h4>
                    <p className="text-[11px] text-slate-400 max-w-xs mt-0.5">
                      Enable real webcam to detect eyes in real time and monitor safe distance from screen.
                    </p>
                  </div>

                  {cameraError && (
                    <div className="p-2 bg-red-950/70 border border-red-500/40 rounded-lg text-xs text-red-300 max-w-xs flex items-center space-x-1.5">
                      <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                      <span>{cameraError}</span>
                    </div>
                  )}

                  <div className="flex space-x-2 pt-1">
                    <button
                      onClick={handleQuickEnableRealCamera}
                      disabled={isConnectingCam}
                      className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs rounded-lg shadow-md shadow-emerald-500/20 transition cursor-pointer flex items-center space-x-1.5 active:scale-95"
                    >
                      <Camera className="w-3.5 h-3.5" />
                      <span>{isConnectingCam ? 'Connecting...' : 'Enable Real WebCam'}</span>
                    </button>
                    <button
                      onClick={onOpenPermissionModal}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-lg border border-slate-700 transition cursor-pointer"
                    >
                      Permissions
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

        </div>

        {/* Right Column: Acoustic Shield & Noise Level Meter (5 Cols) */}
        <div className="lg:col-span-5 flex flex-col space-y-6">
          
          {/* Acoustic Masking Shield Card */}
          <div className="bg-slate-900/90 rounded-2xl border border-slate-800 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2.5">
                <Volume2 className="w-5 h-5 text-blue-400" />
                <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">Acoustic Masking Shield</h3>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 bg-blue-500/20 text-blue-300 rounded border border-blue-500/30">
                Web Audio Synthesizer
              </span>
            </div>

            {/* Auto Trigger Alert */}
            {soundState.autoTriggered && (
              <div className="p-3 bg-amber-950/60 border border-amber-500/40 rounded-xl text-xs text-amber-300 flex items-center space-x-2 animate-pulse">
                <ShieldAlert className="w-4 h-4 flex-shrink-0" />
                <span>Ambient noise exceeded <strong>65dB</strong>. Acoustic masking sound enabled automatically!</span>
              </div>
            )}

            {/* Sound Selector */}
            <div className="space-y-2">
              <label className="text-xs text-slate-400 font-mono block">Relaxing Masking Sound:</label>
              <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                {[
                  { id: 'rain', label: '🌧️ Gentle Rain' },
                  { id: 'forest', label: '🌲 Forest Ambience' },
                  { id: 'white_noise', label: '📻 White Noise' },
                  { id: 'binaural_432', label: '🎧 432Hz Alpha Waves' }
                ].map((s) => (
                  <button
                    key={s.id}
                    onClick={() => handleChangeSoundType(s.id)}
                    className={`p-2.5 rounded-xl border text-left transition cursor-pointer ${
                      soundState.soundType === s.id
                        ? 'bg-blue-600/30 border-blue-500 text-blue-200 font-bold'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:bg-slate-800'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Volume Control Slider */}
            <div className="space-y-1.5 pt-1">
              <div className="flex justify-between text-xs font-mono text-slate-400">
                <span>Masking Volume:</span>
                <span>{Math.round(soundState.volume * 100)}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={soundState.volume}
                onChange={handleChangeVolume}
                className="w-full accent-blue-500 bg-slate-950 h-2 rounded-lg cursor-pointer"
              />
            </div>

            {/* Play/Stop Button */}
            <button
              onClick={handleToggleSound}
              className={`w-full py-2.5 rounded-xl font-bold text-xs transition flex items-center justify-center space-x-2 border cursor-pointer ${
                soundState.isPlaying
                  ? 'bg-red-500/20 text-red-300 border-red-500/40 hover:bg-red-500/30'
                  : 'bg-blue-600 hover:bg-blue-500 text-white border-blue-400 shadow-md shadow-blue-500/20'
              }`}
            >
              <Volume2 className="w-4 h-4" />
              <span>{soundState.isPlaying ? 'Mute Masking Sound' : 'Play Acoustic Shield Sound'}</span>
            </button>
          </div>

          {/* REAL NOISE LEVEL METER */}
          <div className="bg-slate-900/90 rounded-2xl border border-slate-800 p-6 shadow-2xl space-y-4">
            
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2.5">
                <Radio className={`w-5 h-5 ${micEnabled ? 'text-emerald-400 animate-pulse' : 'text-slate-500'}`} />
                <div>
                  <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">Ambient Noise Level</h3>
                  <p className="text-[10px] text-slate-400">Live sound level from microphone</p>
                </div>
              </div>
              
              <div className="flex items-center space-x-2">
                <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
                  micEnabled ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' : 'bg-slate-800 text-slate-500 border-slate-700'
                }`}>
                  {micEnabled ? 'MIC ON' : 'MIC OFF'}
                </span>
                <button
                  onClick={onOpenPermissionModal}
                  className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition cursor-pointer"
                >
                  Permissions
                </button>
              </div>
            </div>

            {/* Numerical Decibel Display & Classification */}
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800/90 flex items-center justify-between">
              <div>
                <div className="flex items-baseline space-x-1.5">
                  <span className={`text-4xl font-black font-mono tracking-tight transition-colors ${
                    effectiveNoiseDb > 70 
                      ? 'text-red-400' 
                      : effectiveNoiseDb > 55 
                      ? 'text-amber-300' 
                      : micEnabled ? 'text-emerald-400' : 'text-slate-500'
                  }`}>
                    {isFocusPhaseActive ? effectiveNoiseDb : (micEnabled ? effectiveNoiseDb : '--')}
                  </span>
                  <span className="text-sm font-bold font-mono text-slate-400">dB</span>
                </div>
                <div className="text-[11px] font-mono text-slate-400 mt-0.5">
                  {isFocusPhaseActive || micEnabled ? (
                    effectiveNoiseDb < 50 ? (
                      <span className="text-emerald-400 font-semibold">🟢 Quiet (Ideal Study Environment)</span>
                    ) : effectiveNoiseDb <= 70 ? (
                      <span className="text-amber-400 font-semibold">🟡 Normal (Speech / Office)</span>
                    ) : (
                      <span className="text-red-400 font-semibold">🔴 Loud (Masking Triggered)</span>
                    )
                  ) : (
                    <span>Real microphone is not connected</span>
                  )}
                </div>
              </div>

              {/* Peak dB Stat Badge */}
              {micEnabled && (
                <div className="text-right font-mono text-[11px] text-slate-400 bg-slate-900 px-3 py-2 rounded-lg border border-slate-800">
                  <div className="text-slate-500 text-[10px]">PEAK</div>
                  <div className="text-white font-bold">{peakNoiseDb} dB</div>
                </div>
              )}
            </div>

            {/* Audio Spectrum Visualizer */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-[11px] font-mono text-slate-400">
                <span>Audio Frequency Spectrum:</span>
                <span>{micEnabled ? 'Active' : 'Paused'}</span>
              </div>
              <div className="h-14 bg-slate-950 rounded-xl border border-slate-800 p-2 flex items-end justify-between space-x-1">
                {freqBars.map((height, idx) => (
                  <div
                    key={idx}
                    className="flex-1 bg-slate-900 rounded-t overflow-hidden relative flex flex-col justify-end"
                    style={{ height: '100%' }}
                  >
                    <div
                      className={`w-full rounded-t transition-all duration-75 ${
                        effectiveNoiseDb > 70 
                          ? 'bg-gradient-to-t from-amber-500 to-red-500' 
                          : effectiveNoiseDb > 55 
                          ? 'bg-gradient-to-t from-blue-500 to-amber-400' 
                          : 'bg-gradient-to-t from-blue-600 to-emerald-400'
                      }`}
                      style={{ height: micEnabled ? `${height}%` : '8%' }}
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Decibel Progress Bar with 65dB Trigger Marker */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-[11px] font-mono text-slate-400">
                <span>Acoustic Shield Activation Threshold:</span>
                <span className="text-amber-400 font-bold">65 dB</span>
              </div>
              <div className="w-full h-3 bg-slate-950 rounded-full overflow-hidden p-0.5 border border-slate-800 relative">
                <div
                  className={`h-full rounded-full transition-all duration-150 ${
                    effectiveNoiseDb > 70
                      ? 'bg-red-500'
                      : effectiveNoiseDb > 55
                      ? 'bg-amber-400'
                      : 'bg-emerald-400'
                  }`}
                  style={{ width: `${Math.min(100, ((effectiveNoiseDb || 0) / 100) * 100)}%` }}
                />
                {/* 65dB Limit Line */}
                <div
                  className="absolute top-0 bottom-0 left-[65%] w-0.5 bg-amber-400 shadow-sm shadow-amber-400"
                  title="65 dB threshold to auto-trigger Acoustic Shield"
                />
              </div>
            </div>

            {/* Mic Off Alert & Quick Enable */}
            {!micEnabled && (
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between">
                <div className="flex items-center space-x-2 text-xs text-slate-400">
                  <MicOff className="w-4 h-4 text-slate-500 flex-shrink-0" />
                  <span>Enable microphone for automatic noise measurement</span>
                </div>
                <button
                  onClick={handleQuickEnableRealMic}
                  className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs rounded-lg transition cursor-pointer"
                >
                  Enable Real Mic
                </button>
              </div>
            )}

          </div>

        </div>

      </div>
    </div>
  );
};

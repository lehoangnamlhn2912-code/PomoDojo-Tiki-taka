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
  Minus
} from 'lucide-react';
import { audioEngine } from '../utils/audioEngine.js';
import { useEyeDistanceTracker } from '../hooks/useEyeDistanceTracker.js';
import { EyeTrackingOverlay } from './EyeTrackingOverlay.jsx';

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
  onOpenPermissionModal
}) => {
  // Pomodoro Timer State
  const [timerSeconds, setTimerSeconds] = useState(25 * 60); // 25 mins
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [sessionLength, setSessionLength] = useState(25);

  // Eye Distance Guard State
  const [tooCloseSeconds, setTooCloseSeconds] = useState(0);
  const [isDimmed, setIsDimmed] = useState(false);
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

  // Video element ref for Real Physical WebCam
  const videoRef = useRef(null);

  // MediaPipe Face Landmark & PnP 3D Eye Distance Tracking Hook
  const {
    eyeData,
    inferenceMode,
    fps
  } = useEyeDistanceTracker(videoRef, cameraEnabled);

  // Sync eye distance cm estimate and handle danger dimming trigger
  useEffect(() => {
    if (eyeData.detected && eyeData.distance_cm !== null && eyeData.distance_cm !== undefined) {
      setEyeDistanceCm(Math.round(eyeData.distance_cm));
    } else if (!cameraEnabled) {
      setEyeDistanceCm(55);
    }
  }, [eyeData, cameraEnabled, setEyeDistanceCm]);

  // Pomodoro timer ref to keep trigger callback updated
  const onTriggerBlindBreakRef = useRef(onTriggerBlindBreak);
  useEffect(() => {
    onTriggerBlindBreakRef.current = onTriggerBlindBreak;
  }, [onTriggerBlindBreak]);

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

  // Pomodoro countdown timer (stable interval)
  useEffect(() => {
    let interval;
    if (isTimerRunning) {
      interval = setInterval(() => {
        setTimerSeconds((prev) => Math.max(0, prev - 1));
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isTimerRunning]);

  // Handle timer completion
  useEffect(() => {
    if (isTimerRunning && timerSeconds === 0) {
      setIsTimerRunning(false);
      onTriggerBlindBreakRef.current();
    }
  }, [isTimerRunning, timerSeconds]);

  // Real Microphone Audio SPL Metering & Frequency Analyser Loop
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
          
          setNoiseDb(currentDb);
          setPeakNoiseDb((prev) => Math.max(prev, currentDb));

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
      setNoiseDb(0);
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

  // Monitor eye distance threshold during active focus sessions
  useEffect(() => {
    let checkInterval;
    if (isTimerRunning) {
      checkInterval = setInterval(() => {
        if (eyeDistanceCm < 35) {
          setTooCloseSeconds((prev) => {
            const next = prev + 1;
            if (next >= 20 && !isDimmed) {
              setIsDimmed(true);
              audioEngine.playWarningChime();
            }
            return next;
          });
        } else {
          setTooCloseSeconds(0);
          if (isDimmed) {
            setIsDimmed(false);
          }
        }
      }, 1000);
    } else {
      setTooCloseSeconds(0);
      setIsDimmed(false);
    }

    return () => clearInterval(checkInterval);
  }, [isTimerRunning, eyeDistanceCm, isDimmed]);

  // Calculate dynamic screen dimming opacity (0% at >=50cm, scaling up to 45% at <=30cm)
  const dynamicDimOpacity =
    eyeDistanceCm <= 30
      ? 0.45
      : eyeDistanceCm < 50
      ? ((50 - eyeDistanceCm) / 20) * 0.4
      : 0;

  // Auto-trigger Acoustic Noise Masking if ambient noise exceeds 65dB
  useEffect(() => {
    if (isTimerRunning && noiseDb > 65) {
      if (!soundState.isPlaying) {
        audioEngine.playAmbientSound(soundState.soundType, soundState.volume);
        setSoundState((prev) => ({ ...prev, isPlaying: true, autoTriggered: true }));
        setAutoTriggeredAt(noiseDb);
      }
    }
  }, [isTimerRunning, noiseDb, soundState.isPlaying, soundState.soundType, soundState.volume]);

  // Format MM:SS for countdown timer
  const formatTime = (totalSec) => {
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleToggleTimer = () => {
    setIsTimerRunning(!isTimerRunning);
  };

  const handleResetTimer = () => {
    setIsTimerRunning(false);
    setTimerSeconds(sessionLength * 60);
    setIsDimmed(false);
    setTooCloseSeconds(0);
  };

  const handleChangeSessionLength = (mins) => {
    const validMins = Math.max(1, Math.min(360, parseInt(mins, 10) || 25));
    setSessionLength(validMins);
    if (!isTimerRunning) {
      setTimerSeconds(validMins * 60);
    }
  };

  const handleAdjustMinutes = (deltaMins) => {
    if (isTimerRunning) {
      setTimerSeconds((prev) => Math.max(60, prev + deltaMins * 60));
    } else {
      const nextLength = Math.max(1, Math.min(360, sessionLength + deltaMins));
      setSessionLength(nextLength);
      setTimerSeconds(nextLength * 60);
    }
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
        throw new Error("Trình duyệt không hỗ trợ truy cập Webcam.");
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
        setCameraError("Quyền Webcam bị chặn. Vui lòng bấm 'Cho phép' trên popup trình duyệt hoặc mở cài đặt cấp quyền.");
      } else {
        setCameraError(err.message || "Không thể khởi động Webcam thật.");
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
        throw new Error("Trình duyệt không hỗ trợ truy cập Micro.");
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
      
      {/* Dynamic Ambient Dimming Screen Overlay */}
      {isDimmed && (
        <div
          className="fixed inset-0 bg-slate-950 transition-opacity duration-1000 z-30 pointer-events-none flex items-center justify-center"
          style={{ opacity: dynamicDimOpacity + 0.35 }}
        >
          <div className="bg-red-950/90 border-2 border-red-500 p-6 rounded-2xl text-center space-y-2 max-w-md shadow-2xl pointer-events-auto">
            <ShieldAlert className="w-10 h-10 text-red-400 mx-auto animate-bounce" />
            <h3 className="text-lg font-bold text-red-200 uppercase tracking-wider">Cảnh Báo Khoảng Cách Mắt!</h3>
            <p className="text-xs text-red-300 leading-relaxed">
              Bạn đang ngồi sát màn hình (<strong>{eyeDistanceCm} cm</strong>) quá lâu (&gt;20s). Màn hình đã tự động giảm độ sáng để bảo vệ võng mạc. Hãy lùi ra xa &gt;50cm!
            </p>
          </div>
        </div>
      )}

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
                <p className="text-xs text-slate-400">Giám sát khoảng cách mắt qua WebCam thật & đếm giờ học</p>
              </div>
            </div>

            {/* Tracking Status Badge */}
            <div className="flex items-center space-x-2 text-xs font-mono">
              <span className={`w-2 h-2 rounded-full ${cameraEnabled ? 'bg-emerald-500 animate-pulse' : 'bg-slate-600'}`} />
              <span className="text-slate-400">{cameraEnabled ? 'REAL CAM ACTIVE' : 'CAM OFF'}</span>
            </div>
          </div>

          {/* Pomodoro Timer Clock Visualizer */}
          <div className="bg-slate-950 p-7 rounded-2xl border border-slate-800/80 flex flex-col items-center justify-center space-y-6 relative">
            
            {/* Countdown Display */}
            <div className="text-center">
              <div className="text-6xl sm:text-7xl font-mono font-black tracking-tight text-white drop-shadow-md">
                {formatTime(timerSeconds)}
              </div>
              <div className="text-xs uppercase font-mono tracking-widest text-blue-400 mt-2 font-bold">
                {isTimerRunning ? 'Đang Trong Phiên Học Tập Tập Trung' : 'Sẵn Sàng Bắt Đầu Phiên Học'}
              </div>
            </div>

            {/* Session Length Controls: Presets & Custom Duration Stepper */}
            <div className="w-full flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-900/90 p-2.5 rounded-xl border border-slate-800 text-xs font-mono">
              {/* Quick Presets */}
              <div className="flex items-center space-x-1.5">
                <span className="text-slate-500 text-[11px] font-semibold">Mẫu:</span>
                {[15, 25, 45, 60].map((mins) => (
                  <button
                    key={mins}
                    onClick={() => handleChangeSessionLength(mins)}
                    className={`px-2.5 py-1 rounded-lg transition cursor-pointer font-bold ${
                      sessionLength === mins
                        ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/20'
                        : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
                    }`}
                  >
                    {mins}m
                  </button>
                ))}
              </div>

              {/* Custom Duration Input & Stepper */}
              <div className="flex items-center space-x-2">
                <span className="text-slate-500 text-[11px] font-semibold flex items-center space-x-1">
                  <Clock className="w-3 h-3 text-cyan-400" />
                  <span>Tùy chỉnh:</span>
                </span>

                <div className="flex items-center bg-slate-950 rounded-lg border border-slate-800 overflow-hidden">
                  <button
                    onClick={() => handleAdjustMinutes(-1)}
                    disabled={sessionLength <= 1}
                    className="px-2 py-1 hover:bg-slate-800 text-slate-400 hover:text-slate-200 disabled:opacity-30 transition cursor-pointer"
                    title="Giảm 1 phút"
                  >
                    <Minus className="w-3 h-3" />
                  </button>

                  <input
                    type="number"
                    min="1"
                    max="360"
                    value={sessionLength}
                    onChange={(e) => handleChangeSessionLength(e.target.value)}
                    className="w-12 bg-transparent text-center text-cyan-300 font-bold text-xs focus:outline-none py-1"
                    title="Nhập số phút tùy ý (1 - 360)"
                  />
                  <span className="text-[10px] text-slate-500 pr-1.5">phút</span>

                  <button
                    onClick={() => handleAdjustMinutes(1)}
                    disabled={sessionLength >= 360}
                    className="px-2 py-1 hover:bg-slate-800 text-slate-400 hover:text-slate-200 disabled:opacity-30 transition cursor-pointer"
                    title="Tăng 1 phút"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </div>

                {/* Quick Add Minutes while studying */}
                <button
                  onClick={() => handleAdjustMinutes(5)}
                  className="px-2 py-1 bg-slate-950 hover:bg-slate-800 text-emerald-400 font-bold text-[10px] rounded-lg border border-slate-800 transition cursor-pointer"
                  title="Thêm nhanh 5 phút"
                >
                  +5m
                </button>
              </div>
            </div>

            {/* Start / Pause Controls */}
            <div className="flex items-center space-x-4 pt-1">
              <button
                onClick={handleToggleTimer}
                className={`px-8 py-3 rounded-xl font-bold text-sm shadow-xl flex items-center space-x-2.5 transition transform active:scale-95 cursor-pointer ${
                  isTimerRunning
                    ? 'bg-amber-600 hover:bg-amber-500 text-white shadow-amber-600/20'
                    : 'bg-gradient-to-r from-blue-600 to-emerald-500 hover:from-blue-500 hover:to-emerald-400 text-white shadow-blue-500/25'
                }`}
              >
                {isTimerRunning ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 fill-white" />}
                <span>{isTimerRunning ? 'Tạm Dừng Phiên Học' : 'Bắt Đầu Giờ Học Tập Trung'}</span>
              </button>

              <button
                onClick={handleResetTimer}
                className="p-3 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-400 hover:text-slate-200 transition cursor-pointer"
                title="Đặt lại phiên về ban đầu"
              >
                <RotateCcw className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Live Eye Distance Gauge Bar & MediaPipe PnP State */}
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
            <div className="flex items-center justify-between text-xs font-mono">
              <div className="flex items-center space-x-2">
                <Eye className={`w-4 h-4 ${eyeData.status === 'danger' ? 'text-red-400 animate-pulse' : eyeData.status === 'warning' ? 'text-amber-400' : 'text-emerald-400'}`} />
                <span className="text-slate-300 font-bold">MediaPipe 3D PnP Distance:</span>
              </div>
              <span className={`font-bold ${eyeData.status === 'danger' ? 'text-red-400' : eyeData.status === 'warning' ? 'text-amber-400' : 'text-emerald-400'}`}>
                {eyeData.detected && eyeData.distance_cm !== null ? (
                  <>{eyeData.distance_cm} cm ({eyeData.status.toUpperCase()})</>
                ) : (
                  <>(Chưa quét khuôn mặt)</>
                )}
              </span>
            </div>

            {/* Distance Meter Bar */}
            <div className="w-full h-3 bg-slate-900 rounded-full overflow-hidden p-0.5 border border-slate-800 relative">
              <div
                className={`h-full rounded-full transition-all duration-200 ${
                  eyeData.status === 'danger'
                    ? 'bg-red-500'
                    : eyeData.status === 'warning'
                    ? 'bg-amber-400'
                    : 'bg-emerald-400'
                }`}
                style={{
                  width: `${Math.min(100, Math.max(15, (eyeData.ratio_to_safe || 1.0) * 70))}%`
                }}
              />
              <div className="absolute top-0 bottom-0 left-[77%] w-0.5 bg-red-500/80" title="Ngưỡng Danger > 1.25" />
              <div className="absolute top-0 bottom-0 left-[68%] w-0.5 bg-amber-400/60" title="Ngưỡng Warning > 1.10" />
            </div>

            <div className="flex items-center justify-between text-[11px] text-slate-400">
              <span>💡 Cảnh báo Danger nếu tỷ lệ &gt; 1.25 liên tục 1.5s (Hysteresis tắt khi &lt; 1.18).</span>
              <span className="font-mono text-emerald-400">
                {cameraEnabled ? (eyeData.detected ? `🎯 Đã detect ${eyeData.eye_boxes.length} mắt` : '🔍 Đang quét mắt...') : ''}
              </span>
            </div>
          </div>

          {/* REAL PHYSICAL WEBCAM LIVE FEED WITH YOLO OVERLAY */}
          <div className="bg-slate-950 rounded-xl border border-slate-800 overflow-hidden shadow-inner relative space-y-2 p-3">
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center space-x-2 text-xs font-mono text-slate-300">
                <Camera className={`w-4 h-4 ${cameraEnabled ? 'text-emerald-400' : 'text-slate-500'}`} />
                <span className="font-bold">Live WebCam & YOLO Eye Tracker:</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded font-mono ${
                  cameraEnabled ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-slate-800 text-slate-500'
                }`}>
                  {cameraEnabled ? `${inferenceMode.toUpperCase()} // ${fps} FPS` : 'CHƯA BẬT'}
                </span>
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
                    <span>{showHUDOverlay ? 'YOLO HUD: BẬT' : 'YOLO HUD: TẮT'}</span>
                  </button>
                )}
                <button
                  onClick={onOpenPermissionModal}
                  className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition cursor-pointer"
                >
                  Cài đặt quyền
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

                  {/* High-Precision MediaPipe 3D Landmark & PnP Overlay */}
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
                    <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider">WebCam Thật Đang Tắt</h4>
                    <p className="text-[11px] text-slate-400 max-w-xs mt-0.5">
                      Bật webcam thật để AI detect mắt theo thời gian thực và ước tính khoảng cách an toàn so với màn hình.
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
                      <span>{isConnectingCam ? 'Đang kết nối...' : 'Bật WebCam Thật'}</span>
                    </button>
                    <button
                      onClick={onOpenPermissionModal}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-lg border border-slate-700 transition cursor-pointer"
                    >
                      Cài đặt quyền
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
                <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">Acoustic Shield (Che Tiếng Ồn)</h3>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 bg-blue-500/20 text-blue-300 rounded border border-blue-500/30">
                Web Audio Synthesizer
              </span>
            </div>

            {/* Auto Trigger Alert */}
            {soundState.autoTriggered && (
              <div className="p-3 bg-amber-950/60 border border-amber-500/40 rounded-xl text-xs text-amber-300 flex items-center space-x-2 animate-pulse">
                <ShieldAlert className="w-4 h-4 flex-shrink-0" />
                <span>Tiếng ồn môi trường vượt <strong>65dB</strong>. Tự động bật âm thanh che tiếng ồn!</span>
              </div>
            )}

            {/* Sound Selector */}
            <div className="space-y-2">
              <label className="text-xs text-slate-400 font-mono block">Loại Âm Thanh Thư Giãn:</label>
              <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                {[
                  { id: 'rain', label: '🌧️ Tiếng Mưa Rơi' },
                  { id: 'forest', label: '🌲 Rừng Cây' },
                  { id: 'white_noise', label: '📻 White Noise' },
                  { id: 'binaural_432', label: '🎧 Sóng Alpha 432Hz' }
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
                <span>Âm lượng che phủ:</span>
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
              <span>{soundState.isPlaying ? 'Tắt Âm Che Phủ' : 'Bật Âm Che Phủ Tiếng Ồn'}</span>
            </button>
          </div>

          {/* REAL NOISE LEVEL METER (THANG ĐO TIẾNG ỒN MICRO THẬT THỜI GIAN THỰC NẰM DƯỚI ACOUSTIC SHIELD) */}
          <div className="bg-slate-900/90 rounded-2xl border border-slate-800 p-6 shadow-2xl space-y-4">
            
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2.5">
                <Radio className={`w-5 h-5 ${micEnabled ? 'text-emerald-400 animate-pulse' : 'text-slate-500'}`} />
                <div>
                  <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">Thang Đo Tiếng Ồn (Micro Thật)</h3>
                  <p className="text-[10px] text-slate-400">Đo SPL decibel trực tiếp từ Micro phòng</p>
                </div>
              </div>
              
              <div className="flex items-center space-x-2">
                <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
                  micEnabled ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' : 'bg-slate-800 text-slate-500 border-slate-700'
                }`}>
                  {micEnabled ? 'REAL MIC ACTIVE' : 'MIC TẮT'}
                </span>
                <button
                  onClick={onOpenPermissionModal}
                  className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition cursor-pointer"
                >
                  Cấp quyền
                </button>
              </div>
            </div>

            {/* Numerical Decibel Display & Classification */}
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800/90 flex items-center justify-between">
              <div>
                <div className="flex items-baseline space-x-1.5">
                  <span className={`text-4xl font-black font-mono tracking-tight transition-colors ${
                    noiseDb > 70 
                      ? 'text-red-400' 
                      : noiseDb > 55 
                      ? 'text-amber-300' 
                      : micEnabled ? 'text-emerald-400' : 'text-slate-500'
                  }`}>
                    {micEnabled ? noiseDb : '--'}
                  </span>
                  <span className="text-sm font-bold font-mono text-slate-400">dB</span>
                </div>
                <div className="text-[11px] font-mono text-slate-400 mt-0.5">
                  {micEnabled ? (
                    noiseDb < 50 ? (
                      <span className="text-emerald-400 font-semibold">🟢 Yên tĩnh (Lý tưởng học tập)</span>
                    ) : noiseDb <= 70 ? (
                      <span className="text-amber-400 font-semibold">🟡 Bình thường (Tiếng nói/Văn phòng)</span>
                    ) : (
                      <span className="text-red-400 font-semibold">🔴 Ồn ào (Kích hoạt che tiếng ồn)</span>
                    )
                  ) : (
                    <span>Micro thật chưa được kết nối</span>
                  )}
                </div>
              </div>

              {/* Peak dB Stat Badge */}
              {micEnabled && (
                <div className="text-right font-mono text-[11px] text-slate-400 bg-slate-900 px-3 py-2 rounded-lg border border-slate-800">
                  <div className="text-slate-500 text-[10px]">ĐỈNH (PEAK)</div>
                  <div className="text-white font-bold">{peakNoiseDb} dB</div>
                </div>
              )}
            </div>

            {/* Dynamic Multi-Channel Frequency Spectrum Audio Visualizer */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-[11px] font-mono text-slate-400">
                <span>Dải tần số âm thanh Micro Thật:</span>
                <span>{micEnabled ? 'Real-Time WebAudio FFT' : 'Tạm dừng'}</span>
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
                        noiseDb > 70 
                          ? 'bg-gradient-to-t from-amber-500 to-red-500' 
                          : noiseDb > 55 
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
                <span>Ngưỡng kích hoạt Acoustic Shield:</span>
                <span className="text-amber-400 font-bold">65 dB</span>
              </div>
              <div className="w-full h-3 bg-slate-950 rounded-full overflow-hidden p-0.5 border border-slate-800 relative">
                <div
                  className={`h-full rounded-full transition-all duration-150 ${
                    noiseDb > 70
                      ? 'bg-red-500'
                      : noiseDb > 55
                      ? 'bg-amber-400'
                      : 'bg-emerald-400'
                  }`}
                  style={{ width: `${Math.min(100, ((noiseDb || 0) / 100) * 100)}%` }}
                />
                {/* 65dB Limit Line */}
                <div
                  className="absolute top-0 bottom-0 left-[65%] w-0.5 bg-amber-400 shadow-sm shadow-amber-400"
                  title="Ngưỡng 65 dB tự động bật Acoustic Shield"
                />
              </div>
            </div>

            {/* Mic Off Alert & Quick Enable */}
            {!micEnabled && (
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between">
                <div className="flex items-center space-x-2 text-xs text-slate-400">
                  <MicOff className="w-4 h-4 text-slate-500 flex-shrink-0" />
                  <span>Bật micro thật để đo tiếng ồn tự động</span>
                </div>
                <button
                  onClick={handleQuickEnableRealMic}
                  className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs rounded-lg transition cursor-pointer"
                >
                  Bật Micro Thật
                </button>
              </div>
            )}

          </div>

        </div>

      </div>
    </div>
  );
};

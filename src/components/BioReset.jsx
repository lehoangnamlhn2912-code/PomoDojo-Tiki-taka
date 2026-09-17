import React, { useState, useEffect, useRef } from 'react';
import { Wind, Play, Pause, RotateCcw, ArrowRight, Volume2, VolumeX, Sparkles, Square } from 'lucide-react';
import { audioEngine } from '../utils/audioEngine.js';

export const BioReset = ({
  onComplete,
  isSessionActive = false,
  sessionSecondsLeft = null,
  currentCycle = 1,
  totalCycles = 4,
  onStopSessionEarly
}) => {
  const [isRunning, setIsRunning] = useState(isSessionActive);
  const [localSecondsLeft, setLocalSecondsLeft] = useState(30);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const lastPlayedPhaseRef = useRef(null);
  const onCompleteRef = useRef(onComplete);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  // Keep isRunning synced if session begins after mount
  useEffect(() => {
    if (isSessionActive) {
      setIsRunning(true);
    }
  }, [isSessionActive]);

  // If inside an active Pomodoro session, sync with App's master countdown timer
  const displaySeconds = isSessionActive && sessionSecondsLeft !== null 
    ? sessionSecondsLeft 
    : localSecondsLeft;

  // Derive breathing phase strictly from elapsed time (3s Inhale, 3s Hold, 3s Exhale = 9s per cycle)
  const elapsed = Math.max(0, 30 - displaySeconds);
  const step = elapsed % 9; // 0, 1, 2 = Inhale; 3, 4, 5 = Hold; 6, 7, 8 = Exhale

  let phase = 'Inhale';
  let phaseCounter = 3;
  if (step < 3) {
    phase = 'Inhale';
    phaseCounter = 3 - step;
  } else if (step < 6) {
    phase = 'Hold';
    phaseCounter = 6 - step;
  } else {
    phase = 'Exhale';
    phaseCounter = 9 - step;
  }

  // Play audio tone on phase transitions
  useEffect(() => {
    const isPlaying = isSessionActive || isRunning;
    if (isPlaying && soundEnabled && lastPlayedPhaseRef.current !== phase && displaySeconds > 0) {
      lastPlayedPhaseRef.current = phase;
      if (phase === 'Inhale') {
        audioEngine.playBreathingGuideTone(432, 3);
      } else if (phase === 'Hold') {
        audioEngine.playBreathingGuideTone(300, 3);
      } else if (phase === 'Exhale') {
        audioEngine.playBreathingGuideTone(220, 3);
      }
    }
  }, [phase, isSessionActive, isRunning, soundEnabled, displaySeconds]);

  // Standalone countdown timer when not in an active Pomodoro session
  useEffect(() => {
    if (isSessionActive) return; // Master timer is managed by App.jsx in session mode

    let timer = null;
    if (isRunning) {
      timer = setInterval(() => {
        setLocalSecondsLeft((prev) => {
          if (prev <= 1) {
            setIsRunning(false);
            audioEngine.playSuccessSound();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isRunning, isSessionActive]);

  const handleStart = () => {
    setIsRunning(true);
    if (localSecondsLeft === 0) {
      setLocalSecondsLeft(30);
      lastPlayedPhaseRef.current = null;
    }
    if (soundEnabled) {
      audioEngine.playBreathingGuideTone(432, 3);
    }
  };

  const handleReset = () => {
    setIsRunning(false);
    setLocalSecondsLeft(30);
    lastPlayedPhaseRef.current = null;
  };

  // Circle scaling calculation for visual feedback (3s cycle)
  const getCircleScale = () => {
    if (phase === 'Inhale') return 1.0 + (3 - phaseCounter) * 0.16;
    if (phase === 'Hold') return 1.48;
    if (phase === 'Exhale') return 1.48 - (3 - phaseCounter) * 0.16;
    return 1.0;
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* Banner / Header */}
      <div className="bg-gradient-to-r from-blue-950/60 via-slate-900 to-emerald-950/40 p-6 rounded-2xl border border-blue-500/30 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xl">
        <div className="flex items-center space-x-4">
          <div className="w-12 h-12 rounded-xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-blue-400 flex-shrink-0">
            <Wind className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center space-x-2 flex-wrap gap-y-1">
              <span className="text-[10px] font-mono uppercase tracking-widest text-blue-400 font-bold">
                Phase 0 • Bio Calibration
              </span>
              {isSessionActive && (
                <span className="px-2 py-0.5 bg-blue-500/20 text-blue-300 text-[10px] font-mono rounded font-bold border border-blue-500/30">
                  Cycle {currentCycle} / {totalCycles}
                </span>
              )}
              <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-300 text-[10px] font-mono rounded">
                30-Second Reset
              </span>
            </div>
            <h2 className="text-xl font-bold text-slate-100">Biological Calibration (Bio Reset)</h2>
            <p className="text-xs text-slate-400 mt-1">
              Synchronize heart rhythm and brain waves to balanced Alpha state (432Hz) with a 3s-3s-3s breath cadence.
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2.5">
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className={`px-3 py-2 rounded-xl border text-xs font-mono flex items-center space-x-2 transition cursor-pointer ${
              soundEnabled
                ? 'bg-blue-500/20 text-blue-300 border-blue-500/40'
                : 'bg-slate-800 text-slate-400 border-slate-700'
            }`}
          >
            {soundEnabled ? <Volume2 className="w-4 h-4 text-blue-400" /> : <VolumeX className="w-4 h-4 text-slate-500" />}
            <span>{soundEnabled ? 'Audio: On' : 'Audio: Off'}</span>
          </button>

          {isSessionActive && onStopSessionEarly && (
            <button
              onClick={onStopSessionEarly}
              className="px-3 py-2 bg-red-950/80 hover:bg-red-900 border border-red-500/50 text-red-200 font-bold text-xs rounded-xl transition flex items-center space-x-1.5 cursor-pointer active:scale-95"
              title="Stop Session Early"
            >
              <Square className="w-3.5 h-3.5 fill-red-400 text-red-400" />
              <span className="hidden sm:inline">Stop</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Interactive Breathing Arena */}
      <div className="bg-slate-900/80 p-8 sm:p-12 rounded-2xl border border-slate-800 flex flex-col items-center justify-center space-y-8 relative overflow-hidden min-h-[380px] shadow-2xl">
        {/* Background ambient glow */}
        <div className="absolute inset-0 bg-radial from-blue-500/5 via-transparent to-transparent pointer-events-none" />

        {/* Breathing Circle Visualizer */}
        <div className="relative flex items-center justify-center">
          {/* External Ripple Ring */}
          <div
            className="w-64 h-64 sm:w-72 sm:h-72 rounded-full border border-blue-500/20 flex items-center justify-center transition-all duration-1000 ease-in-out"
            style={{
              transform: `scale(${getCircleScale()})`,
              boxShadow: (isRunning || isSessionActive) ? '0 0 60px rgba(59, 130, 246, 0.25)' : 'none'
            }}
          >
            {/* Inner Glowing Orb */}
            <div
              className={`w-44 h-44 sm:w-48 sm:h-48 rounded-full border-2 flex flex-col items-center justify-center transition-all duration-1000 ease-in-out ${
                phase === 'Inhale'
                  ? 'bg-gradient-to-br from-blue-600/30 to-emerald-500/30 border-blue-400 shadow-lg shadow-blue-500/30'
                  : phase === 'Hold'
                  ? 'bg-gradient-to-br from-emerald-600/30 to-teal-500/30 border-emerald-400 shadow-lg shadow-emerald-500/30'
                  : phase === 'Exhale'
                  ? 'bg-gradient-to-br from-indigo-600/30 to-purple-500/30 border-indigo-400 shadow-lg shadow-indigo-500/30'
                  : 'bg-slate-800/60 border-slate-700'
              }`}
            >
              <div className="text-3xl font-mono font-black text-white tracking-wider">{displaySeconds}s</div>
              <div className="text-xs uppercase font-bold tracking-widest text-blue-300 mt-1">
                {(isRunning || isSessionActive) ? phase : 'Ready'}
              </div>
              <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                {(isRunning || isSessionActive) ? `${phaseCounter}s` : '3s-3s-3s Cadence'}
              </div>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center space-x-4 z-10">
          {!isSessionActive && (
            !isRunning ? (
              <button
                onClick={handleStart}
                className="px-6 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-bold text-sm shadow-lg shadow-blue-500/30 flex items-center space-x-2 transition transform active:scale-95 cursor-pointer"
              >
                <Play className="w-4 h-4 fill-white" />
                <span>{displaySeconds === 0 ? 'Restart 30s Reset' : 'Start 30s Bio Reset'}</span>
              </button>
            ) : (
              <button
                onClick={() => setIsRunning(false)}
                className="px-6 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-sm font-semibold flex items-center space-x-2 transition cursor-pointer"
              >
                <Pause className="w-4 h-4" />
                <span>Pause</span>
              </button>
            )
          )}

          {!isSessionActive && (
            <button
              onClick={handleReset}
              className="p-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 border border-slate-700 transition cursor-pointer"
              title="Reset"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          )}

          {isSessionActive && (
            <button
              onClick={onComplete}
              className="px-4 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition flex items-center space-x-1.5 cursor-pointer shadow-lg shadow-indigo-600/30 active:scale-95"
              title="Skip bio reset and start study now"
            >
              <span>Skip to Focus</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Completion Action (when finished) */}
        {displaySeconds === 0 && (
          <div className="animate-fade-in bg-emerald-950/60 border border-emerald-500/50 p-4 rounded-xl flex items-center justify-between w-full max-w-md">
            <div className="flex items-center space-x-2 text-emerald-300 text-xs font-semibold">
              <Sparkles className="w-4 h-4 text-emerald-400" />
              <span>Bio Reset Completed! Biological rhythm calibrated.</span>
            </div>
            <button
              onClick={onComplete}
              className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-lg flex items-center space-x-1 transition shadow cursor-pointer"
            >
              <span>Enter Focus</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Instructional cards with exact 3s cadence */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-slate-800/40 p-4 rounded-xl border border-slate-700/50">
          <div className="text-xs font-bold text-blue-400 uppercase tracking-widest mb-1">1. Inhale (3s)</div>
          <p className="text-xs text-slate-400">Breathe deeply through your nose for 3 seconds, filling your lungs with oxygen.</p>
        </div>
        <div className="bg-slate-800/40 p-4 rounded-xl border border-slate-700/50">
          <div className="text-xs font-bold text-emerald-400 uppercase tracking-widest mb-1">2. Hold (3s)</div>
          <p className="text-xs text-slate-400">Gently hold your breath for 3 seconds with relaxed shoulders.</p>
        </div>
        <div className="bg-slate-800/40 p-4 rounded-xl border border-slate-700/50">
          <div className="text-xs font-bold text-indigo-400 uppercase tracking-widest mb-1">3. Exhale (3s)</div>
          <p className="text-xs text-slate-400">Smoothly release your breath for 3 seconds, releasing mental tension.</p>
        </div>
      </div>
    </div>
  );
};

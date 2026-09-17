import React, { useState, useEffect } from 'react';
import { Eye, Moon, Clock, ArrowRightLeft, Square, Volume2, VolumeX, Sparkles } from 'lucide-react';
import { audioEngine } from '../utils/audioEngine.js';

export const VisualRestOverlay = ({
  secondsLeft,
  currentCycle = 1,
  totalCycles = 4,
  onChangeBreakStyle,
  onStopSessionEarly,
  formatTime = (s) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`
}) => {
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Play gentle relaxation chime on mount
  useEffect(() => {
    if (soundEnabled) {
      audioEngine.playBreathingGuideTone(220, 2);
    }
  }, []);

  return (
    <div
      id="visual-rest-dim-overlay"
      className="fixed inset-0 z-[99998] bg-black/50 backdrop-blur-[2px] flex items-center justify-center p-6 select-none animate-in fade-in duration-500"
      style={{
        backdropFilter: 'brightness(0.50)',
        WebkitBackdropFilter: 'brightness(0.50)'
      }}
    >
      {/* Centered Resting Card */}
      <div className="bg-slate-950/90 border border-emerald-500/40 rounded-3xl p-8 max-w-lg w-full text-center space-y-6 shadow-2xl relative">
        {/* Pulsing Eye Icon */}
        <div className="relative w-20 h-20 mx-auto flex items-center justify-center">
          <div className="absolute inset-0 rounded-full bg-emerald-500/20 animate-ping" />
          <div className="w-16 h-16 rounded-2xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-400 shadow-lg shadow-emerald-500/20">
            <Moon className="w-8 h-8 animate-pulse text-emerald-300" />
          </div>
        </div>

        {/* Title and Cycle Status */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-center space-x-2">
            <span className="text-[10px] font-mono uppercase tracking-widest text-emerald-400 font-bold bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-500/30">
              50% Screen Dim Active
            </span>
            <span className="text-xs font-mono text-slate-300">
              Cycle {currentCycle} / {totalCycles}
            </span>
          </div>

          <h3 className="text-2xl font-black text-white">Visual Rest Mode</h3>
          <p className="text-xs text-slate-300 max-w-sm mx-auto leading-relaxed">
            Your display is dimmed by 50%. Look away from your screen toward a window or into the distance (20+ feet / 6 meters) to allow your ciliary eye muscles to relax completely.
          </p>
        </div>

        {/* Big Countdown Timer */}
        <div className="bg-slate-900/90 p-5 rounded-2xl border border-slate-800 max-w-xs mx-auto">
          <div className="text-[10px] font-mono uppercase tracking-widest text-slate-400 font-semibold mb-1 flex items-center justify-center space-x-1.5">
            <Clock className="w-3.5 h-3.5 text-emerald-400" />
            <span>Break Time Remaining</span>
          </div>
          <div className="text-5xl font-mono font-black text-emerald-400 tracking-tight">
            {formatTime(secondsLeft)}
          </div>
        </div>

        {/* Control Buttons */}
        <div className="flex items-center justify-center gap-3 pt-2">
          <button
            onClick={onChangeBreakStyle}
            className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 hover:text-white font-bold text-xs rounded-xl transition flex items-center space-x-2 cursor-pointer shadow-md"
            title="Switch to Blind Break or Pure Movement"
          >
            <ArrowRightLeft className="w-3.5 h-3.5 text-emerald-400" />
            <span>Change Break Style</span>
          </button>

          {onStopSessionEarly && (
            <button
              onClick={onStopSessionEarly}
              className="px-4 py-2.5 bg-red-950/80 hover:bg-red-900 border border-red-500/50 text-red-200 font-bold text-xs rounded-xl transition flex items-center space-x-1.5 cursor-pointer active:scale-95 shadow-lg shadow-red-950/30"
              title="Stop Session Early"
            >
              <Square className="w-3.5 h-3.5 fill-red-400 text-red-400" />
              <span>Stop Session</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

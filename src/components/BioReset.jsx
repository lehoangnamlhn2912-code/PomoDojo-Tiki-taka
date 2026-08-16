import React, { useState, useEffect } from 'react';
import { Wind, Play, Pause, RotateCcw, ArrowRight, Volume2, VolumeX, Sparkles } from 'lucide-react';
import { audioEngine } from '../utils/audioEngine.js';

export const BioReset = ({ onComplete }) => {
  const [isRunning, setIsRunning] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(30);
  const [phase, setPhase] = useState('Inhale');
  const [phaseCounter, setPhaseCounter] = useState(4);
  const [soundEnabled, setSoundEnabled] = useState(true);

  // 30-second timer and breathing cycle logic
  useEffect(() => {
    let timer;
    if (isRunning && secondsLeft > 0) {
      timer = setInterval(() => {
        setSecondsLeft((prev) => {
          if (prev <= 1) {
            setIsRunning(false);
            return 0;
          }
          return prev - 1;
        });

        setPhaseCounter((prev) => {
          if (prev <= 1) {
            // Next phase
            setPhase((currPhase) => {
              if (currPhase === 'Inhale') {
                if (soundEnabled) audioEngine.playBreathingGuideTone(300, 4);
                return 'Hold';
              }
              if (currPhase === 'Hold') {
                if (soundEnabled) audioEngine.playBreathingGuideTone(220, 4);
                return 'Exhale';
              }
              if (currPhase === 'Exhale') {
                if (soundEnabled) audioEngine.playBreathingGuideTone(180, 2);
                return 'Rest';
              }
              if (soundEnabled) audioEngine.playBreathingGuideTone(432, 4);
              return 'Inhale';
            });
            return 4;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [isRunning, secondsLeft, soundEnabled]);

  const handleStart = () => {
    setIsRunning(true);
    if (secondsLeft === 0) {
      setSecondsLeft(30);
    }
    if (soundEnabled) {
      audioEngine.playBreathingGuideTone(432, 4);
    }
  };

  const handleReset = () => {
    setIsRunning(false);
    setSecondsLeft(30);
    setPhase('Inhale');
    setPhaseCounter(4);
  };

  // Circle scaling calculation for visual feedback
  const getCircleScale = () => {
    if (phase === 'Inhale') return 1 + (4 - phaseCounter) * 0.12;
    if (phase === 'Hold') return 1.48;
    if (phase === 'Exhale') return 1.48 - (4 - phaseCounter) * 0.12;
    return 1.0;
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* Banner / Header */}
      <div className="bg-gradient-to-r from-blue-950/60 via-slate-900 to-emerald-950/40 p-6 rounded-2xl border border-blue-500/30 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xl">
        <div className="flex items-center space-x-4">
          <div className="w-12 h-12 rounded-xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-blue-400">
            <Wind className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-[10px] font-mono uppercase tracking-widest text-blue-400 font-bold">Giai đoạn 0</span>
              <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-300 text-[10px] font-mono rounded">30-second Reset</span>
            </div>
            <h2 className="text-xl font-bold text-slate-100">Khởi Động Sinh Học (Bio Reset)</h2>
            <p className="text-xs text-slate-400 mt-1">
              Đưa nhịp tim và sóng não về trạng thái cân bằng Alpha (432Hz) trước khi bước vào phiên học tập.
            </p>
          </div>
        </div>

        <button
          onClick={() => setSoundEnabled(!soundEnabled)}
          className={`px-3 py-2 rounded-lg border text-xs font-mono flex items-center space-x-2 transition ${
            soundEnabled
              ? 'bg-blue-500/20 text-blue-300 border-blue-500/40'
              : 'bg-slate-800 text-slate-400 border-slate-700'
          }`}
        >
          {soundEnabled ? <Volume2 className="w-4 h-4 text-blue-400" /> : <VolumeX className="w-4 h-4 text-slate-500" />}
          <span>{soundEnabled ? 'Âm thanh: Bật' : 'Âm thanh: Tắt'}</span>
        </button>
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
              boxShadow: isRunning ? '0 0 60px rgba(59, 130, 246, 0.25)' : 'none'
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
              <div className="text-3xl font-mono font-black text-white tracking-wider">{secondsLeft}s</div>
              <div className="text-xs uppercase font-bold tracking-widest text-blue-300 mt-1">
                {isRunning ? phase : 'Sẵn sàng'}
              </div>
              <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                {isRunning ? `${phaseCounter}s` : '30s nhịp thở'}
              </div>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center space-x-4 z-10">
          {!isRunning ? (
            <button
              onClick={handleStart}
              className="px-6 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-bold text-sm shadow-lg shadow-blue-500/30 flex items-center space-x-2 transition transform active:scale-95"
            >
              <Play className="w-4 h-4 fill-white" />
              <span>Bắt đầu 30s Bio Reset</span>
            </button>
          ) : (
            <button
              onClick={() => setIsRunning(false)}
              className="px-6 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-sm font-semibold flex items-center space-x-2 transition"
            >
              <Pause className="w-4 h-4" />
              <span>Tạm dừng</span>
            </button>
          )}

          <button
            onClick={handleReset}
            className="p-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 border border-slate-700 transition"
            title="Đặt lại"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>

        {/* Completion Action */}
        {secondsLeft === 0 && (
          <div className="animate-fade-in bg-emerald-950/60 border border-emerald-500/50 p-4 rounded-xl flex items-center justify-between w-full max-w-md">
            <div className="flex items-center space-x-2 text-emerald-300 text-xs font-semibold">
              <Sparkles className="w-4 h-4 text-emerald-400" />
              <span>Đã hoàn thành Bio Reset! Nhịp sinh học đã sẵn sàng.</span>
            </div>
            <button
              onClick={onComplete}
              className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-lg flex items-center space-x-1 transition shadow"
            >
              <span>Vào Giờ Học</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Instructional cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-slate-800/40 p-4 rounded-xl border border-slate-700/50">
          <div className="text-xs font-bold text-blue-400 uppercase tracking-widest mb-1">1. Hít vào (Inhale - 4s)</div>
          <p className="text-xs text-slate-400">Hít sâu qua mũi, mở rộng lồng ngực và bụng dưới để nạp oxy tươi.</p>
        </div>
        <div className="bg-slate-800/40 p-4 rounded-xl border border-slate-700/50">
          <div className="text-xs font-bold text-emerald-400 uppercase tracking-widest mb-1">2. Giữ hơi (Hold - 4s)</div>
          <p className="text-xs text-slate-400">Giữ không khí trong phổi, giúp oxy thẩm thấu tốt hơn vào mạch máu.</p>
        </div>
        <div className="bg-slate-800/40 p-4 rounded-xl border border-slate-700/50">
          <div className="text-xs font-bold text-indigo-400 uppercase tracking-widest mb-1">3. Thở ra (Exhale - 4s)</div>
          <p className="text-xs text-slate-400">Thở chậm qua miệng, giải phóng căng thẳng cơ thể trước khi tập trung.</p>
        </div>
      </div>
    </div>
  );
};

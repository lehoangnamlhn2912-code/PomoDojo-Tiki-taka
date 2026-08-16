import React from 'react';
import { ShieldCheck, Zap, Volume2, Eye, Sliders, Camera, Mic } from 'lucide-react';

export const Header = ({
  activeTab,
  setActiveTab,
  mascot,
  onOpenPrivacyModal,
  onOpenPermissionModal,
  cameraEnabled,
  micEnabled,
  eyeDistanceCm,
  noiseDb
}) => {
  return (
    <header className="h-16 px-6 bg-slate-900/95 backdrop-blur border-b border-slate-800 flex items-center justify-between sticky top-0 z-40 select-none">
      {/* Brand & Subtitle */}
      <div className="flex items-center space-x-3">
        <div 
          onClick={() => setActiveTab('mascot')}
          className="w-9 h-9 bg-gradient-to-tr from-blue-600 to-emerald-500 rounded-lg flex items-center justify-center font-black text-white text-lg shadow-lg shadow-blue-500/20 cursor-pointer hover:scale-105 transition-transform"
        >
          P
        </div>
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-base font-black tracking-wider text-slate-100 uppercase">
              Pomo<span className="text-blue-400">Dojo</span>
            </h1>
            <span className="px-1.5 py-0.5 bg-blue-500/20 border border-blue-500/30 text-blue-300 text-[10px] font-mono font-semibold rounded">
              v1.0 Edge-AI
            </span>
          </div>
          <p className="text-[11px] text-slate-400">Adaptive Pomodoro & Blind Break System</p>
        </div>
      </div>

      {/* Center Live Real-time Status Pills */}
      <div className="hidden md:flex items-center space-x-3 text-xs font-mono">
        {/* Eye Distance Indicator */}
        <div className={`px-2.5 py-1 rounded-md border flex items-center space-x-2 transition-colors ${
          eyeDistanceCm < 35 
            ? 'bg-red-950/40 border-red-500/40 text-red-400 animate-pulse' 
            : 'bg-slate-800/80 border-slate-700/80 text-emerald-400'
        }`}>
          <Eye className="w-3.5 h-3.5" />
          <span>Eye: <strong className="font-bold">{eyeDistanceCm} cm</strong></span>
        </div>

        {/* Acoustic Noise Indicator */}
        <div className={`px-2.5 py-1 rounded-md border flex items-center space-x-2 ${
          noiseDb > 65 
            ? 'bg-amber-950/40 border-amber-500/40 text-amber-300' 
            : 'bg-slate-800/80 border-slate-700/80 text-blue-400'
        }`}>
          <Volume2 className="w-3.5 h-3.5" />
          <span>Noise: <strong className="font-bold">{noiseDb} dB</strong></span>
        </div>

        {/* Mascot Energy & Lives Badge */}
        <button 
          onClick={() => setActiveTab('mascot')}
          className="px-2.5 py-1 rounded-md bg-slate-800 hover:bg-slate-700/80 border border-slate-700 text-slate-200 flex items-center space-x-1.5 transition cursor-pointer"
        >
          <Zap className="w-3.5 h-3.5 text-yellow-400 fill-yellow-400" />
          <span>{mascot.name}: <strong className="text-blue-300">{mascot.energy}%</strong></span>
          <span className="text-[10px] text-slate-400">({mascot.streakDays}d 🔥 • {mascot.remainingLives || 4}/4 ❤️)</span>
        </button>
      </div>

      {/* Right Controls */}
      <div className="flex items-center space-x-3">
        {/* Zero-Data Privacy Shield Button */}
        <button
          onClick={onOpenPrivacyModal}
          className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-xs font-medium transition cursor-pointer"
        >
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span className="hidden sm:inline">Zero-Data Shield</span>
        </button>

        {/* Device Permissions Modal Trigger Button */}
        <button
          onClick={onOpenPermissionModal}
          className="flex items-center space-x-2 px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white border border-blue-400/40 text-xs font-semibold shadow-md shadow-blue-500/20 transition cursor-pointer active:scale-95"
          title="Cấp quyền WebCam và Micro"
        >
          <Sliders className="w-3.5 h-3.5 text-blue-200" />
          <span>Cấp quyền</span>
          <div className="flex items-center space-x-1 pl-1 border-l border-white/20">
            <Camera className={`w-3 h-3 ${cameraEnabled ? 'text-emerald-300' : 'text-slate-400'}`} />
            <Mic className={`w-3 h-3 ${micEnabled ? 'text-emerald-300' : 'text-slate-400'}`} />
          </div>
        </button>
      </div>
    </header>
  );
};

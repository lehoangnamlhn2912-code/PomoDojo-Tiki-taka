import React from 'react';
import { Flame, Shield, Heart, AlertCircle, Calendar, CheckCircle } from 'lucide-react';

export const MascotStreak = ({ mascot }) => {
  const currentCycleDay = mascot.cycleDay || 1;
  const daysLeftInCycle = Math.max(0, 30 - currentCycleDay);

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-blue-950 via-slate-900 to-amber-950/50 p-6 rounded-2xl border border-blue-500/30 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xl">
        <div className="flex items-center space-x-4">
          <div className="w-14 h-14 rounded-2xl bg-yellow-500/10 border-2 border-yellow-400/40 flex items-center justify-center text-3xl shadow-lg shadow-yellow-500/10">
            ⚡
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-[10px] font-mono uppercase tracking-widest text-amber-400 font-bold">Gamification Engine</span>
              <span className="px-2 py-0.5 bg-yellow-500/20 text-yellow-300 text-[10px] font-mono rounded">
                30-Day Cycle • 4 Lives Auto-Reset
              </span>
            </div>
            <h2 className="text-xl font-bold text-slate-100">Energy Mascot ("Eddy")</h2>
            <p className="text-xs text-slate-400 mt-1">
              30-Day Cycle Counter: Every 30 days, the system <strong>automatically replenishes 4 shield lives</strong> regardless of previous count.
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-4">
          {/* Day Cycle Counter */}
          <div className="flex items-center space-x-2 bg-slate-950 p-3 rounded-xl border border-slate-800">
            <Calendar className="w-5 h-5 text-blue-400" />
            <div className="text-right">
              <div className="text-lg font-black font-mono text-blue-300">{currentCycleDay} / 30</div>
              <div className="text-[9px] uppercase text-slate-400 font-mono">Cycle Day</div>
            </div>
          </div>

          {/* Streak Counter */}
          <div className="flex items-center space-x-2 bg-slate-950 p-3 rounded-xl border border-slate-800">
            <Flame className="w-5 h-5 text-orange-500 fill-orange-500 animate-bounce" />
            <div className="text-right">
              <div className="text-lg font-black font-mono text-slate-100">{mascot.streakDays} Days</div>
              <div className="text-[9px] uppercase text-slate-400 font-mono">Current Streak</div>
            </div>
          </div>
        </div>
      </div>

      {/* 30-Day Cycle Progress Bar Header */}
      <div className="bg-slate-900/80 p-5 rounded-2xl border border-slate-800 space-y-2.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs font-mono gap-1">
          <div className="flex items-center space-x-2 text-slate-300">
            <Calendar className="w-4 h-4 text-blue-400" />
            <span>30-Day Cycle Progress: <strong className="text-blue-400">Day {currentCycleDay} / 30</strong></span>
            <span className="text-[10px] text-slate-400 bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
              Device Date: {mascot.lastActiveDate || new Date().toISOString().split('T')[0]}
            </span>
          </div>
          <span className="text-amber-400 font-medium">
            ⏳ <strong>{daysLeftInCycle} days left</strong> until 4-Lives automatic replenishment
          </span>
        </div>

        <div className="w-full h-3 bg-slate-950 rounded-full overflow-hidden p-0.5 border border-slate-800">
          <div
            className="h-full bg-gradient-to-r from-blue-600 via-indigo-500 to-emerald-400 rounded-full transition-all duration-500"
            style={{ width: `${Math.min(100, (currentCycleDay / 30) * 100)}%` }}
          />
        </div>

        <div className="flex justify-between text-[10px] text-slate-500 font-mono">
          <span>Day 1 (Initialize 4 Lives)</span>
          <span>Day 15 (Mid-cycle)</span>
          <span>Day 30 (Auto-Reset 4 Lives)</span>
        </div>
      </div>

      {/* Main Mascot Display Grid */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        
        {/* Left Column: Avatar & Energy Gauge (7 Cols) */}
        <div className="md:col-span-7 bg-slate-900/80 p-8 rounded-2xl border border-slate-800 shadow-2xl flex flex-col items-center justify-center text-center relative overflow-hidden space-y-6">
          
          {/* Energy Halo & Mascot Icon */}
          <div className="relative">
            <div className="w-40 h-40 sm:w-48 sm:h-48 rounded-full bg-gradient-to-tr from-blue-600/20 via-yellow-500/20 to-emerald-500/20 border-4 border-yellow-400/60 flex items-center justify-center relative shadow-2xl shadow-yellow-500/20">
              
              {/* Central Mascot Emoji */}
              <div className="text-6xl sm:text-7xl transform hover:scale-110 transition duration-300 select-none">
                {mascot.energy > 80 ? '🤖' : mascot.energy > 40 ? '🔋' : '😴'}
              </div>

              {/* Status Badge */}
              <div className="absolute -bottom-3 px-4 py-1.5 bg-yellow-500 text-slate-950 font-black text-xs rounded-full shadow-lg border border-yellow-300 uppercase tracking-widest">
                {mascot.name} : {mascot.energy}% Energy
              </div>
            </div>
          </div>

          {/* Status Speech Bubble */}
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 max-w-md w-full relative">
            <div className="text-xs text-slate-300 italic font-medium">"{mascot.statusMessage}"</div>
          </div>

          {/* Energy Progress Bar */}
          <div className="w-full max-w-md space-y-1.5">
            <div className="flex justify-between text-xs font-mono">
              <span className="text-slate-400">Eddy Energy Level:</span>
              <span className="text-yellow-400 font-bold">{mascot.energy} / 100 HP</span>
            </div>
            <div className="w-full h-3 bg-slate-950 rounded-full overflow-hidden p-0.5 border border-slate-800">
              <div
                className="h-full bg-gradient-to-r from-amber-500 to-yellow-400 rounded-full transition-all duration-500"
                style={{ width: `${mascot.energy}%` }}
              />
            </div>
          </div>

        </div>

        {/* Right Column: 4-Life Shield & Streak Rules (5 Cols) */}
        <div className="md:col-span-5 flex flex-col space-y-6">
          
          {/* Monthly 4-Lives Shield Card */}
          <div className="bg-slate-900/80 p-6 rounded-2xl border border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Shield className="w-5 h-5 text-blue-400" />
                <h3 className="text-xs font-bold text-slate-200 uppercase tracking-widest">Streak Freeze Protection</h3>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 bg-blue-500/20 text-blue-300 border border-blue-500/30 rounded">
                4 Lives / 30 Days
              </span>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              If you miss a session or are unexpectedly busy, the shield automatically consumes a life to protect your streak. After 30 days, 4 lives are automatically replenished.
            </p>

            {/* Lives Heart Icons */}
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex items-center justify-around">
              {[1, 2, 3, 4].map((lifeNum) => {
                const isAlive = lifeNum <= mascot.remainingLives;
                return (
                  <div key={lifeNum} className="flex flex-col items-center space-y-1">
                    <Heart className={`w-7 h-7 transition-all ${
                      isAlive ? 'text-red-500 fill-red-500 drop-shadow-md animate-pulse' : 'text-slate-700 fill-slate-800'
                    }`} />
                    <span className="text-[10px] font-mono text-slate-500">Life {lifeNum}</span>
                  </div>
                );
              })}
            </div>

            <div className="text-[11px] text-slate-400 bg-slate-950 p-2.5 rounded-lg border border-slate-800 flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 text-blue-400 flex-shrink-0" />
              <span>
                Currently remaining: <strong className="text-blue-300">{mascot.remainingLives} / 4 Lives</strong>. Day <strong>{currentCycleDay}/30</strong> of cycle.
              </span>
            </div>
          </div>

          {/* Guidelines & Rules Card */}
          <div className="bg-slate-900/80 p-6 rounded-2xl border border-slate-800 space-y-3.5">
            <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center space-x-2">
              <CheckCircle className="w-4 h-4 text-emerald-400" />
              <span>Streak Rules:</span>
            </h4>

            <ul className="space-y-2 text-xs text-slate-400 leading-relaxed">
              <li className="flex items-start space-x-2">
                <span className="text-blue-400">•</span>
                <span>Complete scheduled study and blind break movement exercises to maintain your streak daily.</span>
              </li>
              <li className="flex items-start space-x-2">
                <span className="text-emerald-400">•</span>
                <span>Each 30-day cycle grants exactly 4 protection lives that automatically absorb missed sessions.</span>
              </li>
              <li className="flex items-start space-x-2">
                <span className="text-amber-400">•</span>
                <span>At the end of each 30-day window, your shield lives reset back to full 4 lives automatically.</span>
              </li>
            </ul>
          </div>

        </div>

      </div>
    </div>
  );
};


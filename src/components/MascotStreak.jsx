import React from 'react';
import { Flame, Shield, ShieldAlert, Heart, Sparkles, RefreshCw, AlertCircle, Calendar, FastForward, CheckCircle } from 'lucide-react';

export const MascotStreak = ({ mascot, setMascot }) => {
  const currentCycleDay = mascot.cycleDay || 1;
  const daysLeftInCycle = Math.max(0, 30 - currentCycleDay);

  // Simulate missing study session / look at screen during break
  const handleSimulateMissedBreak = () => {
    if (mascot.remainingLives > 0) {
      setMascot((prev) => ({
        ...prev,
        remainingLives: prev.remainingLives - 1,
        energy: Math.max(10, prev.energy - 25),
        statusMessage: `⚠️ You missed a study session! Streak shield absorbed the penalty. ${prev.remainingLives - 1}/4 Lives remaining in this 30-day cycle.`
      }));
    } else {
      setMascot((prev) => ({
        ...prev,
        streakDays: 0,
        energy: 20,
        statusMessage: '❌ You ran out of all 4 shield lives! Streak has reset to 0. Wait until the 30-day cycle completes to replenish 4 lives.'
      }));
    }
  };

  // Simulate completing 1 study day (+1 Day in 30-day cycle)
  const handleSimulateAdvanceOneDay = () => {
    setMascot((prev) => {
      const nextDay = (prev.cycleDay || 1) + 1;
      const nextStreak = prev.streakDays + 1;
      const nextEnergy = Math.min(100, prev.energy + 15);

      // IF CYCLE REACHES OR EXCEEDS 30 DAYS -> AUTOMATIC RESET TO 4 LIVES
      if (nextDay >= 30) {
        return {
          ...prev,
          streakDays: nextStreak,
          energy: 100,
          cycleDay: 1, // Start new 30-day cycle
          remainingLives: 4, // RESET TO 4 LIVES
          totalDaysTracked: (prev.totalDaysTracked || prev.streakDays) + 1,
          cycleStartDate: new Date().toISOString(),
          lastResetDate: new Date().toISOString(),
          statusMessage: '🎉 Congratulations! You completed a full 30-day cycle! System automatically replenished all 4/4 Streak Shield Lives.'
        };
      }

      return {
        ...prev,
        cycleDay: nextDay,
        streakDays: nextStreak,
        energy: nextEnergy,
        totalDaysTracked: (prev.totalDaysTracked || prev.streakDays) + 1,
        statusMessage: `🎉 Completed study day ${nextDay}/30! Streak increased to ${nextStreak} days 🔥 (${30 - nextDay} days left until 4-lives reset).`
      };
    });
  };

  // Simulate fast-forwarding 30 days (Test 4-Lives Reset Mechanism)
  const handleSimulateFastForward30Days = () => {
    setMascot((prev) => ({
      ...prev,
      cycleDay: 1,
      remainingLives: 4, // AUTO RESET TO 4 LIVES
      energy: 100,
      streakDays: prev.streakDays + 30,
      totalDaysTracked: (prev.totalDaysTracked || 0) + 30,
      cycleStartDate: new Date().toISOString(),
      lastResetDate: new Date().toISOString(),
      statusMessage: '⚡ FAST-FORWARDED 30 DAYS: System triggered recurring 30-day cycle reset, restoring all 4/4 Shield Lives!'
    }));
  };

  // Manual reset for cycle and shield lives
  const handleResetMonthShields = () => {
    setMascot((prev) => ({
      ...prev,
      cycleDay: 1,
      remainingLives: 4,
      cycleStartDate: new Date().toISOString(),
      lastResetDate: new Date().toISOString(),
      statusMessage: '🛡️ Reset 30-day cycle and replenished 4 Streak Shield Lives!'
    }));
  };

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

        {/* Right Column: 4-Life Shield & Interactive Testing (5 Cols) */}
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

          {/* Interactive Simulation Panel */}
          <div className="bg-slate-900/80 p-6 rounded-2xl border border-slate-800 space-y-3">
            <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">Simulate Counter & 30-Day Cycle:</h4>

            {/* Advance 1 Day */}
            <button
              onClick={handleSimulateAdvanceOneDay}
              className="w-full py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs rounded-xl shadow transition flex items-center justify-center space-x-2 cursor-pointer active:scale-95"
            >
              <Sparkles className="w-4 h-4" />
              <span>Advance +1 Day (+1 Streak, Cycle Day {currentCycleDay} → {currentCycleDay >= 30 ? 1 : currentCycleDay + 1})</span>
            </button>

            {/* Fast Forward 30 Days */}
            <button
              onClick={handleSimulateFastForward30Days}
              className="w-full py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs rounded-xl shadow transition flex items-center justify-center space-x-2 cursor-pointer active:scale-95"
            >
              <FastForward className="w-4 h-4" />
              <span>Fast-Forward +30 Days (Trigger 4-Lives Automatic Reset)</span>
            </button>

            {/* Miss Break (-1 Life) */}
            <button
              onClick={handleSimulateMissedBreak}
              className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 text-xs font-medium rounded-xl transition flex items-center justify-center space-x-2 cursor-pointer active:scale-95"
            >
              <ShieldAlert className="w-4 h-4 text-amber-400" />
              <span>Simulate: Missed Study Day (-1 Life)</span>
            </button>

            {/* Manual Reset */}
            <button
              onClick={handleResetMonthShields}
              className="w-full py-2 text-slate-400 hover:text-slate-200 text-[11px] font-mono flex items-center justify-center space-x-1 cursor-pointer"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Reset 30-Day Cycle & Replenish 4 Lives Now</span>
            </button>
          </div>

        </div>

      </div>
    </div>
  );
};


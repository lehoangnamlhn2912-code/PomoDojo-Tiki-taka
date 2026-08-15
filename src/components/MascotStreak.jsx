import React from 'react';
import { Flame, Shield, ShieldAlert, Heart, Sparkles, RefreshCw, AlertCircle, Calendar, FastForward, CheckCircle } from 'lucide-react';

export const MascotStreak = ({ mascot, setMascot }) => {
  const currentCycleDay = mascot.cycleDay || 1;
  const daysLeftInCycle = Math.max(0, 30 - currentCycleDay);

  // Giả lập bỏ qua buổi học / nhìn màn hình trong giờ nghỉ
  const handleSimulateMissedBreak = () => {
    if (mascot.remainingLives > 0) {
      setMascot((prev) => ({
        ...prev,
        remainingLives: prev.remainingLives - 1,
        energy: Math.max(10, prev.energy - 25),
        statusMessage: `⚠️ Bạn đã bỏ lỡ 1 phiên học! Lá chắn Streak đã hấp thụ tổn hại. Còn ${prev.remainingLives - 1}/4 Mạng trong chu kỳ 30 ngày.`
      }));
    } else {
      setMascot((prev) => ({
        ...prev,
        streakDays: 0,
        energy: 20,
        statusMessage: '❌ Bạn đã hết sạch 4 mạng bảo vệ! Streak đã bị reset về 0. Đợi đến khi hết chu kỳ 30 ngày để nhận lại 4 mạng mới.'
      }));
    }
  };

  // Giả lập hoàn thành 1 ngày học (Tăng +1 Ngày trong chu kỳ 30 ngày)
  const handleSimulateAdvanceOneDay = () => {
    setMascot((prev) => {
      const nextDay = (prev.cycleDay || 1) + 1;
      const nextStreak = prev.streakDays + 1;
      const nextEnergy = Math.min(100, prev.energy + 15);

      // NẾU ĐẠT HOẶC VƯỢT 30 NGÀY -> TỰ ĐỘNG RESET VỀ 4 MẠNG BẤT KỂ CHUYỆN GÌ XẢY RA
      if (nextDay >= 30) {
        return {
          ...prev,
          streakDays: nextStreak,
          energy: 100,
          cycleDay: 1, // Bắt đầu chu kỳ 30 ngày mới
          remainingLives: 4, // BẮT BUỘC RESET VỀ 4 MẠNG
          totalDaysTracked: (prev.totalDaysTracked || prev.streakDays) + 1,
          cycleStartDate: new Date().toISOString(),
          lastResetDate: new Date().toISOString(),
          statusMessage: '🎉 Chúc mừng! Đã hoàn thành trọn vẹn chu kỳ 30 ngày! Hệ thống tự động phục hồi đủ 4/4 Mạng bảo vệ Streak.'
        };
      }

      return {
        ...prev,
        cycleDay: nextDay,
        streakDays: nextStreak,
        energy: nextEnergy,
        totalDaysTracked: (prev.totalDaysTracked || prev.streakDays) + 1,
        statusMessage: `🎉 Hoàn thành ngày học thứ ${nextDay}/30! Streak tăng lên ${nextStreak} ngày 🔥 (Còn ${30 - nextDay} ngày nữa sẽ hồi 4 mạng).`
      };
    });
  };

  // Giả lập tua nhanh 30 ngày (Kiểm tra cơ chế Reset 4 Mạng)
  const handleSimulateFastForward30Days = () => {
    setMascot((prev) => ({
      ...prev,
      cycleDay: 1,
      remainingLives: 4, // TỰ ĐỘNG RESET VỀ 4 MẠNG
      energy: 100,
      streakDays: prev.streakDays + 30,
      totalDaysTracked: (prev.totalDaysTracked || 0) + 30,
      cycleStartDate: new Date().toISOString(),
      lastResetDate: new Date().toISOString(),
      statusMessage: '⚡ ĐÃ TUA NHANH 30 NGÀY: Hệ thống kích hoạt cơ chế Reset định kỳ, khôi phục thành công 4/4 Mạng bảo vệ!'
    }));
  };

  // Reset thủ công chu kỳ và số mạng
  const handleResetMonthShields = () => {
    setMascot((prev) => ({
      ...prev,
      cycleDay: 1,
      remainingLives: 4,
      cycleStartDate: new Date().toISOString(),
      lastResetDate: new Date().toISOString(),
      statusMessage: '🛡️ Đã làm mới chu kỳ 30 ngày và khôi phục 4 Mạng bảo vệ Streak!'
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
            <h2 className="text-xl font-bold text-slate-100">Linh Vật Năng Lượng (Energy Mascot "Eddy")</h2>
            <p className="text-xs text-slate-400 mt-1">
              Bộ đếm chu kỳ 30 ngày: Sau mỗi 30 ngày, hệ thống sẽ <strong>tự động phục hồi 4 mạng</strong> bất kể trước đó còn bao nhiêu mạng.
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-4">
          {/* Day Cycle Counter */}
          <div className="flex items-center space-x-2 bg-slate-950 p-3 rounded-xl border border-slate-800">
            <Calendar className="w-5 h-5 text-blue-400" />
            <div className="text-right">
              <div className="text-lg font-black font-mono text-blue-300">{currentCycleDay} / 30</div>
              <div className="text-[9px] uppercase text-slate-400 font-mono">Ngày Trong Chu Kỳ</div>
            </div>
          </div>

          {/* Streak Counter */}
          <div className="flex items-center space-x-2 bg-slate-950 p-3 rounded-xl border border-slate-800">
            <Flame className="w-5 h-5 text-orange-500 fill-orange-500 animate-bounce" />
            <div className="text-right">
              <div className="text-lg font-black font-mono text-slate-100">{mascot.streakDays} Ngày</div>
              <div className="text-[9px] uppercase text-slate-400 font-mono">Streak Liên Tục</div>
            </div>
          </div>
        </div>
      </div>

      {/* 30-Day Cycle Progress Bar Header */}
      <div className="bg-slate-900/80 p-5 rounded-2xl border border-slate-800 space-y-2.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs font-mono gap-1">
          <div className="flex items-center space-x-2 text-slate-300">
            <Calendar className="w-4 h-4 text-blue-400" />
            <span>Tiến độ chu kỳ 30 ngày: <strong className="text-blue-400">Ngày {currentCycleDay} / 30</strong></span>
            <span className="text-[10px] text-slate-400 bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
              Đồng hồ máy: {mascot.lastActiveDate || new Date().toISOString().split('T')[0]}
            </span>
          </div>
          <span className="text-amber-400 font-medium">
            ⏳ Còn <strong>{daysLeftInCycle} ngày</strong> nữa sẽ tự động reset về 4 Mạng
          </span>
        </div>

        <div className="w-full h-3 bg-slate-950 rounded-full overflow-hidden p-0.5 border border-slate-800">
          <div
            className="h-full bg-gradient-to-r from-blue-600 via-indigo-500 to-emerald-400 rounded-full transition-all duration-500"
            style={{ width: `${Math.min(100, (currentCycleDay / 30) * 100)}%` }}
          />
        </div>

        <div className="flex justify-between text-[10px] text-slate-500 font-mono">
          <span>Ngày 1 (Khởi tạo 4 Mạng)</span>
          <span>Ngày 15 (Giữa chu kỳ)</span>
          <span>Ngày 30 (Tự động Reset 4 Mạng)</span>
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
              <span className="text-slate-400">Năng lượng Eddy:</span>
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
              Nếu bạn bận đột xuất hoặc quên 1 buổi học, lá chắn mạng sẽ tự động tiêu hao để bảo vệ chuỗi Streak. Sau 30 ngày, 4 mạng sẽ được tự động làm mới.
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
                    <span className="text-[10px] font-mono text-slate-500">Mạng {lifeNum}</span>
                  </div>
                );
              })}
            </div>

            <div className="text-[11px] text-slate-400 bg-slate-950 p-2.5 rounded-lg border border-slate-800 flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 text-blue-400 flex-shrink-0" />
              <span>
                Hiện tại còn <strong className="text-blue-300">{mascot.remainingLives} / 4 Mạng</strong>. Đang ở ngày <strong>{currentCycleDay}/30</strong>.
              </span>
            </div>
          </div>

          {/* Interactive Simulation Panel */}
          <div className="bg-slate-900/80 p-6 rounded-2xl border border-slate-800 space-y-3">
            <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">Thử nghiệm Bộ đếm & Reset 30 Ngày:</h4>

            {/* Advance 1 Day */}
            <button
              onClick={handleSimulateAdvanceOneDay}
              className="w-full py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs rounded-xl shadow transition flex items-center justify-center space-x-2 cursor-pointer active:scale-95"
            >
              <Sparkles className="w-4 h-4" />
              <span>Tiến thêm +1 Ngày (+1 Streak, Tăng Ngày {currentCycleDay} → {currentCycleDay >= 30 ? 1 : currentCycleDay + 1})</span>
            </button>

            {/* Fast Forward 30 Days */}
            <button
              onClick={handleSimulateFastForward30Days}
              className="w-full py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs rounded-xl shadow transition flex items-center justify-center space-x-2 cursor-pointer active:scale-95"
            >
              <FastForward className="w-4 h-4" />
              <span>Tua nhanh +30 Ngày (Kích hoạt Tự động Reset 4 Mạng)</span>
            </button>

            {/* Miss Break (-1 Life) */}
            <button
              onClick={handleSimulateMissedBreak}
              className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 text-xs font-medium rounded-xl transition flex items-center justify-center space-x-2 cursor-pointer active:scale-95"
            >
              <ShieldAlert className="w-4 h-4 text-amber-400" />
              <span>Giả lập: Bỏ lỡ buổi học (-1 Mạng)</span>
            </button>

            {/* Manual Reset */}
            <button
              onClick={handleResetMonthShields}
              className="w-full py-2 text-slate-400 hover:text-slate-200 text-[11px] font-mono flex items-center justify-center space-x-1 cursor-pointer"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Làm mới chu kỳ và phục hồi 4 Mạng ngay</span>
            </button>
          </div>

        </div>

      </div>
    </div>
  );
};


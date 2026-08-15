import React from 'react';
import { Wind, Timer, EyeOff, Flame, Activity } from 'lucide-react';

export const Navigation = ({ activeTab, setActiveTab }) => {
  const tabs = [
    {
      id: 'bio_reset',
      label: '30s Bio Reset',
      desc: 'Khởi động sinh học',
      icon: Wind,
      badge: 'Start'
    },
    {
      id: 'focus',
      label: 'Focus & Eye Guard',
      desc: 'Giờ học & Bảo vệ mắt',
      icon: Timer,
      badge: 'Live'
    },
    {
      id: 'blind_break',
      label: 'Blind Break',
      desc: 'Nghỉ không màn hình',
      icon: EyeOff,
      badge: 'Audio'
    },
    {
      id: 'mascot',
      label: 'Mascot & Streak',
      desc: 'Linh vật & 4 Mạng',
      icon: Flame,
      badge: 'Streak'
    },
    {
      id: 'analytics',
      label: 'Fatigue Analytics',
      desc: 'Chỉ số mệt mỏi AI',
      icon: Activity,
      badge: 'AI'
    }
  ];

  return (
    <nav className="w-full bg-slate-950 border-b border-slate-800 px-4 pt-2 flex space-x-1 overflow-x-auto scrollbar-none select-none">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center space-x-2.5 px-4 py-2.5 rounded-t-xl border-t border-x text-xs font-medium transition-all relative whitespace-nowrap group ${
              isActive
                ? 'bg-slate-900 border-slate-700 text-blue-400 font-semibold shadow-lg shadow-black/40'
                : 'bg-slate-950/60 border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/40'
            }`}
          >
            <Icon className={`w-4 h-4 transition-transform group-hover:scale-110 ${isActive ? 'text-blue-400' : 'text-slate-500'}`} />
            <div className="text-left">
              <div className="flex items-center space-x-1.5">
                <span className={isActive ? 'text-slate-100' : 'text-slate-300'}>{tab.label}</span>
                {tab.badge && (
                  <span className={`text-[9px] px-1 py-0.2 rounded font-mono ${
                    isActive ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30' : 'bg-slate-800 text-slate-500'
                  }`}>
                    {tab.badge}
                  </span>
                )}
              </div>
              <span className="text-[10px] text-slate-500 block leading-tight">{tab.desc}</span>
            </div>

            {/* Bottom active highlight line */}
            {isActive && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-blue-500 to-emerald-400 rounded-full" />
            )}
          </button>
        );
      })}
    </nav>
  );
};

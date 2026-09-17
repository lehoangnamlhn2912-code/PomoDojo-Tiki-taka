import React from 'react';
import { HelpCircle, Dumbbell, Moon, Sparkles, X, Coffee, Clock } from 'lucide-react';

export const BreakChoiceModal = ({
  isOpen,
  onClose,
  onSelectChoice,
  currentCycle = 1,
  totalCycles = 4,
  breakMinutes = 5,
  secondsLeft = 300,
  formatTime = (s) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`
}) => {
  if (!isOpen) return null;

  const choices = [
    {
      id: 'blind_break',
      title: 'Blind Break',
      subtitle: 'Questions & Physical Movement',
      desc: 'Listen to curated audio questions and perform body movements (or click) to select answers.',
      icon: HelpCircle,
      badge: 'Interactive',
      gradient: 'from-indigo-600 to-purple-600',
      borderHover: 'hover:border-indigo-400 hover:bg-indigo-950/30'
    },
    {
      id: 'pure_movement',
      title: 'Pure Movement',
      subtitle: 'Cam & Skeleton Guidance Only',
      desc: 'No questions or quizzes. Only live webcam posture tracking with AI voice coaching for arm raises, squats, and arm curls.',
      icon: Dumbbell,
      badge: 'Exercise Only',
      gradient: 'from-cyan-600 to-blue-600',
      borderHover: 'hover:border-cyan-400 hover:bg-cyan-950/30'
    },
    {
      id: 'visual_rest',
      title: 'Visual Rest',
      subtitle: '50% Screen Darkening Overlay',
      desc: 'Dims the entire screen by 50% throughout the break. Look away from the display to let your ciliary eye muscles recover.',
      icon: Moon,
      badge: 'Deep Eye Rest',
      gradient: 'from-emerald-600 to-teal-600',
      borderHover: 'hover:border-emerald-400 hover:bg-emerald-950/30'
    }
  ];

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[99999] flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-2xl p-6 sm:p-8 space-y-6 shadow-2xl relative">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center space-x-3.5">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 flex-shrink-0">
              <Coffee className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-[10px] font-mono uppercase tracking-widest text-emerald-400 font-bold bg-emerald-950 px-2 py-0.5 rounded border border-emerald-500/30">
                  Focus Complete
                </span>
                <span className="text-xs font-mono text-slate-300">
                  Cycle {currentCycle} of {totalCycles}
                </span>
              </div>
              <h3 className="text-lg font-black text-white mt-1">Choose Your Break Style</h3>
              <p className="text-xs text-slate-400">
                You have {formatTime(secondsLeft)} of scheduled break time. Pick how you want to recharge.
              </p>
            </div>
          </div>

          {onClose && (
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white p-2 rounded-xl hover:bg-slate-800 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* 3 Choice Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {choices.map((choice) => {
            const Icon = choice.icon;
            return (
              <div
                key={choice.id}
                onClick={() => onSelectChoice(choice.id)}
                className={`p-5 rounded-2xl border border-slate-800 bg-slate-950/80 cursor-pointer transition-all duration-200 flex flex-col justify-between space-y-4 group ${choice.borderHover} hover:scale-[1.02] shadow-lg`}
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div
                      className={`w-10 h-10 rounded-xl bg-gradient-to-br ${choice.gradient} flex items-center justify-center text-white shadow-md`}
                    >
                      <Icon className="w-5 h-5" />
                    </div>
                    <span className="text-[10px] font-mono uppercase font-bold text-slate-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                      {choice.badge}
                    </span>
                  </div>

                  <div>
                    <h4 className="text-sm font-black text-white group-hover:text-cyan-300 transition">
                      {choice.title}
                    </h4>
                    <div className="text-[11px] font-medium text-indigo-300/80 mt-0.5">
                      {choice.subtitle}
                    </div>
                    <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                      {choice.desc}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  className={`w-full py-2 bg-gradient-to-r ${choice.gradient} text-white font-bold text-xs rounded-xl shadow-md transition transform active:scale-95 cursor-pointer flex items-center justify-center space-x-1.5`}
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Start {choice.title}</span>
                </button>
              </div>
            );
          })}
        </div>

        {/* Footer Hint */}
        <div className="text-center text-[11px] text-slate-500 font-mono">
          Tip: You can switch between break styles at any time using the "Change Break" button.
        </div>
      </div>
    </div>
  );
};

import React from 'react';
import { 
  CheckCircle2, 
  AlertTriangle, 
  AlertOctagon, 
  EyeOff
} from 'lucide-react';

export const EyeTrackingOverlay = ({
  eyeData,
  inferenceMode = 'mediapipe_pnp',
  fps = 30
}) => {
  const { 
    detected, 
    distance_cm,
    status 
  } = eyeData;

  // Status Badge visual styling
  const getStatusDisplay = () => {
    if (!detected || status === 'unknown') {
      return {
        color: 'text-slate-400',
        bgColor: 'bg-slate-950/85 border-slate-700',
        label: 'DETECTING FACE & EYES...',
        icon: EyeOff
      };
    }

    if (status === 'danger') {
      return {
        color: 'text-red-400',
        bgColor: 'bg-red-950/90 border-red-500',
        label: 'DANGER: TOO CLOSE (<35cm)',
        icon: AlertOctagon
      };
    }

    if (status === 'warning') {
      return {
        color: 'text-amber-400',
        bgColor: 'bg-amber-950/85 border-amber-500/50',
        label: 'SLIGHTLY CLOSE (<50cm)',
        icon: AlertTriangle
      };
    }

    return {
      color: 'text-emerald-400',
      bgColor: 'bg-emerald-950/85 border-emerald-500/50',
      label: 'SAFE EYE DISTANCE (OPTIMAL)',
      icon: CheckCircle2
    };
  };

  const currentTheme = getStatusDisplay();
  const StatusIcon = currentTheme.icon;

  return (
    <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-3 select-none overflow-hidden">
      
      {/* Top Bar: Status Badge, Distance Metric & Telemetry */}
      <div className="flex items-center justify-between pointer-events-auto space-x-2">
        
        {/* Status Badge & Distance Display */}
        <div className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg border backdrop-blur-md transition-colors duration-200 ${currentTheme.bgColor}`}>
          <StatusIcon className={`w-4 h-4 ${currentTheme.color} flex-shrink-0`} />
          <span className={`text-[11px] font-mono font-bold tracking-tight ${currentTheme.color}`}>
            {currentTheme.label}
          </span>
          {detected && distance_cm !== null && distance_cm !== undefined && (
            <span className="text-[11px] font-mono px-2 py-0.5 bg-black/70 text-cyan-300 rounded font-black border border-cyan-500/40">
              {distance_cm} cm
            </span>
          )}
        </div>

        {/* Telemetry info */}
        <div className="flex items-center space-x-2 text-[10px] font-mono text-slate-300 bg-slate-950/85 backdrop-blur px-2.5 py-1.5 rounded-lg border border-slate-800">
          <span className="text-emerald-400">MediaPipe 3D</span>
          <span className="text-slate-700">|</span>
          <span className="text-slate-400">{fps} FPS</span>
        </div>
      </div>

      {/* Bottom Floating Telemetry Panel */}
      <div className="flex items-center justify-between pointer-events-auto bg-slate-950/90 backdrop-blur-md p-2.5 rounded-xl border border-slate-800 text-[11px] font-mono shadow-lg">
        
        {/* Metrics readout */}
        <div className="flex items-center space-x-4 text-slate-300">
          <div>
            <span className="text-slate-500">Screen Distance: </span>
            {detected && distance_cm !== null ? (
              <span className="text-cyan-300 font-bold text-xs">{distance_cm} cm</span>
            ) : (
              <span className="text-slate-500">Searching face...</span>
            )}
          </div>
          <div className="hidden sm:block">
            <span className="text-slate-500">Safe Zone: </span>
            <span className="text-emerald-400 font-semibold">≥ 50 cm</span>
          </div>
        </div>

        {/* Real-time Status Pill */}
        <div className="flex items-center space-x-2 text-[10px]">
          {!detected ? (
            <span className="px-2.5 py-0.5 rounded font-bold bg-slate-900 text-slate-400 border border-slate-700">
              SEARCHING FACE
            </span>
          ) : distance_cm && distance_cm < 35 ? (
            <span className="px-2.5 py-0.5 rounded font-bold bg-red-950 text-red-400 border border-red-500/50 animate-pulse">
              ⚠️ TOO CLOSE (&lt;35cm)
            </span>
          ) : distance_cm && distance_cm < 50 ? (
            <span className="px-2.5 py-0.5 rounded font-bold bg-amber-950 text-amber-400 border border-amber-500/50">
              ⚠️ CLOSE (&lt;50cm)
            </span>
          ) : (
            <span className="px-2.5 py-0.5 rounded font-bold bg-emerald-950 text-emerald-300 border border-emerald-500/50">
              ✓ SAFE DISTANCE
            </span>
          )}
        </div>

      </div>

    </div>
  );
};

import React from 'react';
import { 
  Crosshair, 
  CheckCircle2, 
  AlertTriangle, 
  AlertOctagon, 
  HelpCircle, 
  Compass, 
  RotateCcw,
  Sparkles,
  Zap,
  Move3d,
  Eye
} from 'lucide-react';

export const EyeTrackingOverlay = ({
  eyeData,
  videoRef,
  inferenceMode = 'mediapipe_pnp',
  fps = 30
}) => {
  const { 
    detected, 
    eye_boxes, 
    eye_labels, 
    distance_cm,
    eye_box_size, 
    pose,
    ear,
    status 
  } = eyeData;

  const videoElement = videoRef?.current;
  const videoWidth = videoElement?.videoWidth || 640;
  const videoHeight = videoElement?.videoHeight || 480;

  // Status Badge visual styling
  const statusConfig = {
    safe: {
      color: 'text-emerald-400',
      bgColor: 'bg-emerald-950/80 border-emerald-500/50',
      boxBorder: 'border-emerald-400',
      label: 'KHOẢNG CÁCH AN TOÀN (SAFE)',
      icon: CheckCircle2
    },
    warning: {
      color: 'text-amber-400',
      bgColor: 'bg-amber-950/80 border-amber-500/50',
      boxBorder: 'border-amber-400',
      label: 'HƠI GẦN MÀN HÌNH (WARNING)',
      icon: AlertTriangle
    },
    danger: {
      color: 'text-red-400',
      bgColor: 'bg-red-950/90 border-red-500',
      boxBorder: 'border-red-500 animate-pulse',
      label: 'NGUY HIỂM: QUÁ SÁT MÀN HÌNH (DANGER)',
      icon: AlertOctagon
    },
    unknown: {
      color: 'text-slate-400',
      bgColor: 'bg-slate-950/70 border-slate-700',
      boxBorder: 'border-slate-500',
      label: 'ĐANG TÌM GƯƠNG MẶT & MẮT...',
      icon: HelpCircle
    }
  };

  const currentTheme = statusConfig[status] || statusConfig.unknown;
  const StatusIcon = currentTheme.icon;

  return (
    <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-3 select-none overflow-hidden">
      
      {/* Top Bar: Inference Mode, Status Badge, 3D Distance Metric & FPS */}
      <div className="flex items-center justify-between pointer-events-auto space-x-2">
        
        {/* Status Badge & Distance Display */}
        <div className={`flex items-center space-x-2 px-2.5 py-1 rounded-lg border backdrop-blur-md ${currentTheme.bgColor}`}>
          <StatusIcon className={`w-3.5 h-3.5 ${currentTheme.color}`} />
          <span className={`text-[11px] font-mono font-bold ${currentTheme.color}`}>
            {currentTheme.label}
          </span>
          {distance_cm !== null && distance_cm !== undefined && (
            <span className="text-[11px] font-mono px-2 py-0.5 bg-black/60 text-cyan-300 rounded font-black border border-cyan-500/30">
              {distance_cm} cm
            </span>
          )}
        </div>

        {/* Real-time Telemetry & Mode Info */}
        <div className="flex items-center space-x-2 text-[10px] font-mono text-slate-300 bg-slate-950/80 backdrop-blur px-2.5 py-1 rounded-lg border border-slate-800">
          <span className="flex items-center space-x-1 text-cyan-400">
            <Move3d className="w-3 h-3" />
            <span>{inferenceMode === 'mediapipe_pnp' ? 'MEDIAPIPE-3D-PNP' : 'OPTICAL-AI'}</span>
          </span>
          <span className="text-slate-600">|</span>
          {pose && (
            <>
              <span className="text-slate-400">Yaw: {pose.yaw}°</span>
              <span className="text-slate-600">|</span>
            </>
          )}
          <span className="text-emerald-400">{fps} FPS</span>
        </div>
      </div>

      {/* Render High-Precision Eye Bounding Boxes on Mirrored Webcam Feed */}
      {detected && eye_boxes && eye_boxes.length > 0 && (
        <div className="absolute inset-0 pointer-events-none">
          {eye_boxes.map((box, idx) => {
            const [x1, y1, x2, y2] = box;
            const label = eye_labels && eye_labels[idx] ? eye_labels[idx] : 'open_eye';
            const isClosed = label.includes('closed') || (ear && ear.isEyeClosed);

            const width = Math.abs(x2 - x1);
            const height = Math.abs(y2 - y1);

            // Convert to percentage of video canvas dimensions
            const leftPercent = (x1 / videoWidth) * 100;
            const topPercent = (y1 / videoHeight) * 100;
            const widthPercent = (width / videoWidth) * 100;
            const heightPercent = (height / videoHeight) * 100;

            // Invert X coordinate for mirrored user webcam feed
            const mirroredLeftPercent = 100 - (leftPercent + widthPercent);

            return (
              <div
                key={idx}
                className={`absolute border-2 rounded-lg transition-all duration-75 shadow-lg ${
                  isClosed ? 'border-amber-400 bg-amber-500/15' : currentTheme.boxBorder
                }`}
                style={{
                  left: `${mirroredLeftPercent}%`,
                  top: `${topPercent}%`,
                  width: `${widthPercent}%`,
                  height: `${heightPercent}%`,
                }}
              >
                {/* Crosshair Target Corners */}
                <div className="w-1.5 h-1.5 bg-white absolute -top-1 -left-1 rounded-full shadow" />
                <div className="w-1.5 h-1.5 bg-white absolute -top-1 -right-1 rounded-full shadow" />
                <div className="w-1.5 h-1.5 bg-white absolute -bottom-1 -left-1 rounded-full shadow" />
                <div className="w-1.5 h-1.5 bg-white absolute -bottom-1 -right-1 rounded-full shadow" />

                {/* Eye Box & State Label */}
                <span className={`absolute -top-5 left-0 text-[9px] font-mono px-1.5 py-0.5 rounded whitespace-nowrap border shadow-sm ${
                  isClosed 
                    ? 'bg-amber-950 text-amber-300 border-amber-500' 
                    : 'bg-emerald-950/90 text-emerald-300 border-emerald-500/40'
                }`}>
                  {isClosed ? '👁️ NHẮM MẮT (CLOSED)' : `MẮT ${idx === 0 ? 'TRÁI' : 'PHẢI'}`} ({distance_cm || 50}cm)
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Center Target Guide if face is currently not found */}
      {!detected && (
        <div className="relative mx-auto w-36 h-24 border border-dashed border-cyan-500/40 rounded-xl flex flex-col items-center justify-center animate-pulse bg-black/30 backdrop-blur-xs">
          <Crosshair className="w-6 h-6 text-cyan-400 mb-1 animate-spin" />
          <span className="text-[10px] font-mono text-cyan-300">Đang quét 478 3D Landmarks...</span>
        </div>
      )}

      {/* Bottom Floating Metrics Telemetry Panel */}
      <div className="flex items-center justify-between pointer-events-auto bg-slate-950/85 backdrop-blur-md p-2 rounded-xl border border-slate-800 text-[11px] font-mono">
        
        {/* Metrics readout */}
        <div className="flex items-center space-x-3 text-slate-300">
          <div>
            <span className="text-slate-500">Khoảng cách PnP: </span>
            <span className="text-cyan-400 font-bold">{distance_cm !== null ? `${distance_cm} cm` : '--'}</span>
          </div>
          <div>
            <span className="text-slate-500">Chuẩn an toàn: </span>
            <span className="text-emerald-400 font-bold">≥ 50 cm</span>
          </div>
          {ear && (
            <div className="hidden sm:block">
              <span className="text-slate-500">EAR: </span>
              <span className={`font-bold ${ear.isEyeClosed ? 'text-amber-400' : 'text-emerald-400'}`}>
                {ear.avg}
              </span>
            </div>
          )}
        </div>

        {/* Real-time Status Indicator */}
        <div className="flex items-center space-x-2 text-[10px]">
          <span className={`px-2 py-0.5 rounded font-bold ${
            distance_cm && distance_cm < 35 
              ? 'bg-red-950 text-red-400 border border-red-500/40'
              : distance_cm && distance_cm < 50
              ? 'bg-amber-950 text-amber-400 border border-amber-500/40'
              : 'bg-emerald-950 text-emerald-400 border border-emerald-500/40'
          }`}>
            {distance_cm && distance_cm < 35 ? '⚠️ QUÁ GẦN (<35cm)' : distance_cm && distance_cm < 50 ? '⚠️ CẢNH BÁO (<50cm)' : '✓ TỐT (≥50cm)'}
          </span>
        </div>

      </div>

    </div>
  );
};

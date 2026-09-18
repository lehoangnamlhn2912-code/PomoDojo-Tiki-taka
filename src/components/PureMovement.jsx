import React, { useState, useEffect, useRef } from 'react';
import {
  Camera,
  CameraOff,
  Dumbbell,
  Zap,
  Clock,
  Square,
  Sparkles,
  Volume2,
  VolumeX,
  RotateCcw,
  CheckCircle2,
  Activity,
  ArrowRightLeft,
  ChevronRight
} from 'lucide-react';
import { audioEngine } from '../utils/audioEngine.js';
import { poseDetector } from '../services/poseDetector.js';

const EXERCISES = [
  {
    id: 'overhead_reach',
    name: 'Overhead Reach',
    instruction: 'Raise both arms straight up towards the sky and stretch your spine.',
    benefit: 'Decompresses spinal vertebrae and counters prolonged slouching'
  },
  {
    id: 'neck_up',
    name: 'Neck Extension (Look Up)',
    instruction: 'Gently tilt your head back to look upward towards the ceiling.',
    benefit: 'Directly counters forward head posture (Tech Neck)'
  },
  {
    id: 'shoulder_shrug',
    name: 'Shoulder Shrug',
    instruction: 'Lift both shoulders up towards your ears, hold, then relax.',
    benefit: 'Releases deep trapezius tension from keyboard and mouse use'
  },
  {
    id: 'neck_tilt',
    name: 'Neck Tilt (Ear to Shoulder)',
    instruction: 'Tilt your head to the side, bringing your ear towards your shoulder.',
    benefit: 'Lengthens tight lateral cervical muscles'
  },
  {
    id: 'neck_turn',
    name: 'Neck Turn (Look Left/Right)',
    instruction: 'Slowly turn your head to look comfortably over your shoulder.',
    benefit: 'Restores natural cervical rotation and eases neck stiffness'
  },
  {
    id: 'arm_cross',
    name: 'Chest Hug (Arms Crossed)',
    instruction: 'Cross both arms across your chest as if giving yourself a hug.',
    benefit: 'Expands the posterior shoulder blades and upper thoracic spine'
  },
  {
    id: 'lateral_raise',
    name: 'Lateral Arm Raise',
    instruction: 'Raise both arms out sideways to shoulder height and hold.',
    benefit: 'Relieves shoulder tension and opens upper chest'
  },
  {
    id: 'hammer_curl',
    name: 'Bicep Curl Hold',
    instruction: 'Bend your elbows upward bringing hands toward chest.',
    benefit: 'Engages arms and improves forearm posture'
  },
  {
    id: 'squat',
    name: 'Squat Hold',
    instruction: 'Bend your knees into a gentle squat and hold steady.',
    benefit: 'Activates lower body muscles and boosts blood circulation'
  }
];

export const PureMovement = ({
  cameraEnabled,
  setCameraEnabled,
  cameraStream,
  setCameraStream,
  onOpenPermissionModal,
  onFinishBreak,
  secondsLeft,
  currentCycle = 1,
  totalCycles = 4,
  onChangeBreakStyle,
  onStopSessionEarly,
  formatTime = (s) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`
}) => {
  const [currentExerciseIndex, setCurrentExerciseIndex] = useState(0);
  const [poseHoldProgress, setPoseHoldProgress] = useState(0);
  const [repsCompleted, setRepsCompleted] = useState(0);
  const [detectedPoseName, setDetectedPoseName] = useState('Scanning posture...');
  const [speechEnabled, setSpeechEnabled] = useState(true);
  const [isActivatingCam, setIsActivatingCam] = useState(false);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const animFrameRef = useRef(null);
  const poseHoldTrackerRef = useRef({ pose: null, startTime: 0 });
  const lastInstructionRef = useRef(null);

  const currentExercise = EXERCISES[currentExerciseIndex];

  // AI Voice Guide announcement for the current movement
  const speakInstruction = () => {
    if (!speechEnabled) return;
    const text = `Pure Movement Break: Perform ${currentExercise.name}. ${currentExercise.instruction}`;
    audioEngine.speakQuestion(text, null, 'en');
  };

  // Announce when exercise changes
  useEffect(() => {
    if (lastInstructionRef.current !== currentExercise.id) {
      lastInstructionRef.current = currentExercise.id;
      speakInstruction();
    }
  }, [currentExerciseIndex, speechEnabled]);

  // Bind camera stream to video element
  useEffect(() => {
    const video = videoRef.current;
    if (video) {
      if (cameraEnabled && cameraStream) {
        video.srcObject = cameraStream;
        video.play().catch((err) => {
          console.warn('Pure movement video stream play error:', err);
        });
      } else {
        video.srcObject = null;
      }
    }
  }, [cameraEnabled, cameraStream]);

  // Direct camera activation handler
  const handleEnableCameraDirect = async () => {
    setIsActivatingCam(true);
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera API not supported');
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' }
      });
      if (setCameraStream) setCameraStream(stream);
      if (setCameraEnabled) setCameraEnabled(true);
    } catch (err) {
      console.warn('Camera enable error in PureMovement:', err);
      if (onOpenPermissionModal) onOpenPermissionModal();
    } finally {
      setIsActivatingCam(false);
    }
  };

  // Continuous Camera Pose Estimation Loop
  useEffect(() => {
    let isRunning = true;

    if (!cameraEnabled) {
      setDetectedPoseName('Camera is off • Turn on camera to track exercises');
      setPoseHoldProgress(0);
      return;
    }

    const runPoseLoop = () => {
      if (!isRunning) return;

      if (videoRef.current && videoRef.current.readyState >= 2) {
        const video = videoRef.current;
        const result = poseDetector.detectPose(video);

        // Draw Skeleton onto canvas overlay
        if (canvasRef.current) {
          const canvas = canvasRef.current;
          const ctx = canvas.getContext('2d');
          if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
            canvas.width = video.videoWidth || 640;
            canvas.height = video.videoHeight || 480;
          }
          ctx.clearRect(0, 0, canvas.width, canvas.height);

          if (result.detected && result.landmarks) {
            ctx.lineWidth = 4;
            ctx.strokeStyle = '#38bdf8'; // Cyan-400
            const connections = [
              [11, 12], [11, 13], [13, 15], [12, 14], [14, 16],
              [11, 23], [12, 24], [23, 24],
              [23, 25], [25, 27], [24, 26], [26, 28]
            ];

            connections.forEach(([i, j]) => {
              const p1 = result.landmarks[i];
              const p2 = result.landmarks[j];
              if (p1 && p2 && p1.visibility > 0.4 && p2.visibility > 0.4) {
                ctx.beginPath();
                ctx.moveTo(p1.x * canvas.width, p1.y * canvas.height);
                ctx.lineTo(p2.x * canvas.width, p2.y * canvas.height);
                ctx.stroke();
              }
            });

            result.landmarks.forEach((p, idx) => {
              if (
                p.visibility > 0.4 &&
                [11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28].includes(idx)
              ) {
                ctx.beginPath();
                ctx.arc(p.x * canvas.width, p.y * canvas.height, 6, 0, 2 * Math.PI);
                ctx.fillStyle = '#22c55e';
                ctx.fill();
              }
            });
          }
        }

        // Check if recognized exercise matches current exercise
        if (result.detected && result.recognizedExercise === currentExercise.id) {
          setDetectedPoseName(`${currentExercise.name} detected! Holding...`);
          const now = performance.now();
          if (poseHoldTrackerRef.current.pose !== currentExercise.id) {
            poseHoldTrackerRef.current = { pose: currentExercise.id, startTime: now };
            setPoseHoldProgress(10);
          } else {
            const elapsed = now - poseHoldTrackerRef.current.startTime;
            const progress = Math.min(100, Math.round((elapsed / 1500) * 100));
            setPoseHoldProgress(progress);

            if (elapsed >= 1500) {
              // Successfully held for 1.5s!
              audioEngine.playSuccessSound();
              setRepsCompleted((r) => r + 1);
              setPoseHoldProgress(0);
              poseHoldTrackerRef.current = { pose: null, startTime: 0 };

              // Switch to next exercise
              setCurrentExerciseIndex((idx) => (idx + 1) % EXERCISES.length);
              if (speechEnabled) {
                audioEngine.speakQuestion('Rep completed! Great job.', null, 'en');
              }
            }
          }
        } else {
          poseHoldTrackerRef.current = { pose: null, startTime: 0 };
          setPoseHoldProgress(0);
          if (result.detected) {
            setDetectedPoseName(result.exerciseName || 'Analyzing movement...');
          } else {
            setDetectedPoseName('Step back so the camera can see your full upper body');
          }
        }
      }

      animFrameRef.current = requestAnimationFrame(runPoseLoop);
    };

    animFrameRef.current = requestAnimationFrame(runPoseLoop);

    return () => {
      isRunning = false;
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [cameraEnabled, cameraStream, currentExercise, speechEnabled]);

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      {/* Top Banner with Break Countdown & Cycle Status */}
      <div className="bg-gradient-to-r from-cyan-950 via-slate-900 to-blue-950 p-6 rounded-2xl border border-cyan-500/30 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xl">
        <div className="flex items-center space-x-4">
          <div className="w-12 h-12 rounded-xl bg-cyan-500/20 border border-cyan-400/30 flex items-center justify-center text-cyan-400 flex-shrink-0 shadow-inner">
            <Activity className="w-6 h-6 animate-pulse text-cyan-300" />
          </div>
          <div>
            <div className="flex items-center space-x-2 flex-wrap gap-y-1">
              <span className="text-[10px] font-mono uppercase tracking-widest text-cyan-400 font-bold bg-cyan-950/80 px-2 py-0.5 rounded border border-cyan-500/30">
                Pure Movement Break
              </span>
              <span className="text-[10px] font-mono uppercase tracking-widest text-slate-300 font-bold">
                Cycle {currentCycle} / {totalCycles} • Camera Motion Only
              </span>
            </div>
            <h2 className="text-xl font-bold text-slate-100 mt-0.5">Guided Movement & Pose Tracking</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              No questions or tests. Move your body following the AI voice coach to relieve screen stiffness.
            </p>
          </div>
        </div>

        {/* Break Remaining Countdown & Controls */}
        <div className="flex items-center space-x-3 self-end md:self-auto">
          <div className="flex items-center space-x-2.5 bg-slate-950 p-2.5 px-3.5 rounded-xl border border-slate-800">
            <Clock className="w-4 h-4 text-cyan-400 animate-pulse" />
            <div className="text-xs font-mono">
              <div className="text-[10px] text-slate-400 uppercase font-semibold">Break Remaining</div>
              <div className="text-cyan-400 font-black text-sm">{formatTime(secondsLeft)}</div>
            </div>
          </div>

          {onFinishBreak && (
            <button
              onClick={onFinishBreak}
              className="px-3 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-bold text-xs rounded-xl transition flex items-center space-x-1.5 cursor-pointer shadow-md active:scale-95"
              title="Finish break and return to focus"
            >
              <ChevronRight className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Return to Focus</span>
            </button>
          )}

          <button
            onClick={onChangeBreakStyle}
            className="px-3 py-2 bg-slate-950 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-white font-bold text-xs rounded-xl transition flex items-center space-x-1.5 cursor-pointer shadow-md"
            title="Switch to Blind Break or Visual Rest"
          >
            <ArrowRightLeft className="w-3.5 h-3.5 text-cyan-400" />
            <span className="hidden sm:inline">Change Break</span>
          </button>

          {onStopSessionEarly && (
            <button
              onClick={onStopSessionEarly}
              className="px-3 py-2 bg-red-950/80 hover:bg-red-900 border border-red-500/50 text-red-200 font-bold text-xs rounded-xl transition flex items-center space-x-1.5 cursor-pointer active:scale-95 shadow-lg shadow-red-950/30"
              title="Stop Session Early"
            >
              <Square className="w-3.5 h-3.5 fill-red-400 text-red-400" />
              <span className="hidden sm:inline">Stop</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Movement Arena */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left: Large Live Camera Feed with Skeleton */}
        <div className="lg:col-span-8 bg-slate-900/90 rounded-2xl border border-slate-800 p-5 space-y-4 shadow-2xl">
          <div className="flex items-center justify-between text-xs font-bold text-slate-300">
            <div className="flex items-center space-x-2">
              {cameraEnabled ? (
                <Camera className="w-4 h-4 text-emerald-400" />
              ) : (
                <CameraOff className="w-4 h-4 text-amber-400" />
              )}
              <span>Live Posture & Skeleton Tracker</span>
            </div>

            <button
              onClick={onOpenPermissionModal}
              className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-mono transition cursor-pointer"
            >
              Camera Settings
            </button>
          </div>

          <div className="relative w-full aspect-video bg-black rounded-2xl overflow-hidden border border-slate-800 flex items-center justify-center shadow-inner">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className={`w-full h-full object-cover transform -scale-x-100 ${
                !cameraEnabled ? 'hidden' : 'block'
              }`}
            />
            <canvas
              ref={canvasRef}
              className={`absolute inset-0 w-full h-full object-cover transform -scale-x-100 pointer-events-none ${
                !cameraEnabled ? 'hidden' : 'block'
              }`}
            />

            {!cameraEnabled && (
              <div className="absolute inset-0 bg-slate-950/95 flex flex-col items-center justify-center p-6 text-center space-y-3 z-10">
                <div className="w-14 h-14 rounded-2xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400">
                  <CameraOff className="w-7 h-7" />
                </div>
                <div className="space-y-1 max-w-sm">
                  <h4 className="text-base font-bold text-white">Camera Required for Pure Movement</h4>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Enable webcam to allow AI skeleton tracking and posture coaching during this break.
                  </p>
                </div>
                <button
                  onClick={handleEnableCameraDirect}
                  disabled={isActivatingCam}
                  className="px-5 py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs rounded-xl shadow-lg transition flex items-center space-x-2 cursor-pointer disabled:opacity-50"
                >
                  <Camera className="w-4 h-4" />
                  <span>{isActivatingCam ? 'Connecting...' : 'Enable Camera'}</span>
                </button>
              </div>
            )}

            {cameraEnabled && poseHoldProgress > 0 && (
              <div className="absolute inset-0 bg-cyan-950/40 backdrop-blur-[2px] flex flex-col items-center justify-center p-4 z-20">
                <div className="text-sm font-bold font-mono text-white mb-2 uppercase tracking-wider flex items-center space-x-2">
                  <Zap className="w-5 h-5 text-yellow-400 animate-bounce" />
                  <span>Holding {currentExercise.name}: {poseHoldProgress}%</span>
                </div>
                <div className="w-64 h-4 bg-slate-950 rounded-full overflow-hidden border border-cyan-400/50 shadow-2xl">
                  <div
                    className="h-full bg-gradient-to-r from-cyan-500 via-blue-500 to-emerald-400 transition-all duration-100"
                    style={{ width: `${poseHoldProgress}%` }}
                  />
                </div>
              </div>
            )}

            {cameraEnabled && (
              <div className="absolute bottom-3 left-3 right-3 px-3 py-2 bg-slate-950/90 backdrop-blur border border-slate-700/80 text-xs font-mono text-slate-200 rounded-xl flex items-center justify-between z-10">
                <span className="text-cyan-300 font-bold truncate">{detectedPoseName}</span>
                <span className="text-[10px] text-emerald-400 font-bold ml-2">Skeleton Active</span>
              </div>
            )}
          </div>
        </div>

        {/* Right: AI Coach & Exercise Guidance Card */}
        <div className="lg:col-span-4 bg-slate-900/90 rounded-2xl border border-slate-800 p-6 space-y-5 shadow-2xl">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center space-x-2 text-cyan-400 font-bold text-xs uppercase tracking-wider">
              <Dumbbell className="w-4 h-4" />
              <span>AI Coach Exercise</span>
            </div>

            <button
              onClick={() => {
                if (speechEnabled) {
                  audioEngine.stopSpeaking();
                  setSpeechEnabled(false);
                } else {
                  setSpeechEnabled(true);
                  speakInstruction();
                }
              }}
              className="p-1.5 rounded-lg bg-slate-950 border border-slate-700 text-slate-300 hover:text-white cursor-pointer"
              title={speechEnabled ? 'Mute AI voice coach' : 'Unmute AI voice coach'}
            >
              {speechEnabled ? (
                <Volume2 className="w-3.5 h-3.5 text-cyan-400" />
              ) : (
                <VolumeX className="w-3.5 h-3.5 text-slate-500" />
              )}
            </button>
          </div>

          {/* Current Target Exercise */}
          <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono uppercase tracking-wider text-cyan-400 font-bold bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-500/30">
                Exercise {currentExerciseIndex + 1} of {EXERCISES.length}
              </span>
              <span className="text-xs font-mono text-slate-400">
                Hold for 1.5s
              </span>
            </div>

            <h3 className="text-lg font-black text-white">{currentExercise.name}</h3>

            <p className="text-xs text-slate-300 leading-relaxed font-medium">
              {currentExercise.instruction}
            </p>

            <div className="text-[11px] text-cyan-400/80 font-mono bg-cyan-950/30 p-2 rounded-lg border border-cyan-500/20">
              💡 {currentExercise.benefit}
            </div>
          </div>

          {/* Progress & Reps Tracker */}
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex items-center justify-between">
            <div className="space-y-0.5">
              <div className="text-[10px] uppercase font-mono text-slate-400">Reps Completed</div>
              <div className="text-2xl font-mono font-black text-emerald-400">{repsCompleted}</div>
            </div>

            <button
              onClick={() => {
                setCurrentExerciseIndex((idx) => (idx + 1) % EXERCISES.length);
              }}
              className="px-3 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-mono text-cyan-300 rounded-xl transition cursor-pointer"
            >
              Skip Movement →
            </button>
          </div>

          <button
            onClick={speakInstruction}
            className="w-full py-2 bg-cyan-950/50 hover:bg-cyan-900/60 border border-cyan-500/30 text-cyan-300 font-bold text-xs rounded-xl transition flex items-center justify-center space-x-2 cursor-pointer"
          >
            <Volume2 className="w-3.5 h-3.5" />
            <span>Replay Voice Instruction</span>
          </button>
        </div>

      </div>
    </div>
  );
};

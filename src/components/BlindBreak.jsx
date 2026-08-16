import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  EyeOff,
  Volume2,
  VolumeX,
  Sparkles,
  CheckCircle2,
  XCircle,
  Flame,
  Camera,
  RefreshCw,
  Play,
  RotateCcw,
  Zap,
  Smile,
  Globe,
  Award,
  ChevronRight,
  HelpCircle,
  Activity,
  Dumbbell,
  ShieldCheck,
  AlertCircle
} from 'lucide-react';
import { audioEngine } from '../utils/audioEngine.js';
import { INITIAL_QUIZ_BANK } from '../utils/dataStore.js';
import { poseDetector } from '../services/poseDetector.js';

const QUIZ_TOPICS = [
  { id: 'random', label: 'Ngẫu Nhiên Kỳ Thú', icon: '🎲' },
  { id: 'cute_animals', label: 'Động Vật Đáng Yêu', icon: '🦦' },
  { id: 'science_curiosity', label: 'Khoa Học & Vũ Trụ', icon: '🚀' },
  { id: 'riddle_jokes', label: 'Đố Mẹo Dí Dỏm', icon: '🧩' },
  { id: 'brain_wellness', label: 'Sức Khỏe & Não Bộ', icon: '🌿' }
];

export const BlindBreak = ({ mascot, setMascot, onFinishBreak }) => {
  const [selectedTopic, setSelectedTopic] = useState('random');
  const [quizList, setQuizList] = useState(INITIAL_QUIZ_BANK);
  const [currentQuizIndex, setCurrentQuizIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState(null);
  const [isAnswerRevealed, setIsAnswerRevealed] = useState(false);
  const [hasScored, setHasScored] = useState(false);
  const [loadingAi, setLoadingAi] = useState(false);
  const [speechEnabled, setSpeechEnabled] = useState(true);
  const [aiTopicTitle, setAiTopicTitle] = useState('Đố Vui Thể Chất & Khám Phá Kỳ Thú');

  // AI Pose Detection States
  const [detectedPoseName, setDetectedPoseName] = useState('Đang quét cơ thể...');
  const [detectedExercise, setDetectedExercise] = useState(null);
  const [poseHoldProgress, setPoseHoldProgress] = useState(0); // 0 -> 100%
  const [isPoseModelReady, setIsPoseModelReady] = useState(false);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const animFrameRef = useRef(null);
  const poseHoldTrackerRef = useRef({ pose: null, startTime: 0 });

  const currentQuiz = quizList[currentQuizIndex] || INITIAL_QUIZ_BANK[0];

  // Fetch AI-generated Quiz Set from Gemini LLM
  const fetchAiQuizSet = useCallback(async (topicId = selectedTopic) => {
    setLoadingAi(true);
    audioEngine.stopSpeaking();

    try {
      const res = await fetch('/api/quiz/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: topicId, count: 4 })
      });
      const data = await res.json();

      if (data.success && data.data?.questions?.length > 0) {
        setQuizList(data.data.questions);
        setAiTopicTitle(data.data.topicTitle || 'Đố Vui Thể Chất AI');
        setCurrentQuizIndex(0);
        setSelectedOption(null);
        setIsAnswerRevealed(false);
        setHasScored(false);
        setPoseHoldProgress(0);
      } else {
        throw new Error('Fallback to default bank');
      }
    } catch (err) {
      console.warn('Using default quiz bank:', err);
      setQuizList(INITIAL_QUIZ_BANK);
      setCurrentQuizIndex(0);
      setSelectedOption(null);
      setIsAnswerRevealed(false);
      setHasScored(false);
      setPoseHoldProgress(0);
    } finally {
      setLoadingAi(false);
    }
  }, [selectedTopic]);

  // Read out quiz question via TTS
  const speakCurrentQuestion = useCallback(() => {
    if (!speechEnabled || !currentQuiz) return;
    const textToSpeak = `Câu đố vận động: ${currentQuiz.question}. Để chọn đáp án A: ${currentQuiz.optionA.text}, hãy thực hiện ${currentQuiz.optionA.action}. Để chọn đáp án B: ${currentQuiz.optionB.text}, hãy thực hiện ${currentQuiz.optionB.action}.`;
    audioEngine.speakQuestion(textToSpeak);
  }, [speechEnabled, currentQuiz]);

  // Read out on question change
  useEffect(() => {
    speakCurrentQuestion();
    return () => {
      audioEngine.stopSpeaking();
    };
  }, [currentQuizIndex, quizList, speakCurrentQuestion]);

  // Webcam feed setup
  useEffect(() => {
    let stream = null;
    navigator.mediaDevices
      ?.getUserMedia({ video: { width: 640, height: 480 } })
      .then((s) => {
        stream = s;
        if (videoRef.current) {
          videoRef.current.srcObject = s;
          videoRef.current.play().catch(() => {});
        }
      })
      .catch((err) => {
        console.warn("Blind break webcam view error:", err);
      });

    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  // Continuous Camera Pose Estimation Loop
  useEffect(() => {
    let isRunning = true;

    const runPoseLoop = () => {
      if (!isRunning) return;

      if (videoRef.current && videoRef.current.readyState >= 2) {
        const video = videoRef.current;
        const result = poseDetector.detectPose(video);

        if (poseDetector.isModelLoaded && !isPoseModelReady) {
          setIsPoseModelReady(true);
        }

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
            // Draw skeleton lines
            ctx.lineWidth = 3;
            ctx.strokeStyle = '#6366f1';
            const connections = [
              [11, 12], [11, 13], [13, 15], [12, 14], [14, 16], // Arms
              [11, 23], [12, 24], [23, 24], // Torso
              [23, 25], [25, 27], [24, 26], [26, 28] // Legs
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

            // Draw landmark keypoints
            result.landmarks.forEach((p, idx) => {
              if (p.visibility > 0.4 && [11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28].includes(idx)) {
                ctx.beginPath();
                ctx.arc(p.x * canvas.width, p.y * canvas.height, 5, 0, 2 * Math.PI);
                ctx.fillStyle = '#22c55e';
                ctx.fill();
              }
            });
          }
        }

        // Check if recognized exercise matches Option A or Option B
        if (!isAnswerRevealed && result.detected && result.recognizedExercise) {
          setDetectedPoseName(result.exerciseName);
          setDetectedExercise(result.recognizedExercise);

          const reqA = currentQuiz.optionA?.requiredPose;
          const reqB = currentQuiz.optionB?.requiredPose;

          let targetOption = null;
          if (result.recognizedExercise === reqA) {
            targetOption = 'A';
          } else if (result.recognizedExercise === reqB) {
            targetOption = 'B';
          }

          if (targetOption) {
            // Require user to hold the pose stably for 1.2 seconds to confirm
            const now = performance.now();
            if (poseHoldTrackerRef.current.pose !== targetOption) {
              poseHoldTrackerRef.current = { pose: targetOption, startTime: now };
              setPoseHoldProgress(10);
            } else {
              const elapsed = now - poseHoldTrackerRef.current.startTime;
              const progress = Math.min(100, Math.round((elapsed / 1200) * 100));
              setPoseHoldProgress(progress);

              if (elapsed >= 1200) {
                // Confirm selection by Camera Pose!
                handlePoseTriggeredAnswer(targetOption);
              }
            }
          } else {
            poseHoldTrackerRef.current = { pose: null, startTime: 0 };
            setPoseHoldProgress(0);
          }
        } else if (!isAnswerRevealed) {
          setDetectedPoseName(result.detected ? 'Đang phân tích động tác...' : 'Hãy đứng/ngồi lùi lại để camera thấy cơ thể');
          poseHoldTrackerRef.current = { pose: null, startTime: 0 };
          setPoseHoldProgress(0);
        }
      }

      animFrameRef.current = requestAnimationFrame(runPoseLoop);
    };

    animFrameRef.current = requestAnimationFrame(runPoseLoop);

    return () => {
      isRunning = false;
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [currentQuiz, isAnswerRevealed, isPoseModelReady]);

  // Handle revealing answer when Pose is successfully recognized & held
  const handlePoseTriggeredAnswer = (chosenOpt) => {
    setSelectedOption(chosenOpt);
    setIsAnswerRevealed(true);
    setPoseHoldProgress(0);

    const isCorrect = chosenOpt === currentQuiz.correctOption;
    if (isCorrect) {
      audioEngine.playSuccessSound();
      audioEngine.speakQuestion(`Chính xác! Bạn đã thực hiện đúng động tác và chọn đáp án ${chosenOpt}.`);
      setMascot((prev) => ({
        ...prev,
        energy: Math.min(100, prev.energy + 15),
        streakDays: prev.streakDays + 1,
        statusMessage: `🎉 Hoàn thành xuất sắc động tác thể chất! (+15 HP cho ${prev.name})`
      }));
    } else {
      audioEngine.playWarningChime();
      audioEngine.speakQuestion(`Chưa chính xác! Bạn đã chọn đáp án ${chosenOpt}. Đáp án đúng là ${currentQuiz.correctOption}.`);
      setMascot((prev) => ({
        ...prev,
        energy: Math.min(100, prev.energy + 5),
        statusMessage: `💪 Tuyệt vời! Bạn đã vận động thể chất (+5 HP cho ${prev.name})`
      }));
    }
  };

  const handleNextQuestion = () => {
    if (currentQuizIndex < quizList.length - 1) {
      setCurrentQuizIndex((prev) => prev + 1);
      setSelectedOption(null);
      setIsAnswerRevealed(false);
      setHasScored(false);
      setPoseHoldProgress(0);
      poseHoldTrackerRef.current = { pose: null, startTime: 0 };
    } else {
      onFinishBreak();
    }
  };

  const handleTopicChange = (topicId) => {
    setSelectedTopic(topicId);
    fetchAiQuizSet(topicId);
  };

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-indigo-950 via-slate-900 to-purple-950/70 p-6 rounded-2xl border border-indigo-500/30 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xl">
        <div className="flex items-center space-x-4">
          <div className="w-12 h-12 rounded-xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-400 flex-shrink-0 shadow-inner">
            <Dumbbell className="w-6 h-6 animate-pulse text-indigo-300" />
          </div>
          <div>
            <div className="flex items-center space-x-2 flex-wrap gap-y-1">
              <span className="text-[10px] font-mono uppercase tracking-widest text-indigo-400 font-bold">AI Workout Quiz</span>
              <span className="px-2 py-0.5 bg-gradient-to-r from-emerald-500/30 to-indigo-500/30 border border-emerald-400/30 text-emerald-200 text-[10px] font-mono rounded flex items-center space-x-1">
                <ShieldCheck className="w-3 h-3 text-emerald-400" />
                <span>Zero Mouse/Keyboard • 100% Body Motion Camera</span>
              </span>
            </div>
            <h2 className="text-xl font-bold text-slate-100 mt-0.5">Vận Động Thể Chất Chọn Đáp Án (MediaPipe Pose AI)</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Chuột và bàn phím đã bị vô hiệu hóa! Camera sẽ quét tư thế cơ thể của bạn để chọn đáp án tương ứng.
            </p>
          </div>
        </div>

        {/* Mascot Status & Controls */}
        <div className="flex items-center space-x-3 self-end md:self-auto">
          <div className="flex items-center space-x-2 bg-slate-950 p-2.5 rounded-xl border border-slate-800">
            <Flame className="w-5 h-5 text-amber-500 fill-amber-500" />
            <div className="text-xs font-mono">
              <div className="text-slate-200 font-bold">{mascot.name}: {mascot.energy}% HP</div>
              <div className="text-[10px] text-slate-400">Streak: {mascot.streakDays} Ngày 🔥</div>
            </div>
          </div>
        </div>
      </div>

      {/* Topic Switcher Bar & AI Refresh Button */}
      <div className="bg-slate-900/80 p-3.5 rounded-2xl border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-lg">
        <div className="flex items-center space-x-2 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0 scrollbar-none">
          <span className="text-[11px] font-mono uppercase font-bold text-slate-400 whitespace-nowrap mr-1">Chủ đề:</span>
          {QUIZ_TOPICS.map((topic) => (
            <button
              key={topic.id}
              onClick={() => handleTopicChange(topic.id)}
              disabled={loadingAi}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition flex items-center space-x-1.5 whitespace-nowrap cursor-pointer ${
                selectedTopic === topic.id
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30 font-bold'
                  : 'bg-slate-950 text-slate-300 hover:bg-slate-800 border border-slate-800'
              }`}
            >
              <span>{topic.icon}</span>
              <span>{topic.label}</span>
            </button>
          ))}
        </div>

        <button
          onClick={() => fetchAiQuizSet(selectedTopic)}
          disabled={loadingAi}
          className="px-3.5 py-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs rounded-xl shadow-md transition flex items-center space-x-1.5 cursor-pointer disabled:opacity-50 flex-shrink-0 w-full sm:w-auto justify-center"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loadingAi ? 'animate-spin' : ''}`} />
          <span>{loadingAi ? 'AI Đang Tạo Câu Đố...' : 'Đổi Bộ Câu Đố AI'}</span>
        </button>
      </div>

      {/* Main Blind Break Arena with Live Camera Pose Overlay */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 min-w-0">
        
        {/* Left Column: Camera Pose Tracker (5 cols) */}
        <div className="md:col-span-5 bg-slate-900/90 rounded-2xl border border-slate-800 p-4 flex flex-col justify-between space-y-4 shadow-2xl min-w-0">
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs font-bold text-slate-300">
              <div className="flex items-center space-x-1.5">
                <Camera className="w-4 h-4 text-emerald-400" />
                <span>Camera Motion Tracker (Live)</span>
              </div>
              <span className="px-2 py-0.5 bg-indigo-500/20 border border-indigo-400/30 text-[9px] font-mono text-indigo-300 rounded flex items-center space-x-1">
                <Activity className="w-3 h-3 text-indigo-400 animate-pulse" />
                <span>MediaPipe 33 Keypoints</span>
              </span>
            </div>

            <div className="relative w-full aspect-video bg-black rounded-xl overflow-hidden border border-slate-800 flex items-center justify-center shadow-inner">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover transform -scale-x-100"
              />
              <canvas
                ref={canvasRef}
                className="absolute inset-0 w-full h-full object-cover transform -scale-x-100 pointer-events-none"
              />
              
              {/* Pose Hold Progress Overlay */}
              {poseHoldProgress > 0 && !isAnswerRevealed && (
                <div className="absolute inset-0 bg-indigo-950/40 backdrop-blur-[2px] flex flex-col items-center justify-center p-4">
                  <div className="text-xs font-bold font-mono text-white mb-2 uppercase tracking-wider flex items-center space-x-1.5">
                    <Zap className="w-4 h-4 text-yellow-400 animate-bounce" />
                    <span>Giữ tư thế: {poseHoldProgress}%</span>
                  </div>
                  <div className="w-48 h-3 bg-slate-950 rounded-full overflow-hidden border border-indigo-400/40 shadow-lg">
                    <div
                      className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-emerald-400 transition-all duration-100"
                      style={{ width: `${poseHoldProgress}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Bottom Camera Banner */}
              <div className="absolute bottom-2 left-2 right-2 px-2.5 py-1.5 bg-slate-950/85 backdrop-blur border border-slate-700/60 text-[11px] font-mono text-slate-200 rounded-lg flex items-center justify-between">
                <span className="text-indigo-300 font-bold truncate">{detectedPoseName}</span>
                <span className="text-[10px] text-emerald-400 font-bold ml-2">AI Sẵn Sàng</span>
              </div>
            </div>
          </div>

          {/* Quick Audio & Exercise Rules */}
          <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-2.5 text-xs">
            <div className="flex items-center justify-between text-slate-300 font-bold text-[11px] uppercase tracking-wider">
              <span>Trợ lý Giọng đọc & Quy tắc</span>
              <button
                onClick={() => {
                  if (speechEnabled) {
                    audioEngine.stopSpeaking();
                    setSpeechEnabled(false);
                  } else {
                    setSpeechEnabled(true);
                    speakCurrentQuestion();
                  }
                }}
                className="p-1 rounded-lg bg-slate-900 border border-slate-700 text-slate-300 hover:text-white cursor-pointer"
                title={speechEnabled ? 'Tắt đọc câu hỏi' : 'Bật đọc câu hỏi'}
              >
                {speechEnabled ? <Volume2 className="w-3.5 h-3.5 text-indigo-400" /> : <VolumeX className="w-3.5 h-3.5 text-slate-500" />}
              </button>
            </div>

            <div className="text-[11px] text-slate-400 space-y-1">
              <div className="flex items-center space-x-1.5 text-amber-300 font-medium">
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                <span>Không click chuột hay phím:</span>
              </div>
              <p className="text-[10px] leading-relaxed text-slate-400">
                Hãy đứng/ngồi đối diện camera và thực hiện đúng động tác của đáp án bạn chọn, giữ yên trong 1 giây để AI xác nhận.
              </p>
            </div>

            <button
              onClick={speakCurrentQuestion}
              className="w-full py-1.5 bg-slate-900 hover:bg-slate-850 text-indigo-300 border border-indigo-500/30 rounded-lg text-[11px] font-mono font-bold flex items-center justify-center space-x-1.5 cursor-pointer transition"
            >
              <Volume2 className="w-3.5 h-3.5" />
              <span>Đọc Lại Câu Hỏi & Động Tác</span>
            </button>
          </div>

        </div>

        {/* Right Column: Audio Quiz & Body Motion Arena (7 cols) */}
        <div className="md:col-span-7 bg-slate-900/90 rounded-2xl border border-slate-800 p-6 sm:p-7 shadow-2xl flex flex-col justify-between space-y-5 min-w-0">
          
          {/* Header with Progress */}
          <div className="flex items-center justify-between border-b border-slate-800 pb-4 min-w-0">
            <div className="flex items-center space-x-2.5 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-400 flex-shrink-0">
                <HelpCircle className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="text-[10px] font-mono text-indigo-400 font-bold uppercase tracking-wider">
                  Câu hỏi {currentQuizIndex + 1} / {quizList.length} • {currentQuiz.topicName || 'Đố vui thể chất'}
                </div>
                <div className="text-xs font-bold text-slate-300 truncate">
                  {aiTopicTitle}
                </div>
              </div>
            </div>

            {/* Camera Only Badge */}
            <div className="flex items-center space-x-2 font-mono text-xs flex-shrink-0">
              <span className="px-3 py-1 rounded-xl font-bold font-mono text-xs border bg-emerald-500/20 border-emerald-500/40 text-emerald-300 flex items-center space-x-1">
                <Camera className="w-3 h-3 text-emerald-400" />
                <span>Motion Detection</span>
              </span>
            </div>
          </div>

          {/* Question Text Card */}
          <div className="space-y-2 min-w-0">
            <div className="text-base sm:text-lg font-bold text-slate-100 bg-slate-950 p-4 sm:p-5 rounded-2xl border border-slate-800/80 shadow-inner leading-relaxed">
              "{currentQuiz.question}"
            </div>
          </div>

          {/* Options Grid (Non-clickable, Camera Motion Driven Only) */}
          <div className="grid grid-cols-1 gap-3.5 min-w-0">
            
            {/* Option A Card */}
            <div
              className={`p-4 rounded-2xl border transition-all duration-300 min-w-0 select-none ${
                isAnswerRevealed && currentQuiz.correctOption === 'A'
                  ? 'bg-emerald-950/70 border-emerald-500 text-emerald-100 shadow-lg shadow-emerald-500/20'
                  : isAnswerRevealed && selectedOption === 'A' && currentQuiz.correctOption !== 'A'
                  ? 'bg-rose-950/60 border-rose-500 text-rose-200'
                  : 'bg-slate-950/70 border-slate-800 text-slate-300'
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center space-x-2">
                  <span className="px-2 py-0.5 bg-indigo-500/30 border border-indigo-400/40 text-indigo-300 text-xs font-mono font-black rounded uppercase">
                    ĐÁP ÁN A
                  </span>
                  <span className="text-xs font-bold text-slate-200">{currentQuiz.optionA?.text}</span>
                </div>
                {isAnswerRevealed && currentQuiz.correctOption === 'A' && (
                  <span className="px-2 py-0.5 bg-emerald-500 text-slate-950 text-[10px] font-bold rounded flex items-center space-x-1">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>ĐÁP ÁN ĐÚNG</span>
                  </span>
                )}
              </div>
              
              {/* Exercise Action to trigger Option A */}
              <div className="mt-2 p-2.5 bg-indigo-950/40 border border-indigo-500/30 rounded-xl flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Dumbbell className="w-4 h-4 text-indigo-400 flex-shrink-0" />
                  <span className="text-xs font-mono text-indigo-200 font-bold">
                    Động tác kích hoạt: {currentQuiz.optionA?.action}
                  </span>
                </div>
                <span className="px-2 py-0.5 bg-indigo-500 text-white font-mono font-bold text-[10px] rounded">
                  Camera Scan
                </span>
              </div>
            </div>

            {/* Option B Card */}
            <div
              className={`p-4 rounded-2xl border transition-all duration-300 min-w-0 select-none ${
                isAnswerRevealed && currentQuiz.correctOption === 'B'
                  ? 'bg-emerald-950/70 border-emerald-500 text-emerald-100 shadow-lg shadow-emerald-500/20'
                  : isAnswerRevealed && selectedOption === 'B' && currentQuiz.correctOption !== 'B'
                  ? 'bg-rose-950/60 border-rose-500 text-rose-200'
                  : 'bg-slate-950/70 border-slate-800 text-slate-300'
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center space-x-2">
                  <span className="px-2 py-0.5 bg-indigo-500/30 border border-indigo-400/40 text-indigo-300 text-xs font-mono font-black rounded uppercase">
                    ĐÁP ÁN B
                  </span>
                  <span className="text-xs font-bold text-slate-200">{currentQuiz.optionB?.text}</span>
                </div>
                {isAnswerRevealed && currentQuiz.correctOption === 'B' && (
                  <span className="px-2 py-0.5 bg-emerald-500 text-slate-950 text-[10px] font-bold rounded flex items-center space-x-1">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>ĐÁP ÁN ĐÚNG</span>
                  </span>
                )}
              </div>
              
              {/* Exercise Action to trigger Option B */}
              <div className="mt-2 p-2.5 bg-purple-950/40 border border-purple-500/30 rounded-xl flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Dumbbell className="w-4 h-4 text-purple-400 flex-shrink-0" />
                  <span className="text-xs font-mono text-purple-200 font-bold">
                    Động tác kích hoạt: {currentQuiz.optionB?.action}
                  </span>
                </div>
                <span className="px-2 py-0.5 bg-purple-500 text-white font-mono font-bold text-[10px] rounded">
                  Camera Scan
                </span>
              </div>
            </div>

          </div>

          {/* Explanation & Next Question Button when Revealed */}
          {isAnswerRevealed && (
            <div className="bg-gradient-to-r from-emerald-950/60 via-slate-950 to-indigo-950/60 border border-emerald-500/40 p-4 sm:p-5 rounded-2xl space-y-3 shadow-xl animate-in fade-in duration-300 min-w-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2 text-emerald-300 text-xs font-bold font-mono">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                  <span>
                    {selectedOption === currentQuiz.correctOption
                      ? `Tuyệt vời! Bạn chọn đúng đáp án ${currentQuiz.correctOption} bằng động tác chuẩn xác! (+15 HP)`
                      : `Bạn đã chọn đáp án ${selectedOption}. Đáp án đúng là ${currentQuiz.correctOption}! (+5 HP vận động)`}
                  </span>
                </div>
              </div>

              <p className="text-xs text-slate-200 leading-relaxed">
                {currentQuiz.explanation}
              </p>

              {/* Extra Fun Fact */}
              {currentQuiz.funFact && (
                <div className="bg-slate-900/90 p-2.5 rounded-xl border border-indigo-500/30 text-[11px] text-indigo-200 flex items-start space-x-2">
                  <Sparkles className="w-3.5 h-3.5 text-yellow-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-yellow-300 uppercase text-[10px]">Sự thật kỳ thú:</strong> {currentQuiz.funFact}
                  </div>
                </div>
              )}

              <button
                onClick={handleNextQuestion}
                className="mt-2 w-full py-2.5 bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-bold text-xs rounded-xl transition shadow-lg shadow-emerald-500/20 flex items-center justify-center space-x-2 cursor-pointer active:scale-98"
              >
                <Sparkles className="w-4 h-4" />
                <span>
                  {currentQuizIndex < quizList.length - 1
                    ? `Chuyển Sang Câu ${currentQuizIndex + 2} / ${quizList.length}`
                    : 'Hoàn Thành Nghỉ Giải Lao (Quay Lại Giờ Học Focus)'}
                </span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}

        </div>

      </div>
    </div>
  );
};

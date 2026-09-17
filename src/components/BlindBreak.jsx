import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Volume2,
  VolumeX,
  Sparkles,
  CheckCircle2,
  XCircle,
  Camera,
  CameraOff,
  Zap,
  ChevronRight,
  ChevronLeft,
  HelpCircle,
  Dumbbell,
  AlertCircle,
  Clock,
  Square,
  Coffee,
  Eye,
  Plus,
  Trash2,
  X,
  Layers,
  BookOpen,
  Check,
  RotateCcw,
  Edit3,
  ArrowRight,
  FolderPlus,
  ArrowRightLeft
} from 'lucide-react';
import { audioEngine } from '../utils/audioEngine.js';
import { poseDetector } from '../services/poseDetector.js';

const QUESTION_SETS_STORAGE_KEY = 'edumotion_question_sets_v2';
const ACTIVE_SET_ID_STORAGE_KEY = 'edumotion_active_set_id_v2';

const DEFAULT_QUESTION_SETS = [
  {
    id: 'set_default_1',
    title: 'Vision & Focus Workout',
    questions: [
      {
        id: 'q_default_1',
        question: "The '20-20-20' rule suggests looking how far away after 20 minutes of screen time?",
        options: [
          {
            id: 'opt_1',
            letter: 'A',
            text: 'About 20 feet (6 meters) for 20 seconds',
            action: 'Lateral Arm Raise',
            requiredPose: 'lateral_raise',
            isCorrect: true
          },
          {
            id: 'opt_2',
            letter: 'B',
            text: 'About 20 meters for 2 minutes',
            action: 'Squat Hold',
            requiredPose: 'squat',
            isCorrect: false
          }
        ]
      }
    ]
  }
];

// Load question sets from localStorage or fall back to DEFAULT_QUESTION_SETS
const getStoredQuestionSets = () => {
  try {
    const saved = localStorage.getItem(QUESTION_SETS_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (err) {
    console.warn('Could not load question sets from storage:', err);
  }
  return DEFAULT_QUESTION_SETS;
};

const getStoredActiveSetId = (sets) => {
  try {
    const savedId = localStorage.getItem(ACTIVE_SET_ID_STORAGE_KEY);
    if (savedId && sets.some((s) => s.id === savedId)) {
      return savedId;
    }
  } catch (err) {
    console.warn('Could not load active set id:', err);
  }
  return sets[0]?.id || DEFAULT_QUESTION_SETS[0].id;
};

export const BlindBreak = ({
  mascot,
  setMascot,
  onFinishBreak,
  cameraEnabled = false,
  setCameraEnabled,
  cameraStream = null,
  setCameraStream,
  onOpenPermissionModal,
  // Cycle & Break Session Props (1 Cycle = 1 Study + 1 Break)
  secondsLeft = 5 * 60,
  isSessionActive = false,
  isSessionPaused = false,
  totalCycles = 4,
  currentCycle = 1,
  onChangeBreakStyle,
  onStopSessionEarly
}) => {
  // Question Sets State
  const [questionSets, setQuestionSets] = useState(getStoredQuestionSets);
  const [activeSetId, setActiveSetId] = useState(() => getStoredActiveSetId(questionSets));
  const [currentQuizIndex, setCurrentQuizIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState(null);
  const [isAnswerRevealed, setIsAnswerRevealed] = useState(false);
  const [speechEnabled, setSpeechEnabled] = useState(true);
  const [isAllQuizzesDone, setIsAllQuizzesDone] = useState(false);

  // Modals
  const [isCreateSetModalOpen, setIsCreateSetModalOpen] = useState(false);
  const [isManageSetsOpen, setIsManageSetsOpen] = useState(false);

  // Set Builder State
  const [builderSetTitle, setBuilderSetTitle] = useState('');
  const [builderQuestions, setBuilderQuestions] = useState([]);
  const [builderActiveQIndex, setBuilderActiveQIndex] = useState(0);
  const [builderStep, setBuilderStep] = useState('question'); // 'question' | 'answers'
  const [builderError, setBuilderError] = useState('');

  // AI Pose Detection States
  const [detectedPoseName, setDetectedPoseName] = useState('Scanning body pose...');
  const [detectedExercise, setDetectedExercise] = useState(null);
  const [poseHoldProgress, setPoseHoldProgress] = useState(0); // 0 -> 100%
  const [isPoseModelReady, setIsPoseModelReady] = useState(false);
  const [isActivatingCam, setIsActivatingCam] = useState(false);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const animFrameRef = useRef(null);
  const poseHoldTrackerRef = useRef({ pose: null, startTime: 0 });
  const lastSpokenQuizIdRef = useRef(null);

  // Find active set & active question
  const activeSet =
    questionSets.find((s) => s.id === activeSetId) ||
    questionSets[0] ||
    DEFAULT_QUESTION_SETS[0];

  const questionsList = activeSet.questions || [];
  const currentQuiz =
    questionsList[currentQuizIndex] ||
    questionsList[0] ||
    DEFAULT_QUESTION_SETS[0].questions[0];

  // Persist question sets to localStorage
  const saveQuestionSets = (newSets, newActiveId = null) => {
    setQuestionSets(newSets);
    try {
      localStorage.setItem(QUESTION_SETS_STORAGE_KEY, JSON.stringify(newSets));
      if (newActiveId) {
        setActiveSetId(newActiveId);
        localStorage.setItem(ACTIVE_SET_ID_STORAGE_KEY, newActiveId);
      }
    } catch (e) {
      console.warn('Failed to save question sets:', e);
    }
  };

  const handleSelectSet = (setId) => {
    setActiveSetId(setId);
    try {
      localStorage.setItem(ACTIVE_SET_ID_STORAGE_KEY, setId);
    } catch (e) {}
    setCurrentQuizIndex(0);
    setSelectedOption(null);
    setIsAnswerRevealed(false);
    setIsAllQuizzesDone(false);
    setPoseHoldProgress(0);
  };

  const formatTime = (totalSec) => {
    const safeSec = Math.max(0, totalSec || 0);
    const m = Math.floor(safeSec / 60);
    const s = safeSec % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Read out question & options via TTS
  const speakCurrentQuestion = useCallback(() => {
    if (!speechEnabled || !currentQuiz || isAllQuizzesDone) return;
    const optionsText = (currentQuiz.options || [])
      .map((opt) => {
        const poseHint =
          opt.requiredPose && opt.requiredPose !== 'none'
            ? ` or perform ${opt.action}`
            : '';
        return `Option ${opt.letter}: ${opt.text}${poseHint}`;
      })
      .join('. ');
    const textToSpeak = `Question: ${currentQuiz.question}. ${optionsText}.`;
    audioEngine.speakQuestion(textToSpeak, null, 'en');
  }, [speechEnabled, currentQuiz, isAllQuizzesDone]);

  // Read out on question change strictly once
  useEffect(() => {
    if (currentQuiz && currentQuiz.id !== lastSpokenQuizIdRef.current && !isAllQuizzesDone) {
      lastSpokenQuizIdRef.current = currentQuiz.id;
      speakCurrentQuestion();
    }
    return () => {
      audioEngine.stopSpeaking();
    };
  }, [currentQuizIndex, currentQuiz, isAllQuizzesDone, speakCurrentQuestion]);

  // Bind shared cameraStream from App to video element
  useEffect(() => {
    const video = videoRef.current;
    if (video) {
      if (cameraEnabled && cameraStream) {
        video.srcObject = cameraStream;
        video.play().catch((err) => {
          console.warn('Blind break video stream play error:', err);
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
        throw new Error('Camera API not supported in this browser');
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' }
      });
      if (setCameraStream) setCameraStream(stream);
      if (setCameraEnabled) setCameraEnabled(true);
    } catch (err) {
      console.warn('Direct camera enable error in BlindBreak:', err);
      if (onOpenPermissionModal) onOpenPermissionModal();
    } finally {
      setIsActivatingCam(false);
    }
  };

  // Continuous Camera Pose Estimation Loop
  useEffect(() => {
    let isRunning = true;

    if (!cameraEnabled) {
      setDetectedPoseName('Camera is off • Enable camera to detect poses');
      setPoseHoldProgress(0);
      return;
    }

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
            ctx.lineWidth = 3;
            ctx.strokeStyle = '#6366f1';
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
                ctx.arc(p.x * canvas.width, p.y * canvas.height, 5, 0, 2 * Math.PI);
                ctx.fillStyle = '#22c55e';
                ctx.fill();
              }
            });
          }
        }

        // Check if recognized exercise matches any option in the current question
        if (!isAnswerRevealed && result.detected && result.recognizedExercise && currentQuiz?.options) {
          setDetectedPoseName(result.exerciseName || 'Pose detected');
          setDetectedExercise(result.recognizedExercise);

          const matchedOpt = currentQuiz.options.find(
            (opt) =>
              opt.requiredPose &&
              opt.requiredPose !== 'none' &&
              opt.requiredPose === result.recognizedExercise
          );

          if (matchedOpt) {
            const now = performance.now();
            if (poseHoldTrackerRef.current.pose !== matchedOpt.id) {
              poseHoldTrackerRef.current = { pose: matchedOpt.id, startTime: now };
              setPoseHoldProgress(10);
            } else {
              const elapsed = now - poseHoldTrackerRef.current.startTime;
              const progress = Math.min(100, Math.round((elapsed / 1200) * 100));
              setPoseHoldProgress(progress);

              if (elapsed >= 1200) {
                handleOptionSelect(matchedOpt);
              }
            }
          } else {
            poseHoldTrackerRef.current = { pose: null, startTime: 0 };
            setPoseHoldProgress(0);
          }
        } else if (!isAnswerRevealed) {
          setDetectedPoseName(
            result.detected ? 'Analyzing motion...' : 'Step back so camera sees your upper body'
          );
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
  }, [cameraEnabled, cameraStream, currentQuiz, isAnswerRevealed, isPoseModelReady]);

  // Handle option select
  const handleOptionSelect = (option) => {
    if (isAnswerRevealed) return;

    setSelectedOption(option.id);
    setIsAnswerRevealed(true);
    setPoseHoldProgress(0);

    const isCorrect = Boolean(option.isCorrect);
    const correctOpt = currentQuiz.options.find((o) => o.isCorrect) || currentQuiz.options[0];

    if (isCorrect) {
      audioEngine.playSuccessSound();
      audioEngine.speakQuestion(`Correct! Option ${option.letter} is right. Well done!`, null, 'en');
      if (setMascot) {
        setMascot((prev) => ({
          ...prev,
          energy: Math.min(100, prev.energy + 15),
          streakDays: prev.streakDays + 1,
          statusMessage: `🎉 Great answer! (+15 HP for ${prev.name})`
        }));
      }
    } else {
      audioEngine.playWarningChime();
      audioEngine.speakQuestion(
        `Not quite. You selected Option ${option.letter}. The correct answer was Option ${correctOpt.letter}.`,
        null,
        'en'
      );
      if (setMascot) {
        setMascot((prev) => ({
          ...prev,
          energy: Math.min(100, prev.energy + 5),
          statusMessage: `💪 Good effort! (+5 HP for ${prev.name})`
        }));
      }
    }
  };

  const handleNextQuestion = () => {
    if (currentQuizIndex < questionsList.length - 1) {
      setCurrentQuizIndex((prev) => prev + 1);
      setSelectedOption(null);
      setIsAnswerRevealed(false);
      setPoseHoldProgress(0);
      poseHoldTrackerRef.current = { pose: null, startTime: 0 };
    } else {
      setIsAllQuizzesDone(true);
      audioEngine.stopSpeaking();
    }
  };

  // ----------------------------------------------------
  // QUESTION SET CREATOR LOGIC (Prompt-Free, Square + Box, Right + for Next Question)
  // ----------------------------------------------------
  const handleOpenCreateSetModal = () => {
    setBuilderSetTitle(`Question Set ${questionSets.length + 1}`);
    setBuilderQuestions([]); // Start with 0 questions -> clean square + in center
    setBuilderActiveQIndex(0);
    setBuilderStep('question');
    setBuilderError('');
    setIsCreateSetModalOpen(true);
  };

  // When clicking the center square "+" to create the first question
  const handleCreateFirstQuestion = () => {
    const firstQ = {
      id: `q_${Date.now()}_1`,
      question: '',
      options: [
        { id: `opt_${Date.now()}_1`, letter: 'A', text: '', isCorrect: true, requiredPose: 'lateral_raise', action: 'Lateral Arm Raise' },
        { id: `opt_${Date.now()}_2`, letter: 'B', text: '', isCorrect: false, requiredPose: 'squat', action: 'Squat Hold' }
      ]
    };
    setBuilderQuestions([firstQ]);
    setBuilderActiveQIndex(0);
    setBuilderStep('question'); // Ask question first!
    setBuilderError('');
  };

  // Current question in editor
  const editorQ = builderQuestions[builderActiveQIndex] || null;

  const handleUpdateCurrentQuestionText = (val) => {
    setBuilderQuestions((prev) =>
      prev.map((q, idx) => (idx === builderActiveQIndex ? { ...q, question: val } : q))
    );
  };

  // After typing question, advance to entering answers
  const handleProceedToAnswers = () => {
    if (!editorQ?.question?.trim()) {
      setBuilderError('Please enter the question text before adding answers.');
      return;
    }
    setBuilderError('');
    setBuilderStep('answers');
  };

  // Update answer text
  const handleUpdateOptionText = (optIndex, val) => {
    setBuilderQuestions((prev) =>
      prev.map((q, qIdx) => {
        if (qIdx !== builderActiveQIndex) return q;
        const newOpts = q.options.map((opt, oIdx) =>
          oIdx === optIndex ? { ...opt, text: val } : opt
        );
        return { ...q, options: newOpts };
      })
    );
  };

  // Set correct answer
  const handleSetCorrectOption = (optIndex) => {
    setBuilderQuestions((prev) =>
      prev.map((q, qIdx) => {
        if (qIdx !== builderActiveQIndex) return q;
        const newOpts = q.options.map((opt, oIdx) => ({
          ...opt,
          isCorrect: oIdx === optIndex
        }));
        return { ...q, options: newOpts };
      })
    );
  };

  // Update pose
  const handleUpdateOptionPose = (optIndex, poseVal) => {
    const poseLabels = {
      lateral_raise: 'Lateral Arm Raise',
      squat: 'Squat Hold',
      hammer_curl: 'Bicep Curl',
      none: 'Tap / Click to answer'
    };
    setBuilderQuestions((prev) =>
      prev.map((q, qIdx) => {
        if (qIdx !== builderActiveQIndex) return q;
        const newOpts = q.options.map((opt, oIdx) =>
          oIdx === optIndex
            ? { ...opt, requiredPose: poseVal, action: poseLabels[poseVal] || 'Tap / Click to answer' }
            : opt
        );
        return { ...q, options: newOpts };
      })
    );
  };

  // Add answer directly underneath current answers (+ button below)
  const handleAddOptionBelow = () => {
    if (!editorQ) return;
    const defaultPoses = ['lateral_raise', 'squat', 'hammer_curl', 'none'];
    const poseLabels = {
      lateral_raise: 'Lateral Arm Raise',
      squat: 'Squat Hold',
      hammer_curl: 'Bicep Curl',
      none: 'Tap / Click to answer'
    };
    const nextPose = defaultPoses[editorQ.options.length % defaultPoses.length];
    const newLetter = String.fromCharCode(65 + editorQ.options.length);

    const newOpt = {
      id: `opt_${Date.now()}_${editorQ.options.length + 1}`,
      letter: newLetter,
      text: '',
      isCorrect: false,
      requiredPose: nextPose,
      action: poseLabels[nextPose]
    };

    setBuilderQuestions((prev) =>
      prev.map((q, qIdx) =>
        qIdx === builderActiveQIndex ? { ...q, options: [...q.options, newOpt] } : q
      )
    );
    setBuilderError('');
  };

  // Remove an option
  const handleRemoveOption = (optIndex) => {
    if (!editorQ || editorQ.options.length <= 2) {
      setBuilderError('Each question must have at least 2 answer options.');
      return;
    }
    setBuilderQuestions((prev) =>
      prev.map((q, qIdx) => {
        if (qIdx !== builderActiveQIndex) return q;
        const wasCorrect = q.options[optIndex].isCorrect;
        const filtered = q.options.filter((_, idx) => idx !== optIndex);
        const reindexed = filtered.map((opt, idx) => ({
          ...opt,
          letter: String.fromCharCode(65 + idx),
          isCorrect: wasCorrect && idx === 0 ? true : opt.isCorrect
        }));
        return { ...q, options: reindexed };
      })
    );
    setBuilderError('');
  };

  // Validate the active question before advancing or saving
  const validateActiveQuestion = () => {
    if (!editorQ) return false;
    if (!editorQ.question.trim()) {
      setBuilderError(`Question ${builderActiveQIndex + 1} is missing question text.`);
      return false;
    }
    if (editorQ.options.length < 2) {
      setBuilderError(`Question ${builderActiveQIndex + 1} needs at least 2 answer options.`);
      return false;
    }
    const hasEmpty = editorQ.options.some((opt) => !opt.text.trim());
    if (hasEmpty) {
      setBuilderError(`Please fill in text for all answers in Question ${builderActiveQIndex + 1}.`);
      return false;
    }
    const hasCorrect = editorQ.options.some((opt) => opt.isCorrect);
    if (!hasCorrect) {
      setBuilderError(`Please mark one answer as correct for Question ${builderActiveQIndex + 1}.`);
      return false;
    }
    return true;
  };

  // Click the "+" button on the RIGHT of current question to move to next question!
  const handleAddNextQuestionOnRight = () => {
    if (!validateActiveQuestion()) return;

    // Check if there is already a next question in the array
    if (builderActiveQIndex < builderQuestions.length - 1) {
      setBuilderActiveQIndex((prev) => prev + 1);
      setBuilderStep('question');
      setBuilderError('');
      return;
    }

    // Create a new question and advance
    const nextQ = {
      id: `q_${Date.now()}_${builderQuestions.length + 1}`,
      question: '',
      options: [
        { id: `opt_${Date.now()}_1`, letter: 'A', text: '', isCorrect: true, requiredPose: 'lateral_raise', action: 'Lateral Arm Raise' },
        { id: `opt_${Date.now()}_2`, letter: 'B', text: '', isCorrect: false, requiredPose: 'squat', action: 'Squat Hold' }
      ]
    };

    setBuilderQuestions((prev) => [...prev, nextQ]);
    setBuilderActiveQIndex(builderQuestions.length);
    setBuilderStep('question'); // Ask question first for the new question!
    setBuilderError('');
  };

  // Delete a question from the builder
  const handleDeleteQuestionFromBuilder = (qIdx) => {
    if (builderQuestions.length <= 1) {
      setBuilderQuestions([]);
      setBuilderActiveQIndex(0);
      setBuilderStep('question');
      return;
    }
    const filtered = builderQuestions.filter((_, idx) => idx !== qIdx);
    setBuilderQuestions(filtered);
    setBuilderActiveQIndex(Math.min(builderActiveQIndex, filtered.length - 1));
    setBuilderStep('answers');
  };

  // Save the complete Question Set
  const handleSaveQuestionSet = () => {
    if (builderQuestions.length === 0) {
      setBuilderError('Please add at least one question to this set.');
      return;
    }

    if (!validateActiveQuestion()) return;

    const newSetId = `set_${Date.now()}`;
    const newSet = {
      id: newSetId,
      title: builderSetTitle.trim() || `Question Set ${questionSets.length + 1}`,
      createdAt: Date.now(),
      questions: builderQuestions
    };

    const updatedSets = [...questionSets, newSet];
    saveQuestionSets(updatedSets, newSetId);

    // Reset local navigation to first question of new set
    setCurrentQuizIndex(0);
    setSelectedOption(null);
    setIsAnswerRevealed(false);
    setIsAllQuizzesDone(false);
    setPoseHoldProgress(0);

    setIsCreateSetModalOpen(false);
  };

  const handleDeleteSet = (setId) => {
    if (questionSets.length <= 1) {
      alert('You must keep at least 1 question set.');
      return;
    }
    const filtered = questionSets.filter((s) => s.id !== setId);
    const nextActive = filtered[0].id;
    saveQuestionSets(filtered, nextActive);
    setCurrentQuizIndex(0);
    setSelectedOption(null);
    setIsAnswerRevealed(false);
    setIsAllQuizzesDone(false);
  };

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      {/* Top Banner with Break Countdown & Cycle Status */}
      <div className="bg-gradient-to-r from-indigo-950 via-slate-900 to-purple-950/70 p-6 rounded-2xl border border-indigo-500/30 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xl">
        <div className="flex items-center space-x-4">
          <div className="w-12 h-12 rounded-xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-400 flex-shrink-0 shadow-inner">
            <Coffee className="w-6 h-6 animate-pulse text-indigo-300" />
          </div>
          <div>
            <div className="flex items-center space-x-2 flex-wrap gap-y-1">
              <span className="text-[10px] font-mono uppercase tracking-widest text-emerald-400 font-bold bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-500/30">
                Blind Break Session
              </span>
              <span className="text-[10px] font-mono uppercase tracking-widest text-purple-300 font-bold">
                Cycle {currentCycle} / {totalCycles} • Rest Break
              </span>
            </div>
            <h2 className="text-xl font-bold text-slate-100 mt-0.5">Physical Movement Questions</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Listen to questions, move your body to answer, and let your eyes relax.
            </p>
          </div>
        </div>

        {/* Live Break Countdown Timer & Stop Early Control */}
        <div className="flex items-center space-x-3 self-end md:self-auto">
          <div className="flex items-center space-x-2.5 bg-slate-950 p-2.5 px-3.5 rounded-xl border border-slate-800">
            <Clock className="w-4 h-4 text-emerald-400 animate-pulse" />
            <div className="text-xs font-mono">
              <div className="text-[10px] text-slate-400 uppercase font-semibold">Break Time Remaining</div>
              <div className="text-emerald-400 font-black text-sm">{formatTime(secondsLeft)}</div>
            </div>
          </div>

          {onChangeBreakStyle && (
            <button
              onClick={onChangeBreakStyle}
              className="px-3 py-2 bg-slate-950 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-white font-bold text-xs rounded-xl transition flex items-center space-x-1.5 cursor-pointer shadow-md"
              title="Switch to Pure Movement or Visual Rest"
            >
              <ArrowRightLeft className="w-3.5 h-3.5 text-indigo-400" />
              <span className="hidden sm:inline">Change Break</span>
            </button>
          )}

          {isSessionActive && (
            <button
              onClick={onStopSessionEarly}
              className="px-3 py-2 bg-red-950/80 hover:bg-red-900 border border-red-500/50 text-red-200 font-bold text-xs rounded-xl transition flex items-center space-x-1.5 cursor-pointer active:scale-95 shadow-lg shadow-red-950/30"
              title="Stop Session Early - End session and reset settings"
            >
              <Square className="w-3.5 h-3.5 fill-red-400 text-red-400" />
              <span className="hidden sm:inline">Stop Early</span>
            </button>
          )}
        </div>
      </div>

      {/* If All Questions Finished */}
      {isAllQuizzesDone ? (
        <div className="bg-slate-950 p-8 sm:p-12 rounded-3xl border border-emerald-500/30 text-center space-y-6 shadow-2xl">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
            <Eye className="w-8 h-8 animate-bounce" />
          </div>

          <div className="space-y-2 max-w-lg mx-auto">
            <h3 className="text-2xl font-black text-slate-100">
              All Questions in this Set Completed! 🧘
            </h3>
            <p className="text-sm text-slate-300 leading-relaxed">
              Great workout! Rest your eyes now by looking into the distance (at least 20 feet away) and blinking gently.
            </p>
          </div>

          <div className="bg-slate-900/90 p-6 rounded-2xl border border-slate-800 max-w-md mx-auto">
            <div className="text-xs uppercase font-mono tracking-widest text-slate-400 font-bold mb-1">
              Remaining Break Time for Cycle {currentCycle} / {totalCycles}
            </div>
            <div className="text-5xl font-mono font-black text-emerald-400">
              {formatTime(secondsLeft)}
            </div>
          </div>

          <div className="flex items-center justify-center gap-3 pt-2">
            <button
              onClick={() => {
                setCurrentQuizIndex(0);
                setSelectedOption(null);
                setIsAnswerRevealed(false);
                setIsAllQuizzesDone(false);
              }}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl transition flex items-center space-x-2 cursor-pointer shadow-lg shadow-indigo-600/30"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Review Question Set Again</span>
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* TOOLBAR: Active Question Set Info on Left & "Create New" on Right */}
          <div className="bg-slate-900/80 p-3.5 sm:p-4 rounded-2xl border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-lg">
            {/* Left Side: Question Set selector & index */}
            <div className="flex items-center space-x-3 w-full sm:w-auto justify-between sm:justify-start">
              <div className="flex items-center space-x-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400">
                  <Layers className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-indigo-400 font-bold">
                      Question Set:
                    </span>
                    <span className="text-xs font-bold text-white max-w-[180px] truncate">
                      {activeSet.title}
                    </span>
                  </div>
                  <div className="text-xs font-bold text-slate-300 flex items-center space-x-1.5 mt-0.5">
                    <span>
                      Question {currentQuizIndex + 1} of {questionsList.length}
                    </span>
                    <span className="text-slate-600">•</span>
                    <span className="text-[11px] text-slate-400 font-normal">
                      {questionsList.length} total
                    </span>
                  </div>
                </div>
              </div>

              {/* Prev / Next Question buttons */}
              <div className="flex items-center space-x-1 ml-3">
                <button
                  onClick={() => {
                    if (currentQuizIndex > 0) {
                      setCurrentQuizIndex((prev) => prev - 1);
                      setSelectedOption(null);
                      setIsAnswerRevealed(false);
                      setPoseHoldProgress(0);
                    }
                  }}
                  disabled={currentQuizIndex === 0}
                  className="p-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-300 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
                  title="Previous question"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => {
                    if (currentQuizIndex < questionsList.length - 1) {
                      setCurrentQuizIndex((prev) => prev + 1);
                      setSelectedOption(null);
                      setIsAnswerRevealed(false);
                      setPoseHoldProgress(0);
                    }
                  }}
                  disabled={currentQuizIndex === questionsList.length - 1}
                  className="p-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-300 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
                  title="Next question"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Right Side: Manage Sets & "Create New" Button */}
            <div className="flex items-center space-x-2 w-full sm:w-auto justify-end">
              <button
                onClick={() => setIsManageSetsOpen(true)}
                className="px-3 py-2 bg-slate-950 hover:bg-slate-800 border border-slate-700/80 text-slate-300 hover:text-white font-medium text-xs rounded-xl transition flex items-center space-x-1.5 cursor-pointer"
                title="View and switch question sets"
              >
                <BookOpen className="w-3.5 h-3.5 text-slate-400" />
                <span>Question Sets ({questionSets.length})</span>
              </button>

              <button
                onClick={handleOpenCreateSetModal}
                className="px-4 py-2 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-indigo-600/30 transition flex items-center space-x-2 cursor-pointer transform active:scale-95"
                title="Create a new question set"
              >
                <Plus className="w-4 h-4 text-white" />
                <span>Create New Set</span>
              </button>
            </div>
          </div>

          {/* Main Question Arena */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 min-w-0">
            {/* Left Column: Camera Motion Tracker */}
            <div className="md:col-span-5 bg-slate-900/90 rounded-2xl border border-slate-800 p-4 flex flex-col justify-between space-y-4 shadow-2xl min-w-0">
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs font-bold text-slate-300">
                  <div className="flex items-center space-x-1.5">
                    {cameraEnabled ? (
                      <Camera className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <CameraOff className="w-4 h-4 text-amber-400" />
                    )}
                    <span>Camera Motion Tracker</span>
                  </div>
                  <button
                    onClick={onOpenPermissionModal}
                    className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-[10px] font-mono transition cursor-pointer"
                  >
                    Permissions
                  </button>
                </div>

                <div className="relative w-full aspect-video bg-black rounded-xl overflow-hidden border border-slate-800 flex items-center justify-center shadow-inner">
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
                      <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
                        <CameraOff className="w-6 h-6" />
                      </div>
                      <div className="space-y-1 max-w-xs">
                        <h4 className="text-sm font-bold text-white">Camera Access Disabled</h4>
                        <p className="text-[11px] text-slate-400 leading-relaxed">
                          Enable camera to answer questions via body poses, or tap any answer directly!
                        </p>
                      </div>
                      <div className="flex items-center gap-2 pt-1">
                        <button
                          onClick={handleEnableCameraDirect}
                          disabled={isActivatingCam}
                          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-lg shadow-md transition flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
                        >
                          <Camera className="w-3.5 h-3.5" />
                          <span>{isActivatingCam ? 'Connecting...' : 'Turn On Camera'}</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {cameraEnabled && poseHoldProgress > 0 && !isAnswerRevealed && (
                    <div className="absolute inset-0 bg-indigo-950/40 backdrop-blur-[2px] flex flex-col items-center justify-center p-4">
                      <div className="text-xs font-bold font-mono text-white mb-2 uppercase tracking-wider flex items-center space-x-1.5">
                        <Zap className="w-4 h-4 text-yellow-400 animate-bounce" />
                        <span>Holding Pose: {poseHoldProgress}%</span>
                      </div>
                      <div className="w-48 h-3 bg-slate-950 rounded-full overflow-hidden border border-indigo-400/40 shadow-lg">
                        <div
                          className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-emerald-400 transition-all duration-100"
                          style={{ width: `${poseHoldProgress}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {cameraEnabled && (
                    <div className="absolute bottom-2 left-2 right-2 px-2.5 py-1.5 bg-slate-950/85 backdrop-blur border border-slate-700/60 text-[11px] font-mono text-slate-200 rounded-lg flex items-center justify-between">
                      <span className="text-indigo-300 font-bold truncate">{detectedPoseName}</span>
                      <span className="text-[10px] text-emerald-400 font-bold ml-2">Motion Ready</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Voice & Rule instructions */}
              <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-2.5 text-xs">
                <div className="flex items-center justify-between text-slate-300 font-bold text-[11px] uppercase tracking-wider">
                  <span>Voice Assistant</span>
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
                    title={speechEnabled ? 'Mute voice' : 'Unmute voice'}
                  >
                    {speechEnabled ? (
                      <Volume2 className="w-3.5 h-3.5 text-indigo-400" />
                    ) : (
                      <VolumeX className="w-3.5 h-3.5 text-slate-500" />
                    )}
                  </button>
                </div>

                <div className="text-[11px] text-slate-400 space-y-1">
                  <div className="flex items-center space-x-1.5 text-amber-300 font-medium">
                    <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>How to Answer:</span>
                  </div>
                  <p className="text-[10px] leading-relaxed text-slate-400">
                    Perform the physical movement assigned to your chosen answer and hold for 1.2s, or click directly.
                  </p>
                </div>

                <button
                  onClick={speakCurrentQuestion}
                  className="w-full py-1.5 bg-slate-900 hover:bg-slate-850 text-indigo-300 border border-indigo-500/30 rounded-lg text-[11px] font-mono font-bold flex items-center justify-center space-x-1.5 cursor-pointer transition"
                >
                  <Volume2 className="w-3.5 h-3.5" />
                  <span>Replay Audio</span>
                </button>
              </div>
            </div>

            {/* Right Column: Question Display & Answers */}
            <div className="md:col-span-7 bg-slate-900/90 rounded-2xl border border-slate-800 p-6 sm:p-7 shadow-2xl flex flex-col justify-between space-y-5 min-w-0">
              {/* Question Header */}
              <div className="flex items-center justify-between border-b border-slate-800 pb-4 min-w-0">
                <div className="flex items-center space-x-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-400 flex-shrink-0">
                    <HelpCircle className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[10px] font-mono text-indigo-400 font-bold uppercase tracking-wider">
                      Question {currentQuizIndex + 1} of {questionsList.length}
                    </div>
                    <div className="text-xs font-bold text-slate-300 truncate">
                      {currentQuiz.options?.length || 2} Answer Options
                    </div>
                  </div>
                </div>

                <span className="px-3 py-1 rounded-xl font-bold font-mono text-xs border bg-indigo-500/20 border-indigo-500/40 text-indigo-300 flex items-center space-x-1.5">
                  <Sparkles className="w-3 h-3 text-indigo-400" />
                  <span>Motion or Click</span>
                </span>
              </div>

              {/* Question Text */}
              <div className="space-y-2 min-w-0">
                <div className="text-base sm:text-lg font-bold text-slate-100 bg-slate-950 p-4 sm:p-5 rounded-2xl border border-slate-800/80 shadow-inner leading-relaxed">
                  "{currentQuiz.question}"
                </div>
              </div>

              {/* Answer Options Grid */}
              <div
                className={`grid gap-3.5 min-w-0 ${
                  (currentQuiz.options || []).length <= 2 ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2'
                }`}
              >
                {(currentQuiz.options || []).map((opt) => {
                  const isSelected = selectedOption === opt.id;
                  const isCorrectOpt = Boolean(opt.isCorrect);

                  return (
                    <div
                      key={opt.id}
                      onClick={() => handleOptionSelect(opt)}
                      className={`p-4 rounded-2xl border transition-all duration-200 min-w-0 select-none cursor-pointer group ${
                        isAnswerRevealed && isCorrectOpt
                          ? 'bg-emerald-950/70 border-emerald-500 text-emerald-100 shadow-lg shadow-emerald-500/20'
                          : isAnswerRevealed && isSelected && !isCorrectOpt
                          ? 'bg-rose-950/60 border-rose-500 text-rose-200'
                          : isAnswerRevealed
                          ? 'bg-slate-950/40 border-slate-900 opacity-60'
                          : 'bg-slate-950/80 border-slate-800 text-slate-200 hover:border-indigo-500/70 hover:bg-slate-900 active:scale-[0.99]'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="px-2 py-0.5 bg-indigo-500/30 border border-indigo-400/40 text-indigo-300 text-xs font-mono font-black rounded uppercase">
                          OPTION {opt.letter}
                        </span>
                        {isAnswerRevealed && isCorrectOpt && (
                          <span className="px-2 py-0.5 bg-emerald-500 text-slate-950 text-[10px] font-black rounded flex items-center space-x-1">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>CORRECT</span>
                          </span>
                        )}
                        {isAnswerRevealed && isSelected && !isCorrectOpt && (
                          <span className="px-2 py-0.5 bg-rose-500 text-white text-[10px] font-black rounded flex items-center space-x-1">
                            <XCircle className="w-3 h-3" />
                            <span>SELECTED</span>
                          </span>
                        )}
                      </div>

                      <p className="text-xs sm:text-sm font-semibold text-slate-100 leading-snug">
                        {opt.text}
                      </p>

                      <div className="mt-3 p-2 bg-indigo-950/40 border border-indigo-500/20 rounded-xl flex items-center justify-between text-xs">
                        <div className="flex items-center space-x-1.5 min-w-0">
                          <Dumbbell className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0" />
                          <span className="text-[11px] font-mono text-indigo-200 font-bold truncate">
                            {opt.requiredPose && opt.requiredPose !== 'none'
                              ? `Pose: ${opt.action}`
                              : 'Tap / Click to answer'}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Explanation & Next Question Button */}
              {isAnswerRevealed && (
                <div className="bg-gradient-to-r from-emerald-950/60 via-slate-950 to-indigo-950/60 border border-emerald-500/40 p-4 sm:p-5 rounded-2xl space-y-3 shadow-xl animate-in fade-in duration-300 min-w-0">
                  <div className="flex items-center space-x-2 text-emerald-300 text-xs font-bold font-mono">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                    <span>
                      {currentQuiz.options?.find((o) => o.id === selectedOption)?.isCorrect
                        ? 'Correct answer! (+15 HP)'
                        : 'Good effort! Remember this for next time (+5 HP).'}
                    </span>
                  </div>

                  <button
                    onClick={handleNextQuestion}
                    className="mt-2 w-full py-2.5 bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-bold text-xs rounded-xl transition shadow-lg shadow-emerald-500/20 flex items-center justify-center space-x-2 cursor-pointer active:scale-98"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>
                      {currentQuizIndex < questionsList.length - 1
                        ? `Next Question (${currentQuizIndex + 2} of ${questionsList.length})`
                        : 'Finish Questions (Rest Your Eyes)'}
                    </span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* ========================================================================= */}
      {/* QUESTION SET BUILDER MODAL (Prompt-Free, Square + Box, Right + for Next Q) */}
      {/* ========================================================================= */}
      {isCreateSetModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-4xl p-6 space-y-6 shadow-2xl my-6">
            {/* Header: Title input and Close */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-600/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400">
                  <FolderPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Create New Question Set</h3>
                  <p className="text-xs text-slate-400">
                    Build a set of questions with custom answers and movement poses.
                  </p>
                </div>
              </div>

              <button
                onClick={() => setIsCreateSetModalOpen(false)}
                className="text-slate-400 hover:text-white p-2 rounded-xl hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Set Title Input */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-mono uppercase font-bold text-slate-400 tracking-wider">
                Question Set Title
              </label>
              <input
                type="text"
                value={builderSetTitle}
                onChange={(e) => setBuilderSetTitle(e.target.value)}
                placeholder="e.g., Biology Review / Ergonomics & Focus Set"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>

            {/* ERROR MESSAGE IF ANY */}
            {builderError && (
              <div className="p-3 bg-rose-950/80 border border-rose-500/50 rounded-xl text-rose-300 text-xs flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-400" />
                <span>{builderError}</span>
              </div>
            )}

            {/* BUILDER CONTENT */}
            {builderQuestions.length === 0 ? (
              /* CASE 1: NO QUESTIONS YET -> Square frame with "+" in the center! */
              <div className="py-12 flex flex-col items-center justify-center">
                <div
                  onClick={handleCreateFirstQuestion}
                  className="w-56 h-56 rounded-3xl border-2 border-dashed border-indigo-500/40 hover:border-indigo-400 bg-indigo-950/10 hover:bg-indigo-950/30 flex flex-col items-center justify-center cursor-pointer transition group p-6 text-center space-y-3"
                  title="Click to add Question 1"
                >
                  <div className="w-16 h-16 rounded-2xl bg-indigo-600/30 border border-indigo-500/50 flex items-center justify-center text-indigo-300 group-hover:scale-110 transition duration-200 shadow-lg shadow-indigo-600/20">
                    <Plus className="w-8 h-8 text-white" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white group-hover:text-indigo-300 transition">
                      Add Question 1
                    </h4>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Click the square to start your question set
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              /* CASE 2: QUESTIONS EXIST -> Stepper, Question Editor, Answer List + Underneath, Right + Button */
              <div className="space-y-4">
                {/* Horizontal Question Badges (Tabs) */}
                <div className="flex items-center space-x-2 overflow-x-auto pb-2 border-b border-slate-800">
                  {builderQuestions.map((q, qIdx) => {
                    const isActive = qIdx === builderActiveQIndex;
                    return (
                      <button
                        key={q.id || qIdx}
                        type="button"
                        onClick={() => {
                          setBuilderActiveQIndex(qIdx);
                          setBuilderStep(q.question.trim() ? 'answers' : 'question');
                          setBuilderError('');
                        }}
                        className={`px-3 py-1.5 rounded-xl font-mono text-xs font-bold transition flex items-center space-x-1.5 cursor-pointer whitespace-nowrap ${
                          isActive
                            ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                            : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                        }`}
                      >
                        <span>Question {qIdx + 1}</span>
                        {builderQuestions.length > 1 && (
                          <span
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteQuestionFromBuilder(qIdx);
                            }}
                            className="p-0.5 hover:bg-red-500/30 text-slate-400 hover:text-red-300 rounded ml-1"
                            title="Delete this question"
                          >
                            <Trash2 className="w-3 h-3" />
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Question Editor Arena with Right Side "+" Button */}
                <div className="flex flex-col md:flex-row items-stretch gap-4">
                  
                  {/* Left/Center Box: Active Question (Step 1: Question Only -> Step 2: Answers) */}
                  <div className="flex-1 bg-slate-950 p-5 rounded-2xl border border-slate-800 space-y-4">
                    
                    {builderStep === 'question' ? (
                      /* PHASE 1: ONLY QUESTION INPUT */
                      <div className="space-y-4 py-4">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-mono uppercase font-bold text-indigo-400 tracking-wider">
                            Step 1: Enter Question {builderActiveQIndex + 1}
                          </span>
                        </div>

                        <div className="space-y-2">
                          <textarea
                            value={editorQ?.question || ''}
                            onChange={(e) => handleUpdateCurrentQuestionText(e.target.value)}
                            placeholder="Type your question here (e.g., What is the 20-20-20 rule for eye health?)..."
                            rows={4}
                            autoFocus
                            className="w-full bg-slate-900 border border-slate-700 rounded-2xl p-4 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 leading-relaxed shadow-inner"
                          />
                        </div>

                        <div className="flex justify-end pt-2">
                          <button
                            type="button"
                            onClick={handleProceedToAnswers}
                            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl transition flex items-center space-x-2 shadow-lg shadow-indigo-600/30 cursor-pointer"
                          >
                            <span>Next: Enter Answers</span>
                            <ArrowRight className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      /* PHASE 2: ENTER ANSWERS ONLY (Prompt removed completely!) */
                      <div className="space-y-4">
                        {/* Question Summary with Edit button */}
                        <div className="bg-slate-900/90 p-3.5 rounded-xl border border-slate-800 flex items-start justify-between gap-3">
                          <div>
                            <div className="text-[10px] font-mono text-indigo-400 uppercase font-bold">
                              Question {builderActiveQIndex + 1}
                            </div>
                            <div className="text-sm font-semibold text-slate-200 mt-0.5">
                              "{editorQ?.question}"
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => setBuilderStep('question')}
                            className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] rounded-lg transition flex items-center space-x-1 cursor-pointer flex-shrink-0"
                            title="Edit question text"
                          >
                            <Edit3 className="w-3 h-3" />
                            <span>Edit</span>
                          </button>
                        </div>

                        {/* Answers Heading */}
                        <div className="flex items-center justify-between pt-1">
                          <span className="text-xs font-mono uppercase font-bold text-slate-300 tracking-wider">
                            Answer Options ({editorQ?.options.length})
                          </span>
                          <span className="text-[11px] text-slate-400">
                            Select one correct answer
                          </span>
                        </div>

                        {/* List of answers */}
                        <div className="space-y-3">
                          {editorQ?.options.map((opt, oIdx) => (
                            <div
                              key={opt.id || oIdx}
                              className={`p-3.5 rounded-xl border transition-all ${
                                opt.isCorrect
                                  ? 'bg-emerald-950/30 border-emerald-500/70 ring-1 ring-emerald-500/30'
                                  : 'bg-slate-900 border-slate-800'
                              }`}
                            >
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center space-x-2">
                                  <span className="px-2 py-0.5 bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 rounded text-[10px] font-mono font-bold">
                                    Option {opt.letter}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => handleSetCorrectOption(oIdx)}
                                    className={`text-xs px-2.5 py-1 rounded-lg font-mono font-bold transition flex items-center space-x-1.5 cursor-pointer ${
                                      opt.isCorrect
                                        ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/30'
                                        : 'bg-slate-800 text-slate-400 hover:text-emerald-300 border border-slate-700'
                                    }`}
                                  >
                                    <Check className="w-3.5 h-3.5" />
                                    <span>{opt.isCorrect ? 'Correct Answer' : 'Mark as Correct'}</span>
                                  </button>
                                </div>

                                {editorQ.options.length > 2 && (
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveOption(oIdx)}
                                    className="text-slate-500 hover:text-rose-400 p-1 rounded transition cursor-pointer"
                                    title="Delete this option"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>

                              {/* Answer Text Input */}
                              <input
                                type="text"
                                value={opt.text}
                                onChange={(e) => handleUpdateOptionText(oIdx, e.target.value)}
                                placeholder={`Enter answer for Option ${opt.letter}...`}
                                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 mb-2.5"
                              />

                              {/* Movement Pose selection */}
                              <div className="flex items-center justify-between bg-slate-950/70 p-2 rounded-lg border border-slate-800 text-xs">
                                <span className="text-[11px] text-slate-400 flex items-center space-x-1">
                                  <Dumbbell className="w-3 h-3 text-indigo-400" />
                                  <span>Movement Pose:</span>
                                </span>
                                <select
                                  value={opt.requiredPose || 'none'}
                                  onChange={(e) => handleUpdateOptionPose(oIdx, e.target.value)}
                                  className="bg-slate-900 border border-slate-700 text-indigo-300 text-xs rounded px-2 py-1 font-mono focus:outline-none"
                                >
                                  <option value="lateral_raise">Lateral Arm Raise</option>
                                  <option value="squat">Squat Hold</option>
                                  <option value="hammer_curl">Bicep Curl</option>
                                  <option value="none">Tap / Click Only</option>
                                </select>
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* "+" BUTTON DIRECTLY UNDERNEATH ANSWERS to add another answer */}
                        <button
                          type="button"
                          onClick={handleAddOptionBelow}
                          className="w-full py-2.5 border-2 border-dashed border-indigo-500/30 hover:border-indigo-500/70 bg-indigo-950/20 hover:bg-indigo-950/40 text-indigo-300 hover:text-indigo-200 rounded-xl text-xs font-bold font-mono transition flex items-center justify-center space-x-2 cursor-pointer"
                        >
                          <Plus className="w-4 h-4" />
                          <span>Add Another Answer Option</span>
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Right Side: "+" BUTTON TO ADVANCE TO NEXT QUESTION */}
                  <div className="flex md:flex-col items-center justify-center">
                    <button
                      type="button"
                      onClick={handleAddNextQuestionOnRight}
                      className="w-full md:w-28 p-4 md:py-8 bg-indigo-950/40 hover:bg-indigo-900/60 border-2 border-dashed border-indigo-500/40 hover:border-indigo-400 text-indigo-300 hover:text-white rounded-2xl flex md:flex-col items-center justify-center gap-2 transition cursor-pointer group shadow-lg"
                      title="Add next question to this set"
                    >
                      <div className="w-10 h-10 rounded-xl bg-indigo-600/30 group-hover:bg-indigo-600/50 border border-indigo-400/40 flex items-center justify-center text-white">
                        <Plus className="w-5 h-5 group-hover:scale-125 transition" />
                      </div>
                      <span className="text-xs font-bold text-center">
                        Next Question
                      </span>
                    </button>
                  </div>

                </div>
              </div>
            )}

            {/* Footer Buttons */}
            <div className="flex items-center justify-between border-t border-slate-800 pt-4">
              <span className="text-xs text-slate-400 font-mono">
                {builderQuestions.length} {builderQuestions.length === 1 ? 'question' : 'questions'} in this set
              </span>

              <div className="flex items-center space-x-3">
                <button
                  type="button"
                  onClick={() => setIsCreateSetModalOpen(false)}
                  className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl transition cursor-pointer"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={handleSaveQuestionSet}
                  disabled={builderQuestions.length === 0}
                  className="px-6 py-2.5 bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-emerald-600/30 transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  Save Question Set
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MANAGE QUESTION SETS MODAL */}
      {/* ========================================================================= */}
      {isManageSetsOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-xl p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400">
                  <BookOpen className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Manage Question Sets</h3>
                  <p className="text-xs text-slate-400">Select an active set or delete existing ones</p>
                </div>
              </div>
              <button
                onClick={() => setIsManageSetsOpen(false)}
                className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 max-h-[55vh] overflow-y-auto pr-1">
              {questionSets.map((set) => {
                const isActive = set.id === activeSetId;
                return (
                  <div
                    key={set.id}
                    className={`p-4 rounded-2xl border transition flex items-center justify-between ${
                      isActive
                        ? 'bg-indigo-950/40 border-indigo-500/80 ring-1 ring-indigo-500/40'
                        : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div>
                      <div className="flex items-center space-x-2">
                        <h4 className="text-sm font-bold text-white">{set.title}</h4>
                        {isActive && (
                          <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-mono font-bold rounded">
                            Active
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 mt-1">
                        {set.questions?.length || 0} questions
                      </p>
                    </div>

                    <div className="flex items-center space-x-2">
                      {!isActive && (
                        <button
                          onClick={() => {
                            handleSelectSet(set.id);
                            setIsManageSetsOpen(false);
                          }}
                          className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl transition cursor-pointer"
                        >
                          Select Set
                        </button>
                      )}

                      {questionSets.length > 1 && (
                        <button
                          onClick={() => handleDeleteSet(set.id)}
                          className="p-2 text-slate-500 hover:text-rose-400 hover:bg-slate-800 rounded-xl transition cursor-pointer"
                          title="Delete set"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="pt-2 flex items-center justify-between">
              <button
                onClick={() => {
                  setIsManageSetsOpen(false);
                  handleOpenCreateSetModal();
                }}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl transition flex items-center space-x-1.5 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Create New Set</span>
              </button>

              <button
                onClick={() => setIsManageSetsOpen(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

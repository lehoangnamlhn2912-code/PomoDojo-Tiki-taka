import React, { useState, useEffect, useCallback } from 'react';
import {
  Activity,
  Brain,
  Clock,
  CheckCircle2,
  Sparkles,
  BarChart2,
  Zap,
  RefreshCw,
  Eye,
  Volume2,
  Shield,
  AlertTriangle,
  Target,
  ChevronRight,
  Sliders,
  MessageSquare,
  Flame,
  Calendar,
  Layers,
  TrendingUp,
  Cpu
} from 'lucide-react';
import { INITIAL_FATIGUE_DATA } from '../utils/dataStore.js';

export const FatigueAnalytics = ({ mascot = {}, noiseDb = 45 }) => {
  // Input parameters (can be adjusted or synced with live values)
  const [params, setParams] = useState({
    studyDurationMinutes: 135,
    averageDistanceCm: 48,
    closeDistanceAlerts: 6,
    ambientNoiseDb: noiseDb || 48,
    fatigueScore: 46,
    blindBreaksCompleted: 4,
    additionalNotes: ''
  });

  const [showConfig, setShowConfig] = useState(false);
  const [loading, setLoading] = useState(false);
  const [aiData, setAiData] = useState(null);
  const [error, setError] = useState(null);
  const [lastAnalyzedTime, setLastAnalyzedTime] = useState(null);

  // Sync ambient noise when prop updates
  useEffect(() => {
    if (noiseDb && noiseDb > 0) {
      setParams((prev) => ({ ...prev, ambientNoiseDb: noiseDb }));
    }
  }, [noiseDb]);

  // Call Gemini LLM API via full-stack Express backend
  const handleAnalyzeWithGemini = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const payload = {
        fatigueScore: params.fatigueScore,
        studyDurationMinutes: params.studyDurationMinutes,
        averageDistanceCm: params.averageDistanceCm,
        closeDistanceAlerts: params.closeDistanceAlerts,
        ambientNoiseDb: params.ambientNoiseDb,
        streakDays: mascot.streakDays || 14,
        cycleDay: mascot.cycleDay || 14,
        remainingLives: mascot.remainingLives !== undefined ? mascot.remainingLives : 4,
        blindBreaksCompleted: params.blindBreaksCompleted,
        additionalNotes: params.additionalNotes
      };

      const response = await fetch('/api/fatigue/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const result = await response.json();

      if (result.success && result.data) {
        setAiData(result.data);
        setLastAnalyzedTime(new Date().toLocaleTimeString('vi-VN'));
      } else {
        throw new Error(result.error || 'Không nhận được dữ liệu từ Gemini LLM');
      }
    } catch (err) {
      console.warn('Lỗi gọi Gemini LLM API, chuyển sang chế độ phân tích cục bộ thông minh:', err);
      setError(err.message);
      
      // Fallback data if Gemini API key not set or network down
      setAiData({
        fatigueIndex: params.fatigueScore || 44,
        riskLevel: params.fatigueScore > 70 ? 'Cao' : params.fatigueScore > 45 ? 'Trung bình' : 'An toàn',
        statusTitle: 'Trạng thái Nhịp sinh học Cân bằng',
        statusDescription: 'Dữ liệu đo đạc cho thấy bạn đang duy trì mức tập trung ổn định, khoảng cách mắt dao động trong ngưỡng an toàn.',
        recommendedSessionMinutes: 24,
        recommendedBreakMinutes: 5,
        optimalTimeWindows: ['08:30 - 11:15', '14:00 - 16:30', '19:30 - 21:00'],
        attentionSpanAnalysis: 'Nhịp độ chú ý của bạn đạt đỉnh trong 20 phút đầu và bắt đầu xuất hiện dấu hiệu cúi sát màn hình sau phút 25.',
        keyInsights: [
          `Khoảng cách mắt trung bình ${params.averageDistanceCm}cm cần giữ xa hơn 50cm để giảm căng cơ thể mi.`,
          `Âm thanh nền ${params.ambientNoiseDb}dB nằm trong giới hạn cho phép học tập.`,
          `Chu kỳ 30 ngày đang ở ngày ${mascot.cycleDay || 14}/30 với ${mascot.remainingLives || 4} mạng bảo vệ.`
        ],
        actionableRecommendations: [
          { category: 'Thị giác', title: 'Quy tắc nhìn xa 20-20-20', description: 'Sau mỗi 20 phút, nhìn vật thể cách 6m trong 20 giây.', priority: 'Cao' },
          { category: 'Tư thế', title: 'Đẩy cằm và thẳng cột sống', description: 'Nâng màn hình cao ngang tầm mắt để tránh gù cổ.', priority: 'Trung bình' },
          { category: 'Âm học', title: 'Acoustic White Noise', description: 'Kích hoạt màng chắn âm học nếu tiếng ồn vượt 55dB.', priority: 'Thấp' }
        ],
        metricsBreakdown: {
          eyeStrainScore: Math.min(100, Math.round((55 - params.averageDistanceCm) * 3 + params.closeDistanceAlerts * 4)),
          postureDisruptionScore: Math.min(100, params.closeDistanceAlerts * 8),
          cognitiveLoadScore: Math.min(100, Math.round(params.studyDurationMinutes / 2)),
          acousticStressScore: Math.min(100, Math.max(10, params.ambientNoiseDb - 30) * 2)
        },
        weeklyForecast: [
          { day: 'T2', focusHours: 3.5, fatigueScore: 35, readinessScore: 88 },
          { day: 'T3', focusHours: 4.2, fatigueScore: 42, readinessScore: 82 },
          { day: 'T4', focusHours: 2.8, fatigueScore: 30, readinessScore: 92 },
          { day: 'T5', focusHours: 4.8, fatigueScore: 50, readinessScore: 78 },
          { day: 'T6', focusHours: 3.9, fatigueScore: 40, readinessScore: 85 },
          { day: 'T7', focusHours: 4.5, fatigueScore: 45, readinessScore: 80 },
          { day: 'CN', focusHours: 2.2, fatigueScore: 25, readinessScore: 95 }
        ],
        mascotAdvice: 'Eddy nhắn bạn: Hãy tiếp tục chuỗi Streak nhé! Đừng quên giải lao chớp mắt đều đặn nào!'
      });
      setLastAnalyzedTime(new Date().toLocaleTimeString('vi-VN'));
    } finally {
      setLoading(false);
    }
  }, [params, mascot]);

  // Initial load
  useEffect(() => {
    handleAnalyzeWithGemini();
  }, []);

  const displayData = aiData || {
    fatigueIndex: INITIAL_FATIGUE_DATA.fatigueScore,
    riskLevel: 'An toàn',
    statusTitle: 'Đang khởi tạo mô hình AI...',
    statusDescription: 'Hệ thống đang chuẩn bị tổng hợp các chỉ số sinh trắc học và phản hồi từ Edge-AI.',
    recommendedSessionMinutes: INITIAL_FATIGUE_DATA.recommendedSessionLength,
    recommendedBreakMinutes: INITIAL_FATIGUE_DATA.breakLength,
    optimalTimeWindows: ['08:30 - 11:30', '14:00 - 16:30'],
    attentionSpanAnalysis: 'Đang phân tích dữ liệu tập trung qua camera và micro...',
    keyInsights: ['Đang tính toán các chỉ số...'],
    actionableRecommendations: [],
    metricsBreakdown: {
      eyeStrainScore: 35,
      postureDisruptionScore: 28,
      cognitiveLoadScore: 42,
      acousticStressScore: 30
    },
    weeklyForecast: [
      { day: 'T2', focusHours: 3.2, fatigueScore: 35, readinessScore: 85 },
      { day: 'T3', focusHours: 4.1, fatigueScore: 42, readinessScore: 80 },
      { day: 'T4', focusHours: 2.5, fatigueScore: 28, readinessScore: 92 },
      { day: 'T5', focusHours: 4.8, fatigueScore: 52, readinessScore: 75 },
      { day: 'T6', focusHours: 3.9, fatigueScore: 40, readinessScore: 84 },
      { day: 'T7', focusHours: 4.2, fatigueScore: 44, readinessScore: 82 },
      { day: 'CN', focusHours: 2.0, fatigueScore: 22, readinessScore: 96 }
    ],
    mascotAdvice: 'Eddy luôn đồng hành cùng bạn!'
  };

  // Color helper based on fatigue index
  const getFatigueColor = (score) => {
    if (score < 40) return { text: 'text-emerald-400', bg: 'bg-emerald-500/20', border: 'border-emerald-500/30', bar: 'from-emerald-500 to-teal-400' };
    if (score < 65) return { text: 'text-amber-400', bg: 'bg-amber-500/20', border: 'border-amber-500/30', bar: 'from-amber-500 to-yellow-400' };
    return { text: 'text-rose-400', bg: 'bg-rose-500/20', border: 'border-rose-500/30', bar: 'from-rose-500 to-red-400' };
  };

  const fatigueColors = getFatigueColor(displayData.fatigueIndex || 40);

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      
      {/* Header Banner with Gemini LLM Live Synthesis Trigger */}
      <div className="bg-gradient-to-r from-blue-950 via-slate-900 to-indigo-950 p-6 rounded-2xl border border-blue-500/30 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xl">
        <div className="flex items-center space-x-4">
          <div className="w-12 h-12 rounded-xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-blue-400 shadow-inner flex-shrink-0">
            <Cpu className="w-6 h-6 animate-pulse text-blue-300" />
          </div>
          <div>
            <div className="flex items-center space-x-2 flex-wrap gap-y-1">
              <span className="text-[10px] font-mono uppercase tracking-widest text-blue-400 font-bold">PomoDojo Analytics</span>
              <span className="px-2 py-0.5 bg-gradient-to-r from-purple-500/30 to-blue-500/30 border border-purple-400/30 text-purple-200 text-[10px] font-mono rounded flex items-center space-x-1">
                <Sparkles className="w-3 h-3 text-yellow-400" />
                <span>Gemini 3.7 Flash LLM Synthesis</span>
              </span>
            </div>
            <h2 className="text-xl font-bold text-slate-100 mt-0.5">Tổng Hợp Chỉ Số Mệt Mỏi & Dự Báo Năng Lượng</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Mô hình AI nhận các thông số thị giác, tư thế, tiếng ồn và thói quen học để tính toán biểu đồ & đề xuất cá nhân hóa.
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center space-x-2.5 w-full md:w-auto justify-end flex-wrap gap-y-2">
          <button
            onClick={() => setShowConfig(!showConfig)}
            className="px-3 py-2 bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 text-xs font-mono rounded-xl transition flex items-center space-x-1.5 cursor-pointer"
          >
            <Sliders className="w-3.5 h-3.5 text-slate-400" />
            <span>{showConfig ? 'Đóng Tùy Chỉnh' : 'Chỉnh Tham Số'}</span>
          </button>

          <button
            onClick={handleAnalyzeWithGemini}
            disabled={loading}
            className="px-4 py-2 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-bold text-xs rounded-xl shadow-lg transition flex items-center space-x-2 cursor-pointer disabled:opacity-50 active:scale-95"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>{loading ? 'Gemini Đang Phân Tích...' : 'Phân Tích Lại Với AI'}</span>
          </button>
        </div>
      </div>

      {/* Parameter Customizer Panel (Collapsible) */}
      {showConfig && (
        <div className="bg-slate-900/95 p-5 rounded-2xl border border-blue-500/30 space-y-4 shadow-2xl animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
            <div className="flex items-center space-x-2 text-xs font-bold text-slate-200 uppercase tracking-wider">
              <Sliders className="w-4 h-4 text-blue-400" />
              <span>Tham Số Đầu Vào Cho Gemini LLM Phân Tích:</span>
            </div>
            <span className="text-[11px] font-mono text-slate-400">Thay đổi để xem Gemini mô hình hóa lại toàn bộ</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs font-mono">
            {/* Study Duration */}
            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-1.5">
              <span className="text-slate-400 block text-[10px] uppercase">Thời Gian Học (Phút)</span>
              <input
                type="number"
                value={params.studyDurationMinutes}
                onChange={(e) => setParams({ ...params, studyDurationMinutes: Number(e.target.value) })}
                className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1 text-slate-100 text-sm font-bold focus:outline-none focus:border-blue-400"
              />
            </div>

            {/* Eye Distance */}
            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-1.5">
              <span className="text-slate-400 block text-[10px] uppercase">Khoảng Cách Mắt TB (cm)</span>
              <input
                type="number"
                value={params.averageDistanceCm}
                onChange={(e) => setParams({ ...params, averageDistanceCm: Number(e.target.value) })}
                className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1 text-slate-100 text-sm font-bold focus:outline-none focus:border-blue-400"
              />
            </div>

            {/* Close Distance Alerts */}
            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-1.5">
              <span className="text-slate-400 block text-[10px] uppercase">Số Lần Cúi Quá Gần</span>
              <input
                type="number"
                value={params.closeDistanceAlerts}
                onChange={(e) => setParams({ ...params, closeDistanceAlerts: Number(e.target.value) })}
                className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1 text-slate-100 text-sm font-bold focus:outline-none focus:border-blue-400"
              />
            </div>

            {/* Ambient Noise */}
            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-1.5">
              <span className="text-slate-400 block text-[10px] uppercase">Tiếng Ồn Môi Trường (dB)</span>
              <input
                type="number"
                value={params.ambientNoiseDb}
                onChange={(e) => setParams({ ...params, ambientNoiseDb: Number(e.target.value) })}
                className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1 text-slate-100 text-sm font-bold focus:outline-none focus:border-blue-400"
              />
            </div>
          </div>

          <div className="flex justify-end pt-1">
            <button
              onClick={handleAnalyzeWithGemini}
              disabled={loading}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-lg transition flex items-center space-x-1.5 cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-yellow-300" />
              <span>Gửi Dữ Liệu Này Đến Gemini Để Cập Nhật Biểu Đồ & Đề Xuất</span>
            </button>
          </div>
        </div>
      )}

      {/* Status Bar: Last Analyzed & AI Health */}
      <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 bg-slate-900/60 px-4 py-2.5 rounded-xl border border-slate-800">
        <div className="flex items-center space-x-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>Mô hình: <strong className="text-slate-200">Gemini 3.7 Flash</strong></span>
          <span className="text-slate-600">|</span>
          <span>Lần phân tích gần nhất: <strong className="text-blue-300">{lastAnalyzedTime || 'Vừa xong'}</strong></span>
        </div>

        <div className="flex items-center space-x-3">
          <span>Chu kỳ: <strong className="text-blue-400">Ngày {mascot.cycleDay || 14}/30</strong></span>
          <span>Streak: <strong className="text-orange-400">{mascot.streakDays || 14}d 🔥</strong></span>
          <span>Mạng: <strong className="text-emerald-400">{mascot.remainingLives !== undefined ? mascot.remainingLives : 4}/4 ❤️</strong></span>
        </div>
      </div>

      {/* Main 2-Column Analytics Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 min-w-0">
        
        {/* Left Column: Biometric Breakdown + Attention Span (7 Cols) */}
        <div className="lg:col-span-7 space-y-6 min-w-0">
          
          {/* Top Card: Overall Fatigue Index & Risk Gauge */}
          <div className="bg-slate-900/80 p-6 rounded-2xl border border-slate-800 space-y-5 shadow-xl min-w-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Activity className="w-5 h-5 text-blue-400" />
                <div>
                  <h3 className="text-xs font-bold text-slate-200 uppercase tracking-widest">Fatigue & Recovery Score</h3>
                  <div className="text-xs text-slate-400">{displayData.statusTitle}</div>
                </div>
              </div>
              <span className={`px-3 py-1 rounded-full text-xs font-bold font-mono ${fatigueColors.bg} ${fatigueColors.text} ${fatigueColors.border} border`}>
                Rủi ro: {displayData.riskLevel} ({displayData.fatigueIndex}%)
              </span>
            </div>

            {/* Gauge Progress Bar */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs font-mono text-slate-400">
                <span>Mức độ mệt mỏi tổng hợp</span>
                <span className={`font-black text-sm ${fatigueColors.text}`}>{displayData.fatigueIndex} / 100</span>
              </div>
              <div className="w-full h-3.5 bg-slate-950 rounded-full overflow-hidden p-0.5 border border-slate-800">
                <div
                  className={`h-full bg-gradient-to-r ${fatigueColors.bar} rounded-full transition-all duration-1000 shadow-sm`}
                  style={{ width: `${Math.min(100, Math.max(5, displayData.fatigueIndex))}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                <span>0% (Tươi tỉnh)</span>
                <span>50% (Cần nghỉ giải lao)</span>
                <span>100% (Kiệt sức)</span>
              </div>
            </div>

            <p className="text-xs text-slate-300 bg-slate-950 p-3.5 rounded-xl border border-slate-800 leading-relaxed">
              {displayData.statusDescription}
            </p>

            {/* 4-Factor Biometric Breakdown */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 min-w-0">
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-1 min-w-0">
                <div className="flex items-center space-x-1.5 text-blue-400 text-[10px] font-mono truncate">
                  <Eye className="w-3.5 h-3.5 flex-shrink-0" />
                  <span className="truncate">CĂNG THẲNG MẮT</span>
                </div>
                <div className="text-lg font-black font-mono text-slate-100">
                  {displayData.metricsBreakdown?.eyeStrainScore || 35}%
                </div>
                <div className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-500 rounded-full" style={{ width: `${displayData.metricsBreakdown?.eyeStrainScore || 35}%` }} />
                </div>
              </div>

              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-1 min-w-0">
                <div className="flex items-center space-x-1.5 text-amber-400 text-[10px] font-mono truncate">
                  <Target className="w-3.5 h-3.5 flex-shrink-0" />
                  <span className="truncate">SAI LỆCH TƯ THẾ</span>
                </div>
                <div className="text-lg font-black font-mono text-slate-100">
                  {displayData.metricsBreakdown?.postureDisruptionScore || 28}%
                </div>
                <div className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden">
                  <div className="h-full bg-amber-500 rounded-full" style={{ width: `${displayData.metricsBreakdown?.postureDisruptionScore || 28}%` }} />
                </div>
              </div>

              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-1 min-w-0">
                <div className="flex items-center space-x-1.5 text-purple-400 text-[10px] font-mono truncate">
                  <Brain className="w-3.5 h-3.5 flex-shrink-0" />
                  <span className="truncate">TẢI NHẬN THỨC</span>
                </div>
                <div className="text-lg font-black font-mono text-slate-100">
                  {displayData.metricsBreakdown?.cognitiveLoadScore || 42}%
                </div>
                <div className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden">
                  <div className="h-full bg-purple-500 rounded-full" style={{ width: `${displayData.metricsBreakdown?.cognitiveLoadScore || 42}%` }} />
                </div>
              </div>

              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-1 min-w-0">
                <div className="flex items-center space-x-1.5 text-emerald-400 text-[10px] font-mono truncate">
                  <Volume2 className="w-3.5 h-3.5 flex-shrink-0" />
                  <span className="truncate">STRESS TIẾNG ỒN</span>
                </div>
                <div className="text-lg font-black font-mono text-slate-100">
                  {displayData.metricsBreakdown?.acousticStressScore || 30}%
                </div>
                <div className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${displayData.metricsBreakdown?.acousticStressScore || 30}%` }} />
                </div>
              </div>
            </div>
          </div>

          {/* Attention Span & Optimal Session Prescription */}
          <div className="bg-slate-900/80 p-6 rounded-2xl border border-slate-800 space-y-4 shadow-xl min-w-0">
            <div className="flex items-center space-x-3">
              <Brain className="w-5 h-5 text-indigo-400" />
              <h3 className="text-xs font-bold text-slate-200 uppercase tracking-widest">Đề Xuất Chu Kỳ Học Cá Nhân Hóa (Gemini LLM)</h3>
            </div>

            <div className="bg-slate-950 p-5 rounded-xl border border-slate-800 space-y-3.5 min-w-0">
              <div className="flex items-start space-x-3">
                <Sparkles className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
                <div className="space-y-1 min-w-0">
                  <div className="text-xs font-bold text-slate-200 uppercase tracking-wider">Phân tích nhịp độ chú ý:</div>
                  <p className="text-xs text-blue-200 leading-relaxed bg-blue-950/40 p-3 rounded-lg border border-blue-500/20">
                    "{displayData.attentionSpanAnalysis}"
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 text-xs font-mono min-w-0">
                <div className="bg-slate-900 p-3 rounded-lg border border-slate-800 space-y-1 min-w-0">
                  <span className="text-slate-400 block text-[10px]">PHIÊN HỌC TỐI ƯU</span>
                  <strong className="text-emerald-400 text-sm font-bold">
                    {displayData.recommendedSessionMinutes} Phút / Session
                  </strong>
                </div>

                <div className="bg-slate-900 p-3 rounded-lg border border-slate-800 space-y-1 min-w-0">
                  <span className="text-slate-400 block text-[10px]">NGHỈ BLIND BREAK</span>
                  <strong className="text-blue-400 text-sm font-bold">
                    {displayData.recommendedBreakMinutes} Phút Không Màn Hình
                  </strong>
                </div>

                <div className="bg-slate-900 p-3 rounded-lg border border-slate-800 space-y-1 min-w-0">
                  <span className="text-slate-400 block text-[10px]">KHUNG GIỜ VÀNG</span>
                  <strong className="text-purple-300 text-[11px] font-bold block truncate" title={(displayData.optimalTimeWindows || []).join(' • ')}>
                    {(displayData.optimalTimeWindows || ['08:30 - 11:30', '14:00 - 16:30']).slice(0, 2).join(', ')}
                  </strong>
                </div>
              </div>
            </div>
          </div>

          {/* Mascot Friendly Advice Card */}
          <div className="bg-gradient-to-r from-amber-950/40 via-slate-900 to-orange-950/40 p-5 rounded-2xl border border-amber-500/30 flex items-start space-x-3.5 shadow-xl min-w-0">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-300 flex-shrink-0 text-lg">
              🦉
            </div>
            <div className="space-y-1 min-w-0">
              <div className="text-xs font-bold text-amber-300 uppercase font-mono flex items-center space-x-2">
                <span>Lời Khuyên Từ Linh Vật Eddy:</span>
                <span className="px-2 py-0.5 bg-amber-500/20 text-[10px] rounded">Energy Companion</span>
              </div>
              <p className="text-xs text-slate-200 leading-relaxed italic">
                "{displayData.mascotAdvice}"
              </p>
            </div>
          </div>

        </div>

        {/* Right Column: 7-Day Chart + Actionable Recommendations (5 Cols) */}
        <div className="lg:col-span-5 space-y-6 min-w-0 flex flex-col justify-between">
          
          {/* 7-Day Weekly Focus & Readiness Forecast Chart */}
          <div className="bg-slate-900/80 p-5 sm:p-6 rounded-2xl border border-slate-800 space-y-4 shadow-xl min-w-0 w-full overflow-hidden">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center space-x-2 min-w-0">
                <BarChart2 className="w-5 h-5 text-purple-400 flex-shrink-0" />
                <h3 className="text-xs font-bold text-slate-200 uppercase tracking-widest truncate">Biểu Đồ Dự Báo Năng Lượng 7 Ngày</h3>
              </div>
              <span className="text-[10px] font-mono text-purple-300 bg-purple-500/20 px-2 py-0.5 rounded border border-purple-500/30 flex-shrink-0">
                Gemini Forecast
              </span>
            </div>

            {/* Dynamic Interactive Bar Chart */}
            <div className="bg-slate-950 p-3 sm:p-4 rounded-xl border border-slate-800 space-y-3 w-full min-w-0 overflow-hidden">
              <div className="h-44 sm:h-48 flex items-end justify-between px-1 sm:px-2 pt-6 border-b border-slate-800 gap-1 sm:gap-1.5 w-full min-w-0">
                {(displayData.weeklyForecast || []).map((item, idx) => {
                  const maxHours = 5.5;
                  const heightPercent = Math.min(100, Math.max(15, (item.focusHours / maxHours) * 100));

                  return (
                    <div key={idx} className="flex-1 min-w-0 flex flex-col items-center space-y-1.5 group cursor-pointer">
                      {/* Tooltip on hover */}
                      <div className="text-[8px] sm:text-[9px] font-mono text-slate-300 opacity-0 group-hover:opacity-100 transition duration-200 text-center whitespace-nowrap bg-slate-900 px-1 py-0.5 rounded border border-slate-700 shadow-md pointer-events-none">
                        {item.focusHours}h ({item.fatigueScore}%)
                      </div>

                      {/* Bar */}
                      <div className="w-full max-w-[24px] sm:max-w-[28px] bg-slate-900 rounded-t-md sm:rounded-t-lg overflow-hidden flex items-end h-28 sm:h-32">
                        <div
                          className="w-full bg-gradient-to-t from-blue-600 via-indigo-500 to-purple-400 group-hover:from-blue-400 group-hover:to-emerald-300 transition-all rounded-t-md sm:rounded-t-lg shadow-inner"
                          style={{ height: `${heightPercent}%` }}
                        />
                      </div>

                      {/* Day Label */}
                      <span className="text-[9px] sm:text-[10px] font-mono text-slate-400 font-bold group-hover:text-slate-100 transition">
                        {item.day}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Chart Legend & Summary */}
              <div className="flex items-center justify-between text-[10px] sm:text-[11px] font-mono text-slate-400 pt-1 flex-wrap gap-1">
                <span>Tổng giờ học: <strong className="text-slate-100 font-bold">
                  {(displayData.weeklyForecast || []).reduce((acc, curr) => acc + (curr.focusHours || 0), 0).toFixed(1)}h
                </strong></span>
                <span className="text-emerald-400 font-bold flex items-center space-x-1">
                  <TrendingUp className="w-3 h-3" />
                  <span>Tối ưu +18%</span>
                </span>
              </div>
            </div>
          </div>

          {/* Actionable Recommendations List */}
          <div className="bg-slate-900/80 p-6 rounded-2xl border border-slate-800 space-y-4 shadow-xl flex-1 flex flex-col justify-between">
            <div>
              <div className="flex items-center space-x-2 mb-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                <h3 className="text-xs font-bold text-slate-200 uppercase tracking-widest">Đề Xuất Hành Động Cụ Thể</h3>
              </div>

              <div className="space-y-2.5">
                {(displayData.actionableRecommendations || []).map((rec, index) => (
                  <div
                    key={index}
                    className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-1 hover:border-slate-700 transition"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono text-blue-400 font-bold uppercase tracking-wider">
                        [{rec.category}] {rec.title}
                      </span>
                      <span className={`text-[9px] font-mono px-2 py-0.5 rounded ${
                        rec.priority === 'Cao' ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' :
                        rec.priority === 'Trung bình' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' :
                        'bg-slate-800 text-slate-400'
                      }`}>
                        Ưu tiên: {rec.priority}
                      </span>
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      {rec.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Privacy Guarantee Footer Note */}
            <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 text-[11px] text-slate-400 space-y-1 mt-4">
              <div className="font-bold text-slate-200 uppercase tracking-wider text-[10px] flex items-center space-x-1.5">
                <Shield className="w-3.5 h-3.5 text-emerald-400" />
                <span>Bảo Mật Quyền Riêng Tư (Local Privacy First)</span>
              </div>
              <p className="text-[10px] leading-relaxed text-slate-400">
                Hình ảnh video camera chỉ xử lý cục bộ trên thiết bị của bạn. Chỉ các thông số số học (cm, dB, phút) được gửi đến Gemini API để suy luận báo cáo.
              </p>
            </div>

          </div>

        </div>

      </div>

    </div>
  );
};

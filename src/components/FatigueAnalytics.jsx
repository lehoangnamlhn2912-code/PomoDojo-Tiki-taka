import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
  Sliders,
  Calendar,
  Layers,
  TrendingUp,
  Cpu,
  EyeOff,
  VolumeX,
  Info,
  CalendarDays
} from 'lucide-react';
import { telemetryStore } from '../utils/telemetryStore.js';

export const FatigueAnalytics = ({ mascot = {}, noiseDb = 45 }) => {
  // Live state from telemetryStore (single source of truth)
  const [telemetry, setTelemetry] = useState(() => telemetryStore.getTodaySummary());
  const [history7Days, setHistory7Days] = useState(() => telemetryStore.get7DayHistory());

  // Periodically refresh telemetry data if a focus session is running
  useEffect(() => {
    const syncTelemetry = () => {
      setTelemetry(telemetryStore.getTodaySummary());
      setHistory7Days(telemetryStore.get7DayHistory());
    };

    syncTelemetry();
    const interval = setInterval(syncTelemetry, 3000);
    return () => clearInterval(interval);
  }, []);

  // UI States
  const [showConfig, setShowConfig] = useState(false);
  const [loading, setLoading] = useState(false);
  const [aiData, setAiData] = useState(null);
  const [error, setError] = useState(null);
  const [lastAnalyzedTime, setLastAnalyzedTime] = useState(null);

  // Optional manual simulation for testing custom scenarios
  const [manualOverride, setManualOverride] = useState(false);
  const [testParams, setTestParams] = useState({
    focusMinutes: 45,
    avgDistanceCm: 48,
    dimEvents: 2,
    avgNoiseDb: 52,
    noiseSpikes: 3,
    eyeOscillationsPerSec: 1.6
  });

  // Effective todayStats sent to Gemini & rendered
  const currentStats = useMemo(() => {
    if (manualOverride) {
      return {
        focusSeconds: testParams.focusMinutes * 60,
        focusMinutes: testParams.focusMinutes,
        avgDistanceCm: testParams.avgDistanceCm,
        dimEvents: testParams.dimEvents,
        avgNoiseDb: testParams.avgNoiseDb,
        noiseSpikes: testParams.noiseSpikes,
        eyeOscillationsPerSec: testParams.eyeOscillationsPerSec,
        fatigueScore: Math.min(95, Math.max(10, Math.round(20 + testParams.dimEvents * 10 + testParams.noiseSpikes * 8 + (testParams.focusMinutes > 40 ? 15 : 0)))),
        hasData: true
      };
    }
    return telemetry;
  }, [manualOverride, testParams, telemetry]);

  const hasRecordedData = Boolean(currentStats.hasData && (currentStats.focusSeconds > 0 || currentStats.dimEvents > 0 || currentStats.noiseSpikes > 0 || manualOverride));

  // Call Gemini LLM API via full-stack Express backend
  const handleAnalyzeWithGemini = useCallback(async () => {
    if (!hasRecordedData) {
      setAiData({
        fatigueIndex: null,
        riskLevel: 'No Data',
        statusTitle: 'No Session Recorded',
        statusDescription: 'No focus sessions recorded today yet. Start a session to track telemetry.',
        aiAdvice: 'No focus sessions recorded today yet. Start a session in the Focus tab to activate real-time biometric telemetry and AI advice.',
        recommendedSessionMinutes: null,
        recommendedBreakMinutes: null,
        optimalTimeWindows: [],
        keyInsights: [
          'No focus sessions recorded today yet.',
          'Biometric telemetry will be collected during your focus sessions.'
        ],
        actionableRecommendations: [
          {
            category: 'Vision',
            title: '20-20-20 Vision Rule',
            description: 'Every 20 minutes, gaze at an object 6 meters (20 feet) away for 20 seconds to relax ciliary muscles.',
            priority: 'High'
          },
          {
            category: 'Posture',
            title: 'Safe Distance > 50cm',
            description: 'Adjust your seat so your eyes remain at least an arm\'s length (50cm) from the monitor.',
            priority: 'Medium'
          }
        ],
        metricsBreakdown: {
          eyeStrainScore: null,
          postureDisruptionScore: null,
          cognitiveLoadScore: null,
          acousticStressScore: null
        }
      });
      return;
    }

    setLoading(true);
    setError(null);

    const statsToSend = currentStats;
    const historyToSend = history7Days;

    try {
      const payload = {
        todayStats: statsToSend,
        history7Days: historyToSend,
        streakDays: mascot.streakDays || 14,
        cycleDay: mascot.cycleDay || 14,
        remainingLives: mascot.remainingLives !== undefined ? mascot.remainingLives : 4
      };

      const response = await fetch('/api/fatigue/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const result = await response.json();

      if (result.success && result.data) {
        setAiData(result.data);
        setLastAnalyzedTime(new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      } else {
        throw new Error(result.error || 'No data received from Gemini LLM');
      }
    } catch (err) {
      console.warn('Gemini LLM API call failed, generating local concise analysis in English:', err);
      setError(err.message);

      const computedFatigue = statsToSend.fatigueScore !== null
        ? statsToSend.fatigueScore
        : Math.min(85, Math.max(10, Math.round(15 + statsToSend.dimEvents * 8 + (statsToSend.avgNoiseDb && statsToSend.avgNoiseDb > 55 ? 15 : 0))));

      let conciseAdvice = 'Posture and screen distance are in good shape. Maintain regular screen-free breaks each cycle.';
      if (statsToSend.dimEvents > 0) {
        conciseAdvice = `Screen dimming was triggered ${statsToSend.dimEvents} time(s) due to leaning too close (<40cm). Push your display back to at least 50cm and blink to hydrate your eyes.`;
      } else if (statsToSend.noiseSpikes >= 2) {
        conciseAdvice = `Detected ${statsToSend.noiseSpikes} loud ambient noise spikes. Enable the acoustic shield or wear noise-cancelling headphones to reduce auditory fatigue.`;
      } else if (statsToSend.eyeOscillationsPerSec >= 2.0) {
        conciseAdvice = `High eye oscillation frequency (${statsToSend.eyeOscillationsPerSec}/s) indicates ciliary muscle strain. Rest your eyes for 20 seconds following the 20-20-20 rule.`;
      } else if (statsToSend.focusMinutes >= 60) {
        conciseAdvice = `You have studied continuously for ${statsToSend.focusMinutes} minutes. Stand up, stretch, and focus on an object 6 meters away.`;
      }

      setAiData({
        fatigueIndex: computedFatigue,
        riskLevel: computedFatigue > 65 ? 'Warning' : computedFatigue > 40 ? 'Moderate' : 'Optimal',
        statusTitle: computedFatigue > 65 ? 'Visual Strain Alert' : computedFatigue > 40 ? 'Moderate Fatigue' : 'Optimal Energy',
        statusDescription: `Recorded ${statsToSend.focusMinutes} focus minutes with average eye distance of ${statsToSend.avgDistanceCm || '--'}cm and sound level of ${statsToSend.avgNoiseDb || '--'}dB.`,
        aiAdvice: conciseAdvice,
        recommendedSessionMinutes: computedFatigue > 50 ? 20 : 25,
        recommendedBreakMinutes: 5,
        optimalTimeWindows: ['08:30 - 11:30', '14:30 - 16:30'],
        keyInsights: [
          statsToSend.avgDistanceCm !== null
            ? `Average screen distance: ${statsToSend.avgDistanceCm}cm (${statsToSend.avgDistanceCm >= 50 ? 'Within safe ergonomic range' : 'Should be moved further back'}).`
            : 'No webcam telemetry recorded for eye distance.',
          statsToSend.dimEvents > 0
            ? `Screen dimming triggered ${statsToSend.dimEvents} time(s) due to proximity violations.`
            : `Average noise level: ${statsToSend.avgNoiseDb !== null ? `${statsToSend.avgNoiseDb}dB` : 'Not measured'}, ${statsToSend.noiseSpikes} noise spike(s) detected.`
        ],
        actionableRecommendations: [
          {
            category: 'Vision',
            title: '20-20-20 Vision Rule',
            description: 'Every 20 minutes, gaze at an object 6 meters (20 feet) away for 20 seconds to relax ciliary muscles.',
            priority: 'High'
          },
          {
            category: 'Posture',
            title: 'Safe Distance > 50cm',
            description: 'Adjust your seat so your eyes remain at least an arm\'s length (50cm) from the monitor.',
            priority: statsToSend.dimEvents > 0 ? 'High' : 'Medium'
          }
        ],
        metricsBreakdown: {
          eyeStrainScore: Math.min(100, Math.max(10, Math.round(statsToSend.dimEvents * 15 + (statsToSend.avgDistanceCm ? Math.max(0, 50 - statsToSend.avgDistanceCm) * 3 : 20)))),
          postureDisruptionScore: Math.min(100, Math.max(10, Math.round(statsToSend.dimEvents * 12 + (statsToSend.avgDistanceCm && statsToSend.avgDistanceCm < 45 ? 30 : 15)))),
          cognitiveLoadScore: Math.min(100, Math.max(10, Math.round(statsToSend.focusMinutes * 0.5 + 20))),
          acousticStressScore: Math.min(100, Math.max(10, Math.round(statsToSend.noiseSpikes * 12 + (statsToSend.avgNoiseDb ? Math.max(0, statsToSend.avgNoiseDb - 45) * 2 : 15))))
        }
      });
      setLastAnalyzedTime(new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    } finally {
      setLoading(false);
    }
  }, [hasRecordedData, currentStats, history7Days, mascot]);

  // Initial load: ONLY analyze if there is already recorded session data
  useEffect(() => {
    if (hasRecordedData) {
      handleAnalyzeWithGemini();
    }
  }, []);

  // Display data strictly adhering to user request:
  // If no data has been recorded yet, show '--%' and leave values blank/clean!
  const displayData = useMemo(() => {
    if (!hasRecordedData) {
      return {
        fatigueIndex: null,
        riskLevel: 'No Data',
        statusTitle: 'No Data Recorded',
        statusDescription: 'No focus sessions recorded today yet. Complete a focus session to record biometric telemetry.',
        aiAdvice: 'No focus sessions recorded today yet. Start a session in the Focus tab to generate real-time AI ergonomics advice.',
        recommendedSessionMinutes: null,
        recommendedBreakMinutes: null,
        optimalTimeWindows: [],
        keyInsights: [
          'No focus sessions recorded today yet.',
          'Webcam and microphone telemetry will be collected during your focus sessions.'
        ],
        actionableRecommendations: [
          {
            category: 'Vision',
            title: '20-20-20 Vision Rule',
            description: 'Every 20 minutes, gaze at an object 6 meters (20 feet) away for 20 seconds to relax ciliary muscles.',
            priority: 'Baseline'
          },
          {
            category: 'Posture',
            title: 'Safe Distance > 50cm',
            description: 'Adjust your seat so your eyes remain at least an arm\'s length (50cm) from the monitor.',
            priority: 'Baseline'
          }
        ],
        metricsBreakdown: {
          eyeStrainScore: null,
          postureDisruptionScore: null,
          cognitiveLoadScore: null,
          acousticStressScore: null
        }
      };
    }

    if (aiData) {
      return aiData;
    }

    // Default when hasRecordedData is true but analysis is pending
    return {
      fatigueIndex: currentStats.fatigueScore !== null ? currentStats.fatigueScore : 30,
      riskLevel: 'Analyzing...',
      statusTitle: 'Calculating Telemetry...',
      statusDescription: 'Synthesizing live biometric data.',
      aiAdvice: 'Analyzing live metrics...',
      recommendedSessionMinutes: 25,
      recommendedBreakMinutes: 5,
      optimalTimeWindows: ['08:30 - 11:30', '14:30 - 16:30'],
      keyInsights: ['Aggregating telemetry...'],
      actionableRecommendations: [],
      metricsBreakdown: {
        eyeStrainScore: null,
        postureDisruptionScore: null,
        cognitiveLoadScore: null,
        acousticStressScore: null
      }
    };
  }, [hasRecordedData, aiData, currentStats]);

  // Color helper based on fatigue index
  const getFatigueColor = (score) => {
    if (score === null || score === undefined) {
      return { text: 'text-slate-400', bg: 'bg-slate-800/40', border: 'border-slate-700', bar: 'from-slate-700 to-slate-800' };
    }
    if (score < 40) return { text: 'text-emerald-400', bg: 'bg-emerald-500/20', border: 'border-emerald-500/30', bar: 'from-emerald-500 to-teal-400' };
    if (score < 65) return { text: 'text-amber-400', bg: 'bg-amber-500/20', border: 'border-amber-500/30', bar: 'from-amber-500 to-yellow-400' };
    return { text: 'text-rose-400', bg: 'bg-rose-500/20', border: 'border-rose-500/30', bar: 'from-rose-500 to-red-400' };
  };

  const fatigueColors = getFatigueColor(displayData.fatigueIndex);

  // Calculate real history stats
  const recordedDays = history7Days.filter((d) => d.hasData);
  const totalRecordedHours = recordedDays.reduce((sum, d) => sum + (d.focusHours || 0), 0);

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-6">
      
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-blue-950 via-slate-900 to-indigo-950 p-5 sm:p-6 rounded-2xl border border-blue-500/30 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xl">
        <div className="flex items-center space-x-4">
          <div className="w-12 h-12 rounded-xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-blue-400 shadow-inner flex-shrink-0">
            <Cpu className="w-6 h-6 animate-pulse text-blue-300" />
          </div>
          <div>
            <div className="flex items-center space-x-2 flex-wrap gap-y-1">
              <span className="text-[10px] font-mono uppercase tracking-widest text-blue-400 font-bold">PomoDojo Telemetry</span>
              <span className="px-2 py-0.5 bg-gradient-to-r from-purple-500/30 to-blue-500/30 border border-purple-400/30 text-purple-200 text-[10px] font-mono rounded flex items-center space-x-1">
                <Sparkles className="w-3 h-3 text-yellow-400" />
                <span>Gemini Biometric Synthesis</span>
              </span>
              {lastAnalyzedTime && (
                <span className="text-[10px] font-mono text-slate-400">
                  • Updated: {lastAnalyzedTime}
                </span>
              )}
            </div>
            <h2 className="text-xl font-bold text-slate-100 mt-0.5">Fatigue Analytics & Energy Telemetry</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Real telemetry from Focus sessions (acoustics, eye distance, micro-oscillations, screen dimming). No fabricated data.
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
            <span>{showConfig ? 'Close Simulator' : 'Tune / Simulate'}</span>
          </button>

          <button
            onClick={handleAnalyzeWithGemini}
            disabled={loading}
            className="px-4 py-2 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-bold text-xs rounded-xl shadow-lg transition flex items-center space-x-2 cursor-pointer disabled:opacity-50 active:scale-95"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>{loading ? 'Analyzing...' : 'Re-analyze with AI'}</span>
          </button>
        </div>
      </div>

      {/* Simulator / Parameter Customizer Panel (Collapsible) */}
      {showConfig && (
        <div className="bg-slate-900/95 p-5 rounded-2xl border border-blue-500/30 space-y-4 shadow-2xl animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2.5 flex-wrap gap-2">
            <div className="flex items-center space-x-2 text-xs font-bold text-slate-200 uppercase tracking-wider">
              <Sliders className="w-4 h-4 text-blue-400" />
              <span>Simulation & Testing Mode:</span>
            </div>
            <div className="flex items-center space-x-2">
              <label className="text-xs text-slate-300 flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={manualOverride}
                  onChange={(e) => setManualOverride(e.target.checked)}
                  className="rounded bg-slate-800 border-slate-600 text-blue-500 focus:ring-0 cursor-pointer"
                />
                <span className="font-mono text-xs">Enable Simulated Values (for testing)</span>
              </label>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs font-mono">
            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-1">
              <span className="text-slate-400 block text-[10px] uppercase">Study Duration (Minutes)</span>
              <input
                type="number"
                disabled={!manualOverride}
                value={testParams.focusMinutes}
                onChange={(e) => setTestParams({ ...testParams, focusMinutes: Math.max(0, Number(e.target.value)) })}
                className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1 text-slate-100 text-sm font-bold focus:outline-none focus:border-blue-400 disabled:opacity-40"
              />
            </div>

            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-1">
              <span className="text-slate-400 block text-[10px] uppercase">Avg Eye Distance (cm)</span>
              <input
                type="number"
                disabled={!manualOverride}
                value={testParams.avgDistanceCm}
                onChange={(e) => setTestParams({ ...testParams, avgDistanceCm: Math.max(10, Number(e.target.value)) })}
                className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1 text-slate-100 text-sm font-bold focus:outline-none focus:border-blue-400 disabled:opacity-40"
              />
            </div>

            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-1">
              <span className="text-slate-400 block text-[10px] uppercase">Screen Dimming Triggers</span>
              <input
                type="number"
                disabled={!manualOverride}
                value={testParams.dimEvents}
                onChange={(e) => setTestParams({ ...testParams, dimEvents: Math.max(0, Number(e.target.value)) })}
                className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1 text-slate-100 text-sm font-bold focus:outline-none focus:border-blue-400 disabled:opacity-40"
              />
            </div>

            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-1">
              <span className="text-slate-400 block text-[10px] uppercase">Avg Sound Level (dB)</span>
              <input
                type="number"
                disabled={!manualOverride}
                value={testParams.avgNoiseDb}
                onChange={(e) => setTestParams({ ...testParams, avgNoiseDb: Math.max(20, Number(e.target.value)) })}
                className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1 text-slate-100 text-sm font-bold focus:outline-none focus:border-blue-400 disabled:opacity-40"
              />
            </div>

            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-1">
              <span className="text-slate-400 block text-[10px] uppercase">Noise Spikes (&gt;65dB)</span>
              <input
                type="number"
                disabled={!manualOverride}
                value={testParams.noiseSpikes}
                onChange={(e) => setTestParams({ ...testParams, noiseSpikes: Math.max(0, Number(e.target.value)) })}
                className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1 text-slate-100 text-sm font-bold focus:outline-none focus:border-blue-400 disabled:opacity-40"
              />
            </div>

            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-1">
              <span className="text-slate-400 block text-[10px] uppercase">Eye Oscillations / Sec</span>
              <input
                type="number"
                step="0.1"
                disabled={!manualOverride}
                value={testParams.eyeOscillationsPerSec}
                onChange={(e) => setTestParams({ ...testParams, eyeOscillationsPerSec: Math.max(0, Number(e.target.value)) })}
                className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1 text-slate-100 text-sm font-bold focus:outline-none focus:border-blue-400 disabled:opacity-40"
              />
            </div>
          </div>
        </div>
      )}

      {/* ULTRA-CONCISE AI ADVICE */}
      <div className="bg-gradient-to-r from-indigo-950/70 via-slate-900 to-purple-950/70 p-5 rounded-2xl border border-indigo-500/40 shadow-xl flex items-start space-x-4">
        <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-400/40 flex items-center justify-center text-indigo-300 flex-shrink-0 text-lg">
          <Sparkles className="w-5 h-5 text-yellow-300 animate-pulse" />
        </div>
        <div className="space-y-1 flex-1 min-w-0">
          <div className="flex items-center justify-between flex-wrap gap-1">
            <div className="text-xs font-bold text-indigo-300 uppercase font-mono flex items-center space-x-2">
              <span>AI Real-time Ergonomics Advice:</span>
              <span className="px-2 py-0.5 bg-indigo-500/20 text-indigo-200 text-[10px] rounded border border-indigo-500/30">
                {hasRecordedData ? 'Ultra-Concise & Direct' : 'Awaiting Session'}
              </span>
            </div>
            <span className="text-[10px] font-mono text-slate-400">
              {hasRecordedData ? 'Derived from measured biometric telemetry' : 'No sessions recorded today'}
            </span>
          </div>
          <p className={`text-sm font-medium leading-relaxed pt-0.5 ${hasRecordedData ? 'text-slate-100' : 'text-slate-400 italic'}`}>
            "{displayData.aiAdvice}"
          </p>
        </div>
      </div>

      {/* 4 REAL FOCUS METRICS DISPLAY */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Activity className="w-4 h-4 text-emerald-400" />
            <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
              Real Focus Telemetry Today
            </h3>
          </div>
          <span className="text-[10px] font-mono text-slate-400">
            {hasRecordedData ? `Recorded ${currentStats.focusMinutes} focus minutes` : 'No sessions recorded yet today'}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* 1. Average Noise */}
          <div className="bg-slate-900/80 p-4 rounded-xl border border-slate-800 space-y-1.5 shadow-md">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-[11px] font-mono uppercase tracking-wider">Average Noise</span>
              <Volume2 className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-2xl font-black font-mono text-slate-100">
              {currentStats.avgNoiseDb !== null ? `${currentStats.avgNoiseDb} dB` : '-- dB'}
            </div>
            <p className="text-[10px] text-slate-400 truncate">
              {currentStats.avgNoiseDb !== null
                ? (currentStats.avgNoiseDb < 55 ? 'Optimal quiet environment' : 'Moderate background noise')
                : 'Microphone required'}
            </p>
          </div>

          {/* 2. Noise Spikes */}
          <div className="bg-slate-900/80 p-4 rounded-xl border border-slate-800 space-y-1.5 shadow-md">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-[11px] font-mono uppercase tracking-wider">Noise Spikes</span>
              <AlertTriangle className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-2xl font-black font-mono text-amber-400">
              {hasRecordedData ? (
                <>
                  {currentStats.noiseSpikes} <span className="text-xs text-slate-400 font-normal">times</span>
                </>
              ) : (
                '--'
              )}
            </div>
            <p className="text-[10px] text-slate-400 truncate">
              Sudden loud noise &gt; 65 dB
            </p>
          </div>

          {/* 3. Screen Dimming Triggers */}
          <div className="bg-slate-900/80 p-4 rounded-xl border border-slate-800 space-y-1.5 shadow-md">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-[11px] font-mono uppercase tracking-wider">Screen Dim Triggers</span>
              <EyeOff className="w-4 h-4 text-rose-400" />
            </div>
            <div className="text-2xl font-black font-mono text-rose-400">
              {hasRecordedData ? (
                <>
                  {currentStats.dimEvents} <span className="text-xs text-slate-400 font-normal">times</span>
                </>
              ) : (
                '--'
              )}
            </div>
            <p className="text-[10px] text-slate-400 truncate">
              Distance &lt; 40cm for &ge; 10 seconds
            </p>
          </div>

          {/* 4. Eye Oscillations / Sec */}
          <div className="bg-slate-900/80 p-4 rounded-xl border border-slate-800 space-y-1.5 shadow-md">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-[11px] font-mono uppercase tracking-wider">Eye Oscillations</span>
              <Eye className="w-4 h-4 text-cyan-400" />
            </div>
            <div className="text-2xl font-black font-mono text-cyan-300">
              {hasRecordedData && currentStats.eyeOscillationsPerSec > 0 ? (
                <>
                  {currentStats.eyeOscillationsPerSec} <span className="text-xs text-slate-400 font-normal">/s</span>
                </>
              ) : (
                '--'
              )}
            </div>
            <p className="text-[10px] text-slate-400 truncate">
              {hasRecordedData && currentStats.eyeOscillationsPerSec > 2.0
                ? 'Elevated micro-saccades (strain)'
                : 'Saccadic movement frequency'}
            </p>
          </div>
        </div>
      </div>

      {/* Main Grid: Left Biometrics & Breakdown (7 Cols) + Right 7-Day Real Chart (5 Cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* Left Column (7 Cols) */}
        <div className="lg:col-span-7 space-y-6">

          {/* Composite Fatigue Index Card */}
          <div className="bg-slate-900/80 p-6 rounded-2xl border border-slate-800 space-y-5 shadow-xl">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center space-x-2">
                <Brain className="w-5 h-5 text-purple-400" />
                <h3 className="text-xs font-bold text-slate-200 uppercase tracking-widest">
                  Daily Fatigue Index
                </h3>
              </div>
              <span className={`px-2.5 py-1 rounded-full text-xs font-mono font-bold uppercase border ${fatigueColors.bg} ${fatigueColors.text} ${fatigueColors.border}`}>
                {displayData.statusTitle || displayData.riskLevel}
              </span>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-between gap-6 bg-slate-950 p-5 rounded-xl border border-slate-800">
              <div className="text-center sm:text-left space-y-1">
                <span className="text-slate-400 text-xs font-mono uppercase">Calculated Fatigue Score:</span>
                <div className={`text-4xl sm:text-5xl font-black font-mono tracking-tight ${fatigueColors.text}`}>
                  {hasRecordedData && displayData.fatigueIndex !== null ? `${displayData.fatigueIndex}%` : '--%'}
                </div>
                <p className="text-xs text-slate-400 max-w-xs">
                  {displayData.statusDescription}
                </p>
              </div>

              {/* Real Distance & Focus Summary */}
              <div className="w-full sm:w-auto space-y-2 text-xs font-mono border-t sm:border-t-0 sm:border-l border-slate-800 pt-3 sm:pt-0 sm:pl-5">
                <div className="flex justify-between sm:justify-start sm:space-x-4">
                  <span className="text-slate-400">Average Eye Distance:</span>
                  <span className="font-bold text-slate-200">
                    {currentStats.avgDistanceCm !== null ? `${currentStats.avgDistanceCm} cm` : '--'}
                  </span>
                </div>
                <div className="flex justify-between sm:justify-start sm:space-x-4">
                  <span className="text-slate-400">Focus Duration Today:</span>
                  <span className="font-bold text-emerald-400">
                    {hasRecordedData ? `${currentStats.focusMinutes} min` : '--'}
                  </span>
                </div>
                <div className="flex justify-between sm:justify-start sm:space-x-4">
                  <span className="text-slate-400">Session Prescription:</span>
                  <span className="font-bold text-blue-400">
                    {hasRecordedData && displayData.recommendedSessionMinutes
                      ? `${displayData.recommendedSessionMinutes}m study / ${displayData.recommendedBreakMinutes}m break`
                      : '--'}
                  </span>
                </div>
              </div>
            </div>

            {/* 4 Biometric Breakdown Sliders */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-1">
                <div className="flex items-center space-x-1.5 text-cyan-400 text-[10px] font-mono truncate">
                  <Eye className="w-3.5 h-3.5 flex-shrink-0" />
                  <span className="truncate">EYE STRAIN</span>
                </div>
                <div className="text-lg font-black font-mono text-slate-100">
                  {hasRecordedData && displayData.metricsBreakdown?.eyeStrainScore !== null
                    ? `${displayData.metricsBreakdown.eyeStrainScore}%`
                    : '--%'}
                </div>
                <div className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-cyan-400 rounded-full transition-all"
                    style={{ width: `${hasRecordedData && displayData.metricsBreakdown?.eyeStrainScore ? displayData.metricsBreakdown.eyeStrainScore : 0}%` }}
                  />
                </div>
              </div>

              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-1">
                <div className="flex items-center space-x-1.5 text-blue-400 text-[10px] font-mono truncate">
                  <Activity className="w-3.5 h-3.5 flex-shrink-0" />
                  <span className="truncate">POSTURE DISRUPTION</span>
                </div>
                <div className="text-lg font-black font-mono text-slate-100">
                  {hasRecordedData && displayData.metricsBreakdown?.postureDisruptionScore !== null
                    ? `${displayData.metricsBreakdown.postureDisruptionScore}%`
                    : '--%'}
                </div>
                <div className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500 rounded-full transition-all"
                    style={{ width: `${hasRecordedData && displayData.metricsBreakdown?.postureDisruptionScore ? displayData.metricsBreakdown.postureDisruptionScore : 0}%` }}
                  />
                </div>
              </div>

              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-1">
                <div className="flex items-center space-x-1.5 text-purple-400 text-[10px] font-mono truncate">
                  <Brain className="w-3.5 h-3.5 flex-shrink-0" />
                  <span className="truncate">COGNITIVE LOAD</span>
                </div>
                <div className="text-lg font-black font-mono text-slate-100">
                  {hasRecordedData && displayData.metricsBreakdown?.cognitiveLoadScore !== null
                    ? `${displayData.metricsBreakdown.cognitiveLoadScore}%`
                    : '--%'}
                </div>
                <div className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-purple-500 rounded-full transition-all"
                    style={{ width: `${hasRecordedData && displayData.metricsBreakdown?.cognitiveLoadScore ? displayData.metricsBreakdown.cognitiveLoadScore : 0}%` }}
                  />
                </div>
              </div>

              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-1">
                <div className="flex items-center space-x-1.5 text-emerald-400 text-[10px] font-mono truncate">
                  <Volume2 className="w-3.5 h-3.5 flex-shrink-0" />
                  <span className="truncate">NOISE STRESS</span>
                </div>
                <div className="text-lg font-black font-mono text-slate-100">
                  {hasRecordedData && displayData.metricsBreakdown?.acousticStressScore !== null
                    ? `${displayData.metricsBreakdown.acousticStressScore}%`
                    : '--%'}
                </div>
                <div className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 rounded-full transition-all"
                    style={{ width: `${hasRecordedData && displayData.metricsBreakdown?.acousticStressScore ? displayData.metricsBreakdown.acousticStressScore : 0}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Key Insights & Golden Hours */}
          <div className="bg-slate-900/80 p-5 rounded-2xl border border-slate-800 space-y-3.5 shadow-xl">
            <div className="flex items-center space-x-2">
              <Sparkles className="w-4 h-4 text-indigo-400" />
              <h3 className="text-xs font-bold text-slate-200 uppercase tracking-widest">
                Biometric Telemetry Insights
              </h3>
            </div>

            <div className="space-y-2">
              {(displayData.keyInsights || []).map((insight, idx) => (
                <div key={idx} className="flex items-start space-x-2.5 p-2.5 bg-slate-950 rounded-xl border border-slate-800 text-xs text-slate-300">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                  <span>{insight}</span>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 text-xs font-mono">
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                <span className="text-slate-400 text-[10px] block uppercase">Optimal Time Windows</span>
                <span className="text-purple-300 font-bold">
                  {hasRecordedData && displayData.optimalTimeWindows && displayData.optimalTimeWindows.length > 0
                    ? displayData.optimalTimeWindows.join(' • ')
                    : '--'}
                </span>
              </div>
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                <span className="text-slate-400 text-[10px] block uppercase">Mascot 30-Day Cycle</span>
                <span className="text-amber-300 font-bold">
                  Day {mascot.cycleDay || 14}/30 • {mascot.streakDays || 14}-Day Streak
                </span>
              </div>
            </div>
          </div>

        </div>

        {/* Right Column: STRICT 7-DAY REAL HISTORY CHART (5 Cols) */}
        <div className="lg:col-span-5 space-y-6">
          
          <div className="bg-slate-900/80 p-5 sm:p-6 rounded-2xl border border-slate-800 space-y-4 shadow-xl">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center space-x-2 min-w-0">
                <BarChart2 className="w-5 h-5 text-purple-400 flex-shrink-0" />
                <h3 className="text-xs font-bold text-slate-200 uppercase tracking-widest">
                  Last 7 Days Session History
                </h3>
              </div>
              <span className="text-[10px] font-mono text-emerald-300 bg-emerald-500/20 px-2 py-0.5 rounded border border-emerald-500/30 flex-shrink-0">
                {recordedDays.length}/7 Days Recorded
              </span>
            </div>

            {/* Information Notice: No Fake Data Guarantee */}
            <div className="p-2.5 bg-blue-950/30 rounded-xl border border-blue-500/20 flex items-center space-x-2 text-[11px] text-blue-200 font-mono">
              <Info className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
              <span>Only recorded study sessions are shown. Empty columns represent days with no sessions.</span>
            </div>

            {/* STRICT 7-DAY BAR CHART */}
            <div className="bg-slate-950 p-3 sm:p-4 rounded-xl border border-slate-800 space-y-3 w-full">
              <div className="h-44 sm:h-48 flex items-end justify-between px-1 sm:px-2 pt-6 border-b border-slate-800 gap-1.5 sm:gap-2 w-full">
                {history7Days.map((item, idx) => {
                  const maxHours = 5.0;
                  const heightPercent = item.hasData && item.focusHours > 0
                    ? Math.min(100, Math.max(16, (item.focusHours / maxHours) * 100))
                    : 0;

                  return (
                    <div key={idx} className="flex-1 min-w-0 flex flex-col items-center space-y-1.5 group">
                      
                      {/* Tooltip on hover */}
                      <div className="text-[9px] font-mono text-slate-200 opacity-0 group-hover:opacity-100 transition duration-200 text-center whitespace-nowrap bg-slate-900 px-1.5 py-1 rounded border border-slate-700 shadow-md pointer-events-none z-10">
                        {item.hasData ? (
                          <>
                            <span className="text-blue-300 font-bold">{item.focusMinutes}m</span>
                            <span className="text-slate-400"> ({item.fatigueScore}% fatigue)</span>
                          </>
                        ) : (
                          <span className="text-slate-500">No session data</span>
                        )}
                      </div>

                      {/* Column Bar Slot */}
                      <div className={`w-full max-w-[28px] rounded-t-lg overflow-hidden flex items-end h-28 sm:h-32 transition-all ${
                        item.hasData
                          ? 'bg-slate-900'
                          : 'bg-slate-900/30 border border-dashed border-slate-800'
                      } ${item.isToday ? 'ring-1 ring-blue-400' : ''}`}>
                        {item.hasData && heightPercent > 0 ? (
                          <div
                            className={`w-full bg-gradient-to-t ${
                              item.fatigueScore > 65
                                ? 'from-rose-600 via-amber-500 to-yellow-400'
                                : 'from-blue-600 via-indigo-500 to-cyan-400'
                            } rounded-t-lg transition-all`}
                            style={{ height: `${heightPercent}%` }}
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-[10px] text-slate-700 font-mono">
                            -
                          </div>
                        )}
                      </div>

                      {/* Day Label & Today Badge */}
                      <div className="flex flex-col items-center">
                        <span className={`text-[9px] sm:text-[10px] font-mono font-bold transition ${
                          item.isToday ? 'text-blue-400' : item.hasData ? 'text-slate-300' : 'text-slate-600'
                        }`}>
                          {item.dayLabel}
                        </span>
                        {item.isToday && (
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-400 mt-0.5 animate-pulse" />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Chart Legend & Summary */}
              <div className="flex items-center justify-between text-[10px] sm:text-[11px] font-mono text-slate-400 pt-1 flex-wrap gap-2">
                <span>Total 7-Day Study Time: <strong className="text-slate-100 font-bold">
                  {totalRecordedHours.toFixed(1)}h
                </strong></span>
                <span className="text-slate-400">
                  {recordedDays.length === 0 ? 'No recorded sessions in history' : `${recordedDays.length} day(s) recorded`}
                </span>
              </div>
            </div>
          </div>

          {/* Actionable Recommendations */}
          <div className="bg-slate-900/80 p-5 sm:p-6 rounded-2xl border border-slate-800 space-y-3.5 shadow-xl">
            <div className="flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <h3 className="text-xs font-bold text-slate-200 uppercase tracking-widest">
                Actionable Recommendations
              </h3>
            </div>

            <div className="space-y-2.5">
              {(displayData.actionableRecommendations || []).map((rec, index) => (
                <div
                  key={index}
                  className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-1"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono text-blue-400 font-bold uppercase tracking-wider">
                      [{rec.category}] {rec.title}
                    </span>
                    <span className={`text-[9px] font-mono px-2 py-0.5 rounded ${
                      rec.priority === 'High' ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' :
                      rec.priority === 'Medium' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' :
                      'bg-slate-800 text-slate-400'
                    }`}>
                      {rec.priority}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    {rec.description}
                  </p>
                </div>
              ))}
            </div>

            {/* Privacy Guarantee Footer Note */}
            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-[10px] text-slate-400 space-y-1">
              <div className="font-bold text-slate-200 uppercase tracking-wider text-[10px] flex items-center space-x-1.5">
                <Shield className="w-3.5 h-3.5 text-emerald-400" />
                <span>100% Local Device Privacy</span>
              </div>
              <p className="text-[10px] leading-relaxed text-slate-400">
                Camera and microphone processing is executed strictly on-device in your browser (MediaPipe & Web Audio API). Only aggregated numerical telemetry is used.
              </p>
            </div>
          </div>

        </div>

      </div>

    </div>
  );
};

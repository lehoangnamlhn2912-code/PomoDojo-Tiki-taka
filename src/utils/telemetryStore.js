/**
 * Telemetry Store for Real-time Focus, Biometrics, and 7-Day Fatigue History
 * Strictly maintains REAL measured parameters with NO fabricated data.
 */

const STORAGE_KEYS = {
  HISTORY: 'edumotion_fatigue_history_v2',
  TODAY: 'edumotion_today_telemetry_v2'
};

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function getLocalDateString(dateObj = new Date()) {
  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const day = String(dateObj.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getDayName(dateObj = new Date()) {
  return DAY_NAMES[dateObj.getDay()];
}

class TelemetryStore {
  constructor() {
    this.todayState = this.loadTodayState();
    this.historyState = this.loadHistory();
    this.lastSavedAt = Date.now();
  }

  loadTodayState() {
    const todayStr = getLocalDateString();
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.TODAY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.date === todayStr) {
          return parsed;
        }
      }
    } catch (e) {
      console.warn('Error reading today telemetry:', e);
    }

    return {
      date: todayStr,
      focusSeconds: 0,
      sumDistance: 0,
      countDistance: 0,
      sumNoise: 0,
      countNoise: 0,
      noiseSpikes: 0,
      dimEvents: 0,
      sumOscillations: 0,
      countOscillations: 0,
      hasData: false
    };
  }

  loadHistory() {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.HISTORY);
      if (raw) {
        return JSON.parse(raw);
      }
    } catch (e) {
      console.warn('Error reading fatigue history:', e);
    }
    return {};
  }

  saveState() {
    try {
      const todayStr = getLocalDateString();
      if (this.todayState.date !== todayStr) {
        // Rolled over to new day
        this.todayState = this.loadTodayState();
      }

      localStorage.setItem(STORAGE_KEYS.TODAY, JSON.stringify(this.todayState));

      // Only write to history if user actually had study time or active sensor measurements
      if (this.todayState.focusSeconds > 0 || this.todayState.countDistance > 5 || this.todayState.countNoise > 5) {
        const summary = this.getTodaySummary();
        this.historyState[todayStr] = summary;

        // Prune older than 14 days
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - 14);
        const cutoffStr = getLocalDateString(cutoff);

        Object.keys(this.historyState).forEach((key) => {
          if (key < cutoffStr) {
            delete this.historyState[key];
          }
        });

        localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(this.historyState));
      }

      this.notifyListeners();
    } catch (e) {
      console.warn('Error saving telemetry:', e);
    }
  }

  notifyListeners() {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('eyecare_telemetry_updated'));
    }
  }

  // Increment focus study time
  recordFocusSecond() {
    this.checkDateRollover();
    this.todayState.focusSeconds += 1;
    this.todayState.hasData = true;
    this.throttleSave();
  }

  // Record eye distance measurement (cm)
  recordDistance(distanceCm) {
    if (typeof distanceCm !== 'number' || isNaN(distanceCm) || distanceCm <= 10 || distanceCm >= 150) return;
    this.checkDateRollover();
    this.todayState.sumDistance += distanceCm;
    this.todayState.countDistance += 1;
    this.todayState.hasData = true;
    this.throttleSave();
  }

  // Record ambient noise SPL measurement (dB)
  recordNoise(db) {
    if (typeof db !== 'number' || isNaN(db) || db <= 0) return;
    this.checkDateRollover();
    this.todayState.sumNoise += db;
    this.todayState.countNoise += 1;
    this.todayState.hasData = true;
    this.throttleSave();
  }

  // Record noise threshold spike (exceeding 65dB or sudden acoustic surge)
  recordNoiseSpike() {
    this.checkDateRollover();
    this.todayState.noiseSpikes += 1;
    this.todayState.hasData = true;
    this.saveState();
  }

  // Record screen dim event triggered by eye too close (< 40cm for >= 10s)
  recordDimEvent() {
    this.checkDateRollover();
    this.todayState.dimEvents += 1;
    this.todayState.hasData = true;
    this.saveState();
  }

  // Record eye oscillation / saccades per second
  recordEyeOscillation(ratePerSec) {
    if (typeof ratePerSec !== 'number' || isNaN(ratePerSec) || ratePerSec < 0) return;
    this.checkDateRollover();
    this.todayState.sumOscillations += ratePerSec;
    this.todayState.countOscillations += 1;
    this.todayState.hasData = true;
    this.throttleSave();
  }

  throttleSave() {
    const now = Date.now();
    if (now - this.lastSavedAt >= 2000) {
      this.lastSavedAt = now;
      this.saveState();
    }
  }

  checkDateRollover() {
    const todayStr = getLocalDateString();
    if (this.todayState.date !== todayStr) {
      this.todayState = this.loadTodayState();
    }
  }

  computeFatigueScore(state = this.todayState) {
    const countDist = state.countDistance || 0;
    const countNoise = state.countNoise || 0;
    const countOsc = state.countOscillations || 0;
    const focusSecs = state.focusSeconds || 0;

    // If no meaningful data recorded today, return baseline minimal fatigue or 0
    if (focusSecs === 0 && countDist === 0 && countNoise === 0) {
      return 0;
    }

    const avgDist = countDist > 0 ? state.sumDistance / countDist : 55;
    const avgNoise = countNoise > 0 ? state.sumNoise / countNoise : 40;
    const avgOsc = countOsc > 0 ? state.sumOscillations / countOsc : 1.0;
    const focusMins = focusSecs / 60;

    // Penalty components:
    // 1. Distance penalty: standard safe distance is >= 50cm
    const distPenalty = Math.max(0, (50 - avgDist) * 1.6);

    // 2. Screen dimming penalty: each time screen had to be dimmed because eyes were too close
    const dimPenalty = (state.dimEvents || 0) * 8.0;

    // 3. Acoustic noise penalty: noise > 50dB adds stress, spikes add sharp fatigue
    const noisePenalty = Math.max(0, (avgNoise - 48) * 0.9) + (state.noiseSpikes || 0) * 3.5;

    // 4. Eye oscillation / jitter: rapid microsaccades/restlessness (>1.3 osc/sec) indicate ciliary fatigue
    const jitterPenalty = Math.max(0, (avgOsc - 1.2) * 9.0);

    // 5. Duration fatigue: progressive fatigue accumulation
    const durationPenalty = Math.min(25, focusMins * 0.28);

    const rawScore = 12 + distPenalty + dimPenalty + noisePenalty + jitterPenalty + durationPenalty;
    return Math.min(100, Math.max(8, Math.round(rawScore)));
  }

  getTodaySummary() {
    const s = this.todayState;
    const focusMinutes = Math.round((s.focusSeconds || 0) / 60);
    const avgDistanceCm = s.countDistance > 0 ? Math.round(s.sumDistance / s.countDistance) : null;
    const avgNoiseDb = s.countNoise > 0 ? Math.round(s.sumNoise / s.countNoise) : null;
    const eyeOscillationsPerSec = s.countOscillations > 0 ? Number((s.sumOscillations / s.countOscillations).toFixed(1)) : 0;
    const fatigueScore = this.computeFatigueScore(s);

    const hasData = s.focusSeconds > 0 || s.countDistance > 0 || s.countNoise > 0;

    return {
      date: s.date,
      dayLabel: getDayName(new Date()),
      focusMinutes,
      focusHours: Number((focusMinutes / 60).toFixed(1)),
      avgDistanceCm,
      avgNoiseDb,
      noiseSpikes: s.noiseSpikes || 0,
      dimEvents: s.dimEvents || 0,
      eyeOscillationsPerSec,
      fatigueScore: hasData ? fatigueScore : null,
      hasData,
      lastUpdated: new Date().toISOString()
    };
  }

  /**
   * Get past 7 consecutive days (up to and including today).
   * STRICTLY RESPECTS TRUTH: If a day has no recorded sessions, hasData is false,
   * focusHours is 0, fatigueScore is null. NO FABRICATED VALUES!
   */
  get7DayHistory() {
    const results = [];
    const now = new Date();

    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dateStr = getLocalDateString(d);
      const dayLabel = getDayName(d);

      if (i === 0) {
        // Today
        const todaySummary = this.getTodaySummary();
        results.push({
          date: dateStr,
          dayLabel,
          isToday: true,
          focusHours: todaySummary.focusHours,
          focusMinutes: todaySummary.focusMinutes,
          fatigueScore: todaySummary.fatigueScore,
          avgDistanceCm: todaySummary.avgDistanceCm,
          avgNoiseDb: todaySummary.avgNoiseDb,
          noiseSpikes: todaySummary.noiseSpikes,
          dimEvents: todaySummary.dimEvents,
          eyeOscillationsPerSec: todaySummary.eyeOscillationsPerSec,
          hasData: todaySummary.hasData
        });
      } else {
        // Past days: lookup in history
        const record = this.historyState[dateStr];
        if (record && record.hasData) {
          results.push({
            date: dateStr,
            dayLabel,
            isToday: false,
            focusHours: record.focusHours || Number(((record.focusMinutes || 0) / 60).toFixed(1)),
            focusMinutes: record.focusMinutes || 0,
            fatigueScore: record.fatigueScore,
            avgDistanceCm: record.avgDistanceCm,
            avgNoiseDb: record.avgNoiseDb,
            noiseSpikes: record.noiseSpikes || 0,
            dimEvents: record.dimEvents || 0,
            eyeOscillationsPerSec: record.eyeOscillationsPerSec || 0,
            hasData: true
          });
        } else {
          // NO DATA FOR THIS DAY - DO NOT FABRICATE NUMBERS!
          results.push({
            date: dateStr,
            dayLabel,
            isToday: false,
            focusHours: 0,
            focusMinutes: 0,
            fatigueScore: null,
            avgDistanceCm: null,
            avgNoiseDb: null,
            noiseSpikes: 0,
            dimEvents: 0,
            eyeOscillationsPerSec: 0,
            hasData: false
          });
        }
      }
    }

    return results;
  }
}

export const telemetryStore = new TelemetryStore();

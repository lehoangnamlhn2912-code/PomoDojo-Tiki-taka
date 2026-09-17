export const INITIAL_QUIZ_BANK = [
  {
    id: 'q1',
    question: "The '20-20-20' rule suggests looking how far away after 20 minutes of screen time?",
    topicName: "Vision Health",
    optionA: { text: "About 20 feet (6 meters) for 20 seconds", action: "Raise both arms sideways (Lateral Raise)", requiredPose: "lateral_raise", keycode: "A" },
    optionB: { text: "About 20 meters for 2 minutes", action: "Lower into a deep squat (Squat)", requiredPose: "squat", keycode: "B" },
    correctOption: 'A',
    explanation: "The 20-20-20 rule: Every 20 minutes of screen work, look at an object 20 feet (6 meters) away for at least 20 seconds to relax ciliary muscles.",
    funFact: "Blinking regularly while looking into the distance replenishes your eye tear film, preventing dryness."
  }
];

export const INITIAL_MASCOT = {
  name: 'Eddy',
  energy: 92,
  streakDays: 14,
  remainingLives: 4, // 4 streak protection lives every 30-day cycle
  cycleDay: 14, // Day 14 of current 30-day cycle (1 -> 30)
  totalDaysTracked: 14,
  cycleStartDate: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
  lastResetDate: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
  lastActiveDate: new Date().toISOString().split('T')[0],
  statusMessage: "Feeling high energy! 30-Day Cycle: Day 14/30.",
  mood: 'focused'
};

export const INITIAL_FATIGUE_DATA = {
  fatigueScore: 42, // 42% -> Moderate
  recommendedSessionLength: 22, // DeXuat 22 min study
  breakLength: 5,
  optimalStudyTimeWindow: "08:30 - 11:30 & 14:00 - 16:30",
  eyeStrainRisk: 'Low',
  overloadWarning: false
};

const STORAGE_KEYS = {
  MASCOT: 'edumotion_mascot_state',
  STATS: 'edumotion_stats_state'
};

/**
 * Get YYYY-MM-DD date string formatted according to local device timezone
 * @param {Date} dateObj 
 * @returns {string} e.g. '2026-08-15'
 */
export function getLocalDateString(dateObj = new Date()) {
  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const day = String(dateObj.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Synchronize Mascot data with real-time local device clock
 * - Automatically detect crossing midnight into a new day.
 * - Deduct streak shield lives if inactive days detected.
 * - Automatically reset to 4 lives after each 30-day cycle.
 * @param {Object} mascotState 
 * @returns {Object} Synchronized mascotState
 */
export function syncMascotWithDeviceRealTime(mascotState) {
  if (!mascotState) return INITIAL_MASCOT;

  const state = { ...mascotState };
  const now = new Date();
  const todayStr = getLocalDateString(now);

  // Initialize timestamps if missing
  if (!state.cycleStartDate) {
    state.cycleStartDate = now.toISOString();
  }
  if (!state.lastActiveDate) {
    state.lastActiveDate = todayStr;
  }
  if (typeof state.cycleDay !== 'number') {
    state.cycleDay = 1;
  }

  // 1. CHECK 30-DAY CYCLE IN REAL TIME
  const cycleStart = new Date(state.cycleStartDate);
  const elapsedDaysReal = Math.floor((now.getTime() - cycleStart.getTime()) / (1000 * 60 * 60 * 24));

  if (elapsedDaysReal >= 30 || state.cycleDay >= 30) {
    const cycleExcess = elapsedDaysReal >= 30 ? (elapsedDaysReal % 30) : 0;
    
    // AUTOMATICALLY REPLENISH 4 LIVES AFTER 30 DAYS
    state.remainingLives = 4;
    state.cycleDay = cycleExcess > 0 ? cycleExcess + 1 : 1;
    state.cycleStartDate = new Date(now.getTime() - cycleExcess * 24 * 60 * 60 * 1000).toISOString();
    state.lastResetDate = now.toISOString();
    state.statusMessage = '🔄 30 days elapsed by device clock! System automatically replenished 4/4 Streak Protection Lives.';
  } else {
    // Update cycleDay based on elapsed days
    state.cycleDay = Math.min(30, Math.max(1, elapsedDaysReal + 1));
  }

  // 2. CHECK DATE CHANGE ON LOCAL DEVICE (CROSSING MIDNIGHT)
  if (state.lastActiveDate !== todayStr) {
    const lastActiveParts = state.lastActiveDate.split('-').map(Number);
    const lastActiveDateObj = new Date(lastActiveParts[0], lastActiveParts[1] - 1, lastActiveParts[2]);
    const todayParts = todayStr.split('-').map(Number);
    const todayDateObj = new Date(todayParts[0], todayParts[1] - 1, todayParts[2]);

    const daysDiff = Math.round((todayDateObj.getTime() - lastActiveDateObj.getTime()) / (1000 * 60 * 60 * 24));

    if (daysDiff > 1) {
      // User missed 1 or more days
      const missedDays = daysDiff - 1;
      if (state.remainingLives >= missedDays) {
        state.remainingLives -= missedDays;
        state.statusMessage = `⚠️ Detected ${missedDays} missed days on device clock! Shield consumed ${missedDays} lives to protect streak. Remaining: ${state.remainingLives}/4 Lives.`;
      } else {
        state.remainingLives = 0;
        state.streakDays = 0;
        state.statusMessage = `❌ You missed ${missedDays} days and ran out of shield lives. Streak has been reset to 0. Let's start fresh!`;
      }
    } else if (daysDiff === 1) {
      // Normal advance to next day
      state.statusMessage = `☀️ Welcome to a new day (${todayStr})! Complete today's focus session to keep your streak burning.`;
    }

    state.lastActiveDate = todayStr;
  }

  return state;
}

export function loadMascotState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.MASCOT);
    if (saved) {
      const parsed = JSON.parse(saved);
      return syncMascotWithDeviceRealTime(parsed);
    }
  } catch (e) {
    console.error("Error loading mascot state:", e);
  }
  return syncMascotWithDeviceRealTime(INITIAL_MASCOT);
}

export function saveMascotState(state) {
  try {
    localStorage.setItem(STORAGE_KEYS.MASCOT, JSON.stringify(state));
  } catch (e) {
    console.error("Error saving mascot state:", e);
  }
}


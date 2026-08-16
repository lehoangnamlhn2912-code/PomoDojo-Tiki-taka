export const INITIAL_QUIZ_BANK = [
  {
    id: 'q1',
    question: "Con rái cá biển nắm tay nhau khi ngủ trên mặt nước nhằm mục đích gì?",
    topicName: "Thế giới động vật",
    optionA: { text: "Để không bị dòng nước cuốn trôi xa nhau", action: "Dang 2 tay ngang vai (Lateral Raise)", requiredPose: "lateral_raise", keycode: "A" },
    optionB: { text: "Để giữ ấm thân nhiệt trong mùa đông", action: "Hạ người ngồi xổm (Squat)", requiredPose: "squat", keycode: "B" },
    correctOption: 'A',
    explanation: "Rái cá biển nắm tay nhau thành từng bè khi ngủ để dòng nước không cuốn chúng trôi dạt ra xa bầy đàn.",
    funFact: "Chúng còn có một chiếc túi da nhỏ dưới nách để cất giữ hòn đá yêu thích dùng đập vỡ vỏ sò!"
  },
  {
    id: 'q2',
    question: "Loài động vật nào sau đây có thể ngủ đứng nhưng chỉ mơ khi nằm xuống?",
    topicName: "Khoa học kỳ thú",
    optionA: { text: "Ngựa (Horse)", action: "Gập bắp tay lên trước ngực (Hammer Curl)", requiredPose: "hammer_curl", keycode: "A" },
    optionB: { text: "Hươu cao cổ (Giraffe)", action: "Dang 2 tay ngang vai (Lateral Raise)", requiredPose: "lateral_raise", keycode: "B" },
    correctOption: 'A',
    explanation: "Ngựa có hệ thống gân khóa khớp giúp chúng ngủ đứng an toàn, nhưng để vào pha ngủ sâu và mơ (REM sleep), chúng bắt buộc phải nằm xuống.",
    funFact: "Ngựa chỉ cần ngủ nằm khoảng 2-3 giờ mỗi ngày là đã hồi phục đầy đủ năng lượng."
  },
  {
    id: 'q3',
    question: "Cái gì người mua biết, người bán biết, người dùng không bao giờ biết?",
    topicName: "Đố mẹo dí dỏm",
    optionA: { text: "Cỗ quan tài", action: "Hạ người ngồi xổm (Squat)", requiredPose: "squat", keycode: "A" },
    optionB: { text: "Món quà bí mật", action: "Gập bắp tay lên trước ngực (Hammer Curl)", requiredPose: "hammer_curl", keycode: "B" },
    correctOption: 'A',
    explanation: "Cỗ quan tài: Người mua biết, người bán biết, nhưng người nằm trong đó thì không bao giờ biết!",
    funFact: "Tiếng cười và vận động thể chất giúp kích thích não tiết endorphin giảm mỏi mắt tức thì."
  },
  {
    id: 'q4',
    question: "Quy tắc bảo vệ mắt '20-20-20' khuyên bạn sau 20 phút nhìn màn hình nên nhìn xa bao nhiêu mét?",
    topicName: "Bảo vệ thị lực",
    optionA: { text: "Khoảng 6 mét (20 feet) trong 20 giây", action: "Dang 2 tay ngang vai (Lateral Raise)", requiredPose: "lateral_raise", keycode: "A" },
    optionB: { text: "Khoảng 20 mét trong 2 phút", action: "Hạ người ngồi xổm (Squat)", requiredPose: "squat", keycode: "B" },
    correctOption: 'A',
    explanation: "Quy tắc 20-20-20: Cứ 20 phút làm việc, nhìn vào vật thể cách 6m (20 feet) trong ít nhất 20 giây để cơ thể mi thư giãn.",
    funFact: "Chớp mắt thường xuyên khi nhìn xa giúp tái tạo màng phim nước mắt chống khô rát."
  }
];

export const INITIAL_MASCOT = {
  name: 'Eddy',
  energy: 92,
  streakDays: 14,
  remainingLives: 4, // 4 mạng bảo vệ streak mỗi chu kỳ 30 ngày
  cycleDay: 14, // Ngày thứ 14 trong chu kỳ 30 ngày hiện tại (1 -> 30)
  totalDaysTracked: 14,
  cycleStartDate: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
  lastResetDate: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
  lastActiveDate: new Date().toISOString().split('T')[0],
  statusMessage: "Cảm thấy tràn đầy năng lượng! Chu kỳ 30 ngày đang đếm: Ngày 14/30.",
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
 * Lấy chuỗi ngày YYYY-MM-DD theo giờ địa phương của thiết bị
 * @param {Date} dateObj 
 * @returns {string} ví dụ '2026-08-15'
 */
export function getLocalDateString(dateObj = new Date()) {
  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const day = String(dateObj.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Đồng bộ toàn diện dữ liệu Mascot với Thời gian thực (Local Device Clock)
 * - Tự động phát hiện khi bước sang ngày mới (qua nửa đêm 00:00).
 * - Xử lý trừ mạng bảo vệ nếu có ngày không hoạt động.
 * - Tự động Reset về 4 Mạng sau mỗi 30 ngày tính theo đồng hồ thiết bị.
 * @param {Object} mascotState 
 * @returns {Object} mascotState đã được đồng bộ chuẩn xác
 */
export function syncMascotWithDeviceRealTime(mascotState) {
  if (!mascotState) return INITIAL_MASCOT;

  const state = { ...mascotState };
  const now = new Date();
  const todayStr = getLocalDateString(now);

  // Khởi tạo các mốc thời gian nếu chưa có
  if (!state.cycleStartDate) {
    state.cycleStartDate = now.toISOString();
  }
  if (!state.lastActiveDate) {
    state.lastActiveDate = todayStr;
  }
  if (typeof state.cycleDay !== 'number') {
    state.cycleDay = 1;
  }

  // 1. KIỂM TRA CHU KỲ 30 NGÀY THEO THỜI GIAN THỰC
  const cycleStart = new Date(state.cycleStartDate);
  const elapsedDaysReal = Math.floor((now.getTime() - cycleStart.getTime()) / (1000 * 60 * 60 * 24));

  if (elapsedDaysReal >= 30 || state.cycleDay >= 30) {
    const cycleExcess = elapsedDaysReal >= 30 ? (elapsedDaysReal % 30) : 0;
    
    // TỰ ĐỘNG RESET VỀ 4 MẠNG SAU 30 NGÀY
    state.remainingLives = 4;
    state.cycleDay = cycleExcess > 0 ? cycleExcess + 1 : 1;
    state.cycleStartDate = new Date(now.getTime() - cycleExcess * 24 * 60 * 60 * 1000).toISOString();
    state.lastResetDate = now.toISOString();
    state.statusMessage = '🔄 Đã qua 30 ngày theo đồng hồ thiết bị! Hệ thống đã tự động hồi phục 4/4 Mạng bảo vệ Streak.';
  } else {
    // Cập nhật cycleDay theo khoảng cách thời gian thực từ ngày bắt đầu chu kỳ
    state.cycleDay = Math.min(30, Math.max(1, elapsedDaysReal + 1));
  }

  // 2. KIỂM TRA SỰ THAY ĐỔI NGÀY TRÊN LOCAL DEVICE (BƯỚC QUA NGÀY MỚI)
  if (state.lastActiveDate !== todayStr) {
    const lastActiveParts = state.lastActiveDate.split('-').map(Number);
    const lastActiveDateObj = new Date(lastActiveParts[0], lastActiveParts[1] - 1, lastActiveParts[2]);
    const todayParts = todayStr.split('-').map(Number);
    const todayDateObj = new Date(todayParts[0], todayParts[1] - 1, todayParts[2]);

    const daysDiff = Math.round((todayDateObj.getTime() - lastActiveDateObj.getTime()) / (1000 * 60 * 60 * 24));

    if (daysDiff > 1) {
      // Người dùng đã bỏ lỡ 1 hoặc nhiều ngày (daysDiff - 1 ngày)
      const missedDays = daysDiff - 1;
      if (state.remainingLives >= missedDays) {
        state.remainingLives -= missedDays;
        state.statusMessage = `⚠️ Phát hiện bạn đã vắng mặt ${missedDays} ngày theo đồng hồ máy! Lá chắn đã tiêu hao ${missedDays} mạng để giữ Streak. Còn ${state.remainingLives}/4 Mạng.`;
      } else {
        state.remainingLives = 0;
        state.streakDays = 0;
        state.statusMessage = `❌ Bạn đã vắng mặt ${missedDays} ngày và hết mạng bảo vệ. Streak đã bị reset về 0. Hãy bắt đầu lại nào!`;
      }
    } else if (daysDiff === 1) {
      // Bước sang ngày tiếp theo bình thường
      state.statusMessage = `☀️ Chào ngày mới (${todayStr})! Sẵn sàng hoàn thành phiên học hôm nay để duy trì Streak.`;
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


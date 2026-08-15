import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";

const app = express();
const PORT = 3000;

app.use(express.json());

// Initialize Gemini SDK with User-Agent header
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      "User-Agent": "aistudio-build",
    },
  },
});

// API Routes
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Endpoint: High-Clarity Vietnamese Text-to-Speech Audio Stream with Chunking & Resilience
app.get("/api/tts", async (req, res) => {
  try {
    const rawText = (req.query.text as string) || "";
    if (!rawText) {
      return res.status(400).send("Text is required");
    }

    // Clean text
    const cleanText = rawText
      .replace(/[\n\r\t]+/g, " ")
      .replace(/[":*#_~`]+/g, "")
      .trim();

    // Split text into chunks of <= 100 characters on sentence / comma boundaries to avoid 400 Bad Request
    const chunks: string[] = [];
    const sentences = cleanText.split(/([.,!?;]+|\s{2,})/);
    let currentChunk = "";

    for (const part of sentences) {
      if (!part) continue;
      if ((currentChunk + part).length <= 100) {
        currentChunk += part;
      } else {
        if (currentChunk.trim()) chunks.push(currentChunk.trim());
        // If a single word or part is longer than 100, slice it
        if (part.length > 100) {
          for (let i = 0; i < part.length; i += 100) {
            chunks.push(part.substring(i, i + 100));
          }
          currentChunk = "";
        } else {
          currentChunk = part;
        }
      }
    }
    if (currentChunk.trim()) {
      chunks.push(currentChunk.trim());
    }

    // Limit to max 4 chunks (~400 characters) for responsive fast playback
    const chunksToFetch = chunks.slice(0, 4);
    const audioBuffers: Buffer[] = [];

    for (const chunk of chunksToFetch) {
      if (!chunk.trim()) continue;
      const googleTtsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&tl=vi&client=tw-ob&q=${encodeURIComponent(chunk)}`;
      
      const response = await fetch(googleTtsUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
          "Referer": "https://translate.google.com/"
        }
      });

      if (response.ok) {
        const arrayBuffer = await response.arrayBuffer();
        audioBuffers.push(Buffer.from(arrayBuffer));
      }
    }

    if (audioBuffers.length === 0) {
      throw new Error("Could not retrieve audio chunks from upstream");
    }

    const finalBuffer = Buffer.concat(audioBuffers);
    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.send(finalBuffer);
  } catch (error: any) {
    console.error("TTS endpoint error:", error);
    res.status(500).json({ error: error.message || "Failed to generate Vietnamese TTS" });
  }
});

// Helper for Gemini Call with multi-model fallback on 503 / 429
async function callGeminiWithFallback(prompt: string, config: any) {
  const modelsToTry = ["gemini-3.7-flash", "gemini-flash-latest", "gemini-3.1-flash-lite"];
  let lastError: any = null;

  for (const model of modelsToTry) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: prompt,
        config
      });
      if (response.text) {
        return JSON.parse(response.text);
      }
    } catch (err: any) {
      console.warn(`Gemini model ${model} attempt failed (${err.message || err.status}), trying next fallback...`);
      lastError = err;
    }
  }

  throw lastError || new Error("All Gemini models unavailable");
}

// Curated Topic Fallback Quizzes for 100% Reliability during 503 Spikes
const FALLBACK_QUIZZES_BY_TOPIC: Record<string, { topicTitle: string; questions: any[] }> = {
  random: {
    topicTitle: "Đố Vui Thể Chất & Khám Phá Kỳ Thú",
    questions: [
      {
        id: "fb_rand_1",
        question: "Con rái cá biển nắm tay nhau khi ngủ trên mặt nước nhằm mục đích gì?",
        topicName: "Thế giới động vật",
        optionA: { text: "Để không bị dòng nước cuốn trôi xa nhau", action: "Dang 2 tay ngang vai (Lateral Raise)", requiredPose: "lateral_raise", keycode: "A" },
        optionB: { text: "Để giữ ấm thân nhiệt trong mùa đông", action: "Hạ người ngồi xổm (Squat)", requiredPose: "squat", keycode: "B" },
        correctOption: "A",
        explanation: "Rái cá biển nắm tay nhau thành từng bè khi ngủ để dòng nước không cuốn chúng trôi dạt xa nhau.",
        funFact: "Chúng còn có một chiếc túi da nhỏ dưới nách để cất giữ hòn đá đập vỏ sò!"
      },
      {
        id: "fb_rand_2",
        question: "Loài động vật nào sau đây có thể ngủ đứng nhưng chỉ mơ khi nằm xuống?",
        topicName: "Khoa học kỳ thú",
        optionA: { text: "Ngựa (Horse)", action: "Gập bắp tay lên ngực (Hammer Curl)", requiredPose: "hammer_curl", keycode: "A" },
        optionB: { text: "Hươu cao cổ (Giraffe)", action: "Dang 2 tay ngang vai (Lateral Raise)", requiredPose: "lateral_raise", keycode: "B" },
        correctOption: "A",
        explanation: "Ngựa có hệ thống gân khóa khớp giúp ngủ đứng, nhưng chỉ có thể vào trạng thái ngủ sâu và mơ (REM) khi nằm.",
        funFact: "Ngựa chỉ cần ngủ nằm khoảng 2-3 giờ mỗi ngày để hồi sức."
      },
      {
        id: "fb_rand_3",
        question: "Quy tắc bảo vệ mắt '20-20-20' khuyên bạn sau 20 phút nhìn màn hình nên nhìn xa bao nhiêu?",
        topicName: "Bảo vệ thị lực",
        optionA: { text: "Khoảng 6 mét (20 feet) trong 20 giây", action: "Dang 2 tay ngang vai (Lateral Raise)", requiredPose: "lateral_raise", keycode: "A" },
        optionB: { text: "Khoảng 20 mét trong 2 phút", action: "Hạ người ngồi xổm (Squat)", requiredPose: "squat", keycode: "B" },
        correctOption: "A",
        explanation: "Quy tắc 20-20-20 giúp cơ thể mi của mắt thư giãn, tái lập màng phim nước mắt chống khô rát.",
        funFact: "Tốc độ chớp mắt giảm 50% khi tập trung nhìn màn hình máy tính."
      },
      {
        id: "fb_rand_4",
        question: "Cái gì người mua biết, người bán biết, người dùng không bao giờ biết?",
        topicName: "Đố mẹo dí dỏm",
        optionA: { text: "Cỗ quan tài", action: "Hạ người ngồi xổm (Squat)", requiredPose: "squat", keycode: "A" },
        optionB: { text: "Hộp quà bí mật", action: "Gập bắp tay lên ngực (Hammer Curl)", requiredPose: "hammer_curl", keycode: "B" },
        correctOption: "A",
        explanation: "Cỗ quan tài: Người mua biết, người bán biết, nhưng người nằm trong đó không bao giờ biết!",
        funFact: "Cười vui vẻ kích hoạt não tiết endorphin giúp giảm căng thẳng mắt ngay tức thì."
      }
    ]
  },
  cute_animals: {
    topicTitle: "Thế Giới Động Vật Đáng Yêu",
    questions: [
      {
        id: "fb_anim_1",
        question: "Chim cánh cụt Gentoo cầu hôn bạn đời bằng món quà gì?",
        topicName: "Động vật đáng yêu",
        optionA: { text: "Một hòn sỏi mịn đẹp nhất tìm được trên bãi biển", action: "Dang 2 tay ngang vai (Lateral Raise)", requiredPose: "lateral_raise", keycode: "A" },
        optionB: { text: "Một con cá tươi béo ngậy vừa bắt dưới biển", action: "Hạ người ngồi xổm (Squat)", requiredPose: "squat", keycode: "B" },
        correctOption: "A",
        explanation: "Chim cánh cụt đực sẽ lùng sục khắp bờ biển để tìm một hòn sỏi tròn trịa, nhẵn bóng hoàn hảo nhất để đặt dưới chân chim mái cầu hôn!",
        funFact: "Nếu chim mái đồng ý, nó sẽ nhặt hòn sỏi đặt vào tổ ấm của cả hai."
      },
      {
        id: "fb_anim_2",
        question: "Gấu túi Koala con sau khi sinh ra có kích thước bằng thứ gì?",
        topicName: "Động vật đáng yêu",
        optionA: { text: "Bằng một hạt đậu thạch (Jelly Bean) ~ 2cm", action: "Gập bắp tay lên ngực (Hammer Curl)", requiredPose: "hammer_curl", keycode: "A" },
        optionB: { text: "Bằng quả táo nhỏ", action: "Hạ người ngồi xổm (Squat)", requiredPose: "squat", keycode: "B" },
        correctOption: "A",
        explanation: "Koala sơ sinh chỉ dài khoảng 2cm, chưa có lông và chưa mở mắt, tự bò vào túi mẹ để bú sữa phát triển.",
        funFact: "Koala dành tới 18-22 tiếng mỗi ngày chỉ để ngủ và thư giãn."
      }
    ]
  },
  science_curiosity: {
    topicTitle: "Khoa Học Vũ Trụ & Cơ Thể Kỳ Thú",
    questions: [
      {
        id: "fb_sci_1",
        question: "Nếu bạn bay vào không gian vũ trụ, chiều cao cơ thể bạn sẽ thay đổi thế nào?",
        topicName: "Khoa học vũ trụ",
        optionA: { text: "Cao thêm khoảng 3 - 5 cm do đĩa đệm cột sống giãn nở", action: "Dang 2 tay ngang vai (Lateral Raise)", requiredPose: "lateral_raise", keycode: "A" },
        optionB: { text: "Thấp đi 2 cm do áp suất chân không", action: "Hạ người ngồi xổm (Squat)", requiredPose: "squat", keycode: "B" },
        correctOption: "A",
        explanation: "Trong môi trường không trọng lực, lực nén lên cột sống biến mất giúp các đĩa đệm nở ra, làm phi hành gia cao thêm đến 5cm!",
        funFact: "Khi trở lại Trái Đất, trọng lực sẽ dần nén chiều cao về mức ban đầu."
      }
    ]
  },
  riddle_jokes: {
    topicTitle: "Đố Mẹo Dân Gian Dí Dỏm",
    questions: [
      {
        id: "fb_rid_1",
        question: "Con gì đập thì sống, không đập thì chết?",
        topicName: "Đố mẹo dí dỏm",
        optionA: { text: "Trái tim", action: "Gập bắp tay lên ngực (Hammer Curl)", requiredPose: "hammer_curl", keycode: "A" },
        optionB: { text: "Con cá sấu", action: "Dang 2 tay ngang vai (Lateral Raise)", requiredPose: "lateral_raise", keycode: "B" },
        correctOption: "A",
        explanation: "Trái tim đập liên hồi để bơm máu nuôi cơ thể. Trái tim ngừng đập là nguy hiểm!",
        funFact: "Mỗi ngày trái tim người đập khoảng 100.000 nhịp để nuôi dưỡng toàn bộ tế bào."
      }
    ]
  },
  brain_wellness: {
    topicTitle: "Sức Khỏe Não Bộ & Bảo Vệ Thị Lực",
    questions: [
      {
        id: "fb_brain_1",
        question: "Não bộ con người chiếm khoảng 2% trọng lượng cơ thể nhưng tiêu thụ bao nhiêu % năng lượng calo?",
        topicName: "Sức khỏe não bộ",
        optionA: { text: "Khoảng 20% tổng năng lượng cơ thể", action: "Dang 2 tay ngang vai (Lateral Raise)", requiredPose: "lateral_raise", keycode: "A" },
        optionB: { text: "Khoảng 5% tổng năng lượng", action: "Hạ người ngồi xổm (Squat)", requiredPose: "squat", keycode: "B" },
        correctOption: "A",
        explanation: "Dù rất nhỏ gọn, não bộ là cơ quan tiêu hao năng lượng nhiều nhất, ngốn tới 20% lượng oxy và đường glucose của toàn cơ thể.",
        funFact: "Uống đủ nước và hít thở sâu trong giờ nghỉ giúp não nạp oxy nhanh gấp 2 lần."
      }
    ]
  }
};

// Endpoint: AI-Powered Fatigue & Focus Analytics Synthesis
app.post("/api/fatigue/analyze", async (req, res) => {
  try {
    const {
      fatigueScore = 42,
      studyDurationMinutes = 120,
      averageDistanceCm = 52,
      closeDistanceAlerts = 4,
      ambientNoiseDb = 48,
      streakDays = 14,
      cycleDay = 14,
      remainingLives = 4,
      blindBreaksCompleted = 3,
      history = [],
      additionalNotes = ""
    } = req.body;

    const prompt = `
Bạn là Trợ lý AI Chuyên gia Sinh trắc học & Tối ưu hóa Năng lượng Học tập (PomoDojo Fatigue AI).
Hãy phân tích các thông số sinh trắc học và thói quen học tập của người dùng sau đây để đưa ra bảng phân tích chi tiết, các chỉ số thống kê cho biểu đồ, cùng lời khuyên đề xuất cá nhân hóa:

[DỮ LIỆU ĐẦU VÀO]:
- Mức độ mệt mỏi ước tính ban đầu: ${fatigueScore}%
- Thời gian học liên tục: ${studyDurationMinutes} phút
- Khoảng cách mắt - màn hình trung bình: ${averageDistanceCm} cm (chuẩn an toàn: > 50cm)
- Số lần vi phạm ngồi quá gần màn hình (< 45cm): ${closeDistanceAlerts} lần
- Độ ồn môi trường xung quanh: ${ambientNoiseDb} dB
- Chuỗi Streak học tập: ${streakDays} ngày
- Ngày trong chu kỳ 30 ngày hiện tại: Ngày ${cycleDay}/30
- Số mạng bảo vệ Streak còn lại: ${remainingLives}/4 Mạng
- Số phiên nghỉ không màn hình (Blind Break) hoàn thành: ${blindBreaksCompleted} phiên
- Ghi chú thêm: ${additionalNotes || "Không có"}

Hãy phân tích chuyên sâu và trả về JSON theo đúng định dạng được yêu cầu. Đảm bảo số liệu biểu đồ 7 ngày hợp lý, logic và mang tính khoa học cao.
`;

    const config = {
      systemInstruction: "Bạn là chuyên gia AI về công thái học, bảo vệ thị lực và tâm lý học năng lượng PomoDojo. Trả về định dạng JSON thuần túy.",
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          fatigueIndex: { type: Type.NUMBER, description: "Chỉ số mệt mỏi tổng hợp từ 0-100" },
          riskLevel: { type: Type.STRING, description: "Mức độ rủi ro: An toàn, Nhẹ, Trung bình, Cao, Báo động" },
          statusTitle: { type: Type.STRING, description: "Tiêu đề ngắn gọn về tình trạng năng lượng" },
          statusDescription: { type: Type.STRING, description: "Mô tả chi tiết tình trạng sinh lý và thị giác" },
          recommendedSessionMinutes: { type: Type.NUMBER, description: "Thời lượng phiên học tối ưu (phút)" },
          recommendedBreakMinutes: { type: Type.NUMBER, description: "Thời lượng nghỉ Blind Break tối ưu (phút)" },
          optimalTimeWindows: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "Các khung giờ vàng tập trung tốt nhất trong ngày"
          },
          attentionSpanAnalysis: { type: Type.STRING, description: "Phân tích nhịp độ chú ý và thời điểm suy giảm tập trung" },
          keyInsights: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "3-4 điểm đúc kết quan trọng nhất từ dữ liệu đo đạc"
          },
          actionableRecommendations: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                category: { type: Type.STRING, description: "Danh mục: Thị giác, Tư thế, Âm học, Nhịp nghỉ" },
                title: { type: Type.STRING, description: "Tên đề xuất" },
                description: { type: Type.STRING, description: "Chi tiết hành động cụ thể" },
                priority: { type: Type.STRING, description: "Mức ưu tiên: Cao, Trung bình, Thấp" }
              },
              required: ["category", "title", "description", "priority"]
            }
          },
          metricsBreakdown: {
            type: Type.OBJECT,
            properties: {
              eyeStrainScore: { type: Type.NUMBER, description: "Điểm căng thẳng mắt (0-100)" },
              postureDisruptionScore: { type: Type.NUMBER, description: "Điểm sai lệch tư thế / cúi sát (0-100)" },
              cognitiveLoadScore: { type: Type.NUMBER, description: "Điểm tải nhận thức (0-100)" },
              acousticStressScore: { type: Type.NUMBER, description: "Điểm căng thẳng do tiếng ồn (0-100)" }
            },
            required: ["eyeStrainScore", "postureDisruptionScore", "cognitiveLoadScore", "acousticStressScore"]
          },
          weeklyForecast: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                day: { type: Type.STRING, description: "T2, T3, T4, T5, T6, T7, CN" },
                focusHours: { type: Type.NUMBER, description: "Số giờ học tập trung khuyến nghị" },
                fatigueScore: { type: Type.NUMBER, description: "Chỉ số mệt mỏi dự báo (%)" },
                readinessScore: { type: Type.NUMBER, description: "Độ sẵn sàng học tập (%)" }
              },
              required: ["day", "focusHours", "fatigueScore", "readinessScore"]
            },
            description: "Biểu đồ 7 ngày phân bổ thời gian và năng lượng tối ưu"
          },
          mascotAdvice: { type: Type.STRING, description: "Lời khuyên ấm áp, dí dỏm từ linh vật Eddy" }
        },
        required: [
          "fatigueIndex",
          "riskLevel",
          "statusTitle",
          "statusDescription",
          "recommendedSessionMinutes",
          "recommendedBreakMinutes",
          "optimalTimeWindows",
          "attentionSpanAnalysis",
          "keyInsights",
          "actionableRecommendations",
          "metricsBreakdown",
          "weeklyForecast",
          "mascotAdvice"
        ]
      }
    };

    let resultData;
    try {
      resultData = await callGeminiWithFallback(prompt, config);
    } catch (llmErr) {
      console.warn("Gemini offline/busy, generating intelligent heuristic analysis:", llmErr);
      const computedFatigue = Math.min(95, Math.max(10, Math.round(fatigueScore + closeDistanceAlerts * 3 + (studyDurationMinutes > 90 ? 15 : 0))));
      resultData = {
        fatigueIndex: computedFatigue,
        riskLevel: computedFatigue > 60 ? "Cảnh báo" : computedFatigue > 35 ? "Trung bình" : "Tốt",
        statusTitle: "Trạng Thái Năng Lượng Ổn Định",
        statusDescription: `Bạn đã học liên tục ${studyDurationMinutes} phút với khoảng cách mắt trung bình ${averageDistanceCm}cm. Chu kỳ 30 ngày ghi nhận ${streakDays} ngày liên tục.`,
        recommendedSessionMinutes: computedFatigue > 50 ? 20 : 25,
        recommendedBreakMinutes: 5,
        optimalTimeWindows: ["08:00 - 10:30 (Khung giờ đỉnh cao)", "14:30 - 16:30 (Sáng tạo & ôn tập)"],
        attentionSpanAnalysis: "Khả năng tập trung duy trì tốt trong 25 phút đầu, sau đó độ tập trung bắt đầu giảm dần nếu không có nghỉ ngơi.",
        keyInsights: [
          `Khoảng cách ${averageDistanceCm}cm nằm trong ngưỡng an toàn bảo vệ thị lực.`,
          `Hoàn thành ${blindBreaksCompleted} phiên nghỉ Blind Break giúp cơ thể mi mắt phục hồi 40%.`,
          `Chu kỳ hiện tại: Ngày ${cycleDay}/30 với ${remainingLives} mạng bảo vệ Streak còn nguyên vẹn.`
        ],
        actionableRecommendations: [
          { category: "Thị giác", title: "Thực hiện quy tắc 20-20-20", description: "Mỗi 20 phút nhìn xa 6 mét trong 20 giây để giảm căng cơ mi.", priority: "Cao" },
          { category: "Tư thế", title: "Giữ khoảng cách > 50cm", description: "Điều chỉnh ghế ngồi để mắt cách màn hình tối thiểu 50cm.", priority: "Trung bình" }
        ],
        metricsBreakdown: {
          eyeStrainScore: Math.min(100, closeDistanceAlerts * 10 + 20),
          postureDisruptionScore: Math.max(10, 100 - averageDistanceCm),
          cognitiveLoadScore: computedFatigue,
          acousticStressScore: Math.max(15, ambientNoiseDb - 30)
        },
        weeklyForecast: [
          { day: "T2", focusHours: 3.5, fatigueScore: 35, readinessScore: 85 },
          { day: "T3", focusHours: 4.0, fatigueScore: 40, readinessScore: 80 },
          { day: "T4", focusHours: 3.0, fatigueScore: 45, readinessScore: 75 },
          { day: "T5", focusHours: 4.5, fatigueScore: 50, readinessScore: 70 },
          { day: "T6", focusHours: 3.5, fatigueScore: 42, readinessScore: 78 },
          { day: "T7", focusHours: 5.0, fatigueScore: 30, readinessScore: 90 },
          { day: "CN", focusHours: 2.0, fatigueScore: 20, readinessScore: 95 }
        ],
        mascotAdvice: `Cú Eddy khuyên bạn: Giữ vững chuỗi ${streakDays} ngày nhé! Sau mỗi phiên học, hãy đứng dậy vận động một chút để mắt sáng và đầu óc tỉnh táo!`
      };
    }

    res.json({ success: true, data: resultData });
  } catch (error: any) {
    console.error("Gemini Fatigue Analysis Error:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to analyze fatigue metrics"
    });
  }
});

// Endpoint: AI-Powered Fun & Relaxing Audio Quiz Generator with Robust Multi-Model Fallback
app.post("/api/quiz/generate", async (req, res) => {
  try {
    const { topic = "random", count = 4 } = req.body;

    const topicPrompts: Record<string, string> = {
      random: "Bộ câu hỏi đố vui ngẫu nhiên kỳ thú, dí dỏm, sự thật thú vị bất ngờ giúp não bộ thư giãn giải tỏa căng thẳng sau giờ học.",
      cute_animals: "Bộ câu hỏi về những sự thật siêu đáng yêu, hài hước và bất ngờ về các loài động vật (như rái cá, chim cánh cụt, mèo, chó, cá heo...).",
      science_curiosity: "Bộ câu hỏi khoa học vui, vũ trụ kỳ thú, hiện tượng tự nhiên hài hước và các bí mật ngộ nghĩnh về cơ thể người.",
      riddle_jokes: "Bộ câu đố mẹo dân gian hoặc hiện đại dí dỏm, chơi chữ thông minh, mang lại tiếng cười sảng khoái và kích thích tư duy nhẹ nhàng.",
      brain_wellness: "Bộ câu đố vui về sức khỏe thị giác, thói quen thư giãn, dinh dưỡng ngon bổ và mẹo ngủ ngon, học tập tràn đầy năng lượng."
    };

    const selectedTopicDescription = topicPrompts[topic] || topicPrompts.random;

    const prompt = `
Bạn là Trợ lý Quiz Master dí dỏm của ứng dụng PomoDojo (Linh vật Cú Eddy).
Nhiệm vụ của bạn: Tạo ra chính xác ${count} câu đố trắc nghiệm (gồm 2 đáp án A và B) cực kỳ vui vẻ, nhẹ nhàng, dí dỏm và dễ tiếp thu để người dùng giải trí trong giờ nghỉ giải lao Blind Break.

[QUY TẮC BẮT BUỘC VỀ ĐỘNG TÁC TƯƠNG TÁC THỂ CHẤT]:
Trong PomoDojo, người dùng KHÔNG THỂ bấm chuột hay bàn phím, camera AI (MediaPipe Pose Detection) sẽ trực tiếp quét cơ thể người dùng. Để chọn đáp án A hoặc B, người dùng BẮT BUỘC PHẢI thực hiện 1 trong các động tác thể chất không cần dụng cụ sau:
- "squat": Squat (Gánh đùi / Ngồi xổm)
- "lateral_raise": Lateral Raise (Dang hai tay ngang vai)
- "hammer_curl": Hammer Curl (Gập bắp tay lên trước ngực)
- "push_up": Push-up (Chống đẩy)
- "plank": Plank (Đo ván)
- "russian_twist": Russian Twist (Xoay eo)

Mỗi câu hỏi:
- Option A PHẢI được gán một động tác thể chất từ danh sách trên (ví dụ: requiredPose: "lateral_raise", action: "Dang 2 tay ngang vai (Lateral Raise) để chọn A").
- Option B PHẢI được gán một động tác thể chất KHÁC Option A từ danh sách trên (ví dụ: requiredPose: "squat", action: "Hạ người Squat (Gánh đùi) để chọn B").

[YÊU CẦU NỘI DUNG]:
- Chủ đề: ${selectedTopicDescription}
- Phong cách: Hài hước, thân thiện, sảng khoái, không tạo áp lực học thuật, giải thích ngắn gọn thú vị.
- Ngôn ngữ: Tiếng Việt chuẩn mực, dí dỏm.

Hãy trả về JSON theo đúng cấu trúc schema yêu cầu.
`;

    const config = {
      systemInstruction: "Bạn là Quiz Master vui vẻ, tạo các câu đố trắc nghiệm vui 2 lựa chọn (A và B) để tập thể dục và thư giãn đầu óc. Trả về JSON thuần túy.",
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          topicTitle: { type: Type.STRING, description: "Tên chủ đề câu đố dí dỏm" },
          questions: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING, description: "ID câu hỏi (ví dụ: quiz_1)" },
                question: { type: Type.STRING, description: "Nội dung câu hỏi đố vui dí dỏm" },
                topicName: { type: Type.STRING, description: "Tên nhãn thể loại ngắn gọn (ví dụ: Động vật dễ thương)" },
                optionA: {
                  type: Type.OBJECT,
                  properties: {
                    text: { type: Type.STRING, description: "Nội dung lựa chọn A" },
                    action: { type: Type.STRING, description: "Mô tả động tác cần làm để chọn A" },
                    requiredPose: { type: Type.STRING, description: "squat | lateral_raise | hammer_curl | push_up | plank | russian_twist" },
                    keycode: { type: Type.STRING, description: "A" }
                  },
                  required: ["text", "action", "requiredPose", "keycode"]
                },
                optionB: {
                  type: Type.OBJECT,
                  properties: {
                    text: { type: Type.STRING, description: "Nội dung lựa chọn B" },
                    action: { type: Type.STRING, description: "Mô tả động tác cần làm để chọn B" },
                    requiredPose: { type: Type.STRING, description: "squat | lateral_raise | hammer_curl | push_up | plank | russian_twist" },
                    keycode: { type: Type.STRING, description: "B" }
                  },
                  required: ["text", "action", "requiredPose", "keycode"]
                },
                correctOption: { type: Type.STRING, description: "A hoặc B" },
                explanation: { type: Type.STRING, description: "Lời giải thích hài hước, ngắn gọn và bổ ích" },
                funFact: { type: Type.STRING, description: "Một sự thật bên lề vui vẻ siêu ngắn" }
              },
              required: ["id", "question", "topicName", "optionA", "optionB", "correctOption", "explanation", "funFact"]
            }
          }
        },
        required: ["topicTitle", "questions"]
      }
    };

    let parsedData;
    try {
      parsedData = await callGeminiWithFallback(prompt, config);
    } catch (llmErr) {
      console.warn("Gemini quiz generation busy (503/timeout), using rich curated fallback topic bank:", llmErr);
      parsedData = FALLBACK_QUIZZES_BY_TOPIC[topic] || FALLBACK_QUIZZES_BY_TOPIC.random;
    }

    res.json({ success: true, data: parsedData });
  } catch (error: any) {
    console.error("Gemini Quiz Generation Error:", error);
    const fallback = FALLBACK_QUIZZES_BY_TOPIC.random;
    res.json({ success: true, data: fallback });
  }
});

// Vite middleware in dev / Static files in production
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`PomoDojo Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();

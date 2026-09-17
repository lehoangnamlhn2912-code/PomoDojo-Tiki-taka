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

// Endpoint: High-Clarity Text-to-Speech Audio Stream with Chunking & Resilience
app.get("/api/tts", async (req, res) => {
  try {
    const rawText = (req.query.text as string) || "";
    const lang = (req.query.lang as string) || "en";
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
    const langCode = lang.startsWith("vi") ? "vi" : "en";

    for (const chunk of chunksToFetch) {
      if (!chunk.trim()) continue;
      const googleTtsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&tl=${langCode}&client=tw-ob&q=${encodeURIComponent(chunk)}`;
      
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
    res.status(500).json({ error: error.message || "Failed to generate TTS audio" });
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
    topicTitle: "Body Motion Trivia & Fascinating Facts",
    questions: [
      {
        id: "fb_rand_1",
        question: "Why do sea otters hold hands when they sleep floating on water?",
        topicName: "Cute Animals",
        optionA: { text: "To keep from drifting apart in currents", action: "Raise both arms sideways (Lateral Raise)", requiredPose: "lateral_raise", keycode: "A" },
        optionB: { text: "To preserve body heat in cold water", action: "Lower into a deep squat (Squat)", requiredPose: "squat", keycode: "B" },
        correctOption: "A",
        explanation: "Sea otters hold hands to form rafts while sleeping so ocean currents don't drift them away from their group.",
        funFact: "They also have a small skin pouch under their armpits to store their favorite shell-cracking rock!"
      },
      {
        id: "fb_rand_2",
        question: "Which of the following animals can sleep standing up, but only dreams when lying down?",
        topicName: "Curious Science",
        optionA: { text: "Horse", action: "Curl forearms to chest (Hammer Curl)", requiredPose: "hammer_curl", keycode: "A" },
        optionB: { text: "Giraffe", action: "Raise both arms sideways (Lateral Raise)", requiredPose: "lateral_raise", keycode: "B" },
        correctOption: "A",
        explanation: "Horses have a stay-apparatus tendon locking mechanism to snooze standing up, but they must lie down to enter deep REM dreaming sleep.",
        funFact: "Horses only need about 2 to 3 hours of lying-down sleep per day to recover."
      },
      {
        id: "fb_rand_3",
        question: "The '20-20-20' eye rule suggests looking how far away after 20 minutes of screen time?",
        topicName: "Vision Health",
        optionA: { text: "About 20 feet (6 meters) for 20 seconds", action: "Raise both arms sideways (Lateral Raise)", requiredPose: "lateral_raise", keycode: "A" },
        optionB: { text: "About 20 meters for 2 minutes", action: "Lower into a deep squat (Squat)", requiredPose: "squat", keycode: "B" },
        correctOption: "A",
        explanation: "The 20-20-20 rule helps your eye ciliary muscles relax, replenishing tear film against dryness.",
        funFact: "Blink rate drops by nearly 50% when concentrating on computer screens."
      },
      {
        id: "fb_rand_4",
        question: "What is made for someone who never sees it, bought by someone who doesn't use it, and used by someone who never knows it?",
        topicName: "Clever Riddles",
        optionA: { text: "A coffin", action: "Lower into a deep squat (Squat)", requiredPose: "squat", keycode: "A" },
        optionB: { text: "A secret gift", action: "Curl forearms to chest (Hammer Curl)", requiredPose: "hammer_curl", keycode: "B" },
        correctOption: "A",
        explanation: "A coffin: The maker sells it, the buyer doesn't use it for themselves, and the occupant never knows!",
        funFact: "Laughing and stretching trigger endorphin release that quickly relieves visual tension."
      }
    ]
  },
  cute_animals: {
    topicTitle: "Adorable Animal Kingdom",
    questions: [
      {
        id: "fb_anim_1",
        question: "What unique gift does a Gentoo penguin present when proposing to a mate?",
        topicName: "Cute Animals",
        optionA: { text: "The smoothest pebble found on the beach", action: "Raise both arms sideways (Lateral Raise)", requiredPose: "lateral_raise", keycode: "A" },
        optionB: { text: "A freshly caught plump fish", action: "Lower into a deep squat (Squat)", requiredPose: "squat", keycode: "B" },
        correctOption: "A",
        explanation: "Male penguins search entire shorelines to find the smoothest pebble to place at the female's feet as a proposal!",
        funFact: "If accepted, the female places the pebble into their shared nest."
      },
      {
        id: "fb_anim_2",
        question: "How small is a newborn baby koala (joey)?",
        topicName: "Cute Animals",
        optionA: { text: "About the size of a jelly bean (~2 cm)", action: "Curl forearms to chest (Hammer Curl)", requiredPose: "hammer_curl", keycode: "A" },
        optionB: { text: "About the size of a small apple", action: "Lower into a deep squat (Squat)", requiredPose: "squat", keycode: "B" },
        correctOption: "A",
        explanation: "Newborn koalas are hairless, blind, and roughly 2 cm long. They climb instinctively into their mother's pouch to develop.",
        funFact: "Koalas spend 18 to 22 hours every single day sleeping and resting."
      }
    ]
  },
  science_curiosity: {
    topicTitle: "Cosmic Science & Human Curiosities",
    questions: [
      {
        id: "fb_sci_1",
        question: "What happens to your height when you stay in outer space microgravity?",
        topicName: "Space Science",
        optionA: { text: "Grow 3-5 cm taller as spinal discs expand", action: "Raise both arms sideways (Lateral Raise)", requiredPose: "lateral_raise", keycode: "A" },
        optionB: { text: "Shrink 2 cm due to vacuum pressure", action: "Lower into a deep squat (Squat)", requiredPose: "squat", keycode: "B" },
        correctOption: "A",
        explanation: "Without Earth's gravity compressing the spine, spinal discs expand, making astronauts up to 5 cm taller!",
        funFact: "Once returning to Earth, gravity gradually compresses the spine back to original height."
      }
    ]
  },
  riddle_jokes: {
    topicTitle: "Clever Riddles & Wordplay",
    questions: [
      {
        id: "fb_rid_1",
        question: "What has hands and a face, but cannot smile or clap?",
        topicName: "Clever Riddles",
        optionA: { text: "A clock", action: "Curl forearms to chest (Hammer Curl)", requiredPose: "hammer_curl", keycode: "A" },
        optionB: { text: "A puppet", action: "Raise both arms sideways (Lateral Raise)", requiredPose: "lateral_raise", keycode: "B" },
        correctOption: "A",
        explanation: "A clock has hour and minute hands, and an analog face, but no feelings!",
        funFact: "Solving light riddles boosts divergent thinking and recharges cognitive bandwidth."
      }
    ]
  },
  brain_wellness: {
    topicTitle: "Brain Health & Vision Care",
    questions: [
      {
        id: "fb_brain_1",
        question: "The human brain makes up roughly 2% of total body weight, but consumes what percentage of body energy?",
        topicName: "Brain Health",
        optionA: { text: "Around 20% of total caloric energy", action: "Raise both arms sideways (Lateral Raise)", requiredPose: "lateral_raise", keycode: "A" },
        optionB: { text: "Around 5% of total caloric energy", action: "Lower into a deep squat (Squat)", requiredPose: "squat", keycode: "B" },
        correctOption: "A",
        explanation: "Despite its compact size, the brain is the most energy-intensive organ, consuming up to 20% of resting glucose and oxygen.",
        funFact: "Hydrating and taking deep breaths during study breaks doubles brain oxygen replenishment."
      }
    ]
  }
};

// Endpoint: AI-Powered Fatigue & Focus Analytics Synthesis (Real Telemetry & Ultra-Concise Advice)
app.post("/api/fatigue/analyze", async (req, res) => {
  try {
    const {
      todayStats = {},
      history7Days = [],
      streakDays = 14,
      cycleDay = 14,
      remainingLives = 4,
      additionalNotes = ""
    } = req.body;

    const focusMinutes = typeof todayStats.focusMinutes === 'number' ? todayStats.focusMinutes : 0;
    const avgDistanceCm = typeof todayStats.avgDistanceCm === 'number' ? todayStats.avgDistanceCm : null;
    const dimEvents = typeof todayStats.dimEvents === 'number' ? todayStats.dimEvents : 0;
    const avgNoiseDb = typeof todayStats.avgNoiseDb === 'number' ? todayStats.avgNoiseDb : null;
    const noiseSpikes = typeof todayStats.noiseSpikes === 'number' ? todayStats.noiseSpikes : 0;
    const eyeOscillationsPerSec = typeof todayStats.eyeOscillationsPerSec === 'number' ? todayStats.eyeOscillationsPerSec : 0;
    const fatigueScore = typeof todayStats.fatigueScore === 'number' ? todayStats.fatigueScore : null;
    const hasData = Boolean(todayStats.hasData && (focusMinutes > 0 || dimEvents > 0 || noiseSpikes > 0));

    // When no data has been recorded yet, strictly return null for scores (renders as --%)
    // and do not make up numbers or premature advice!
    if (!hasData) {
      return res.json({
        success: true,
        data: {
          fatigueIndex: null,
          riskLevel: "No Data",
          statusTitle: "No Data Recorded",
          statusDescription: "No focus sessions recorded today yet. Start a session to track telemetry.",
          aiAdvice: "No focus sessions recorded today yet. Start a session in the Focus tab to activate real-time biometric telemetry and AI advice.",
          recommendedSessionMinutes: null,
          recommendedBreakMinutes: null,
          optimalTimeWindows: [],
          keyInsights: [
            "No focus sessions recorded today yet.",
            "Biometric telemetry will be collected during your focus sessions."
          ],
          actionableRecommendations: [
            {
              category: "Vision",
              title: "20-20-20 Vision Rule",
              description: "Every 20 minutes, gaze at an object 6 meters (20 feet) away for 20 seconds to relax ciliary muscles.",
              priority: "High"
            },
            {
              category: "Posture",
              title: "Safe Distance > 50cm",
              description: "Adjust your seat so your eyes remain at least an arm's length (50cm) from the monitor.",
              priority: "Medium"
            }
          ],
          metricsBreakdown: {
            eyeStrainScore: null,
            postureDisruptionScore: null,
            cognitiveLoadScore: null,
            acousticStressScore: null
          }
        }
      });
    }

    const recordedPastDays = (Array.isArray(history7Days) ? history7Days : []).filter(
      (d: any) => d && d.hasData && !d.isToday
    );
    const validHistorySummary = recordedPastDays.length > 0
      ? recordedPastDays.map((d: any) => `${d.dayLabel} (${d.date}): ${d.focusHours || 0}h focus, fatigue ${d.fatigueScore || 'N/A'}%`).join("; ")
      : "No previous recorded sessions in the last 6 days.";

    const prompt = `
You are the Biometric & Study Ergonomics AI Specialist for PomoDojo.
Analyze the user's REAL focus and vision telemetry measured today:

[TODAY'S REAL METRICS]:
- Focus study duration today: ${focusMinutes} minutes
- Average eye-to-screen distance: ${avgDistanceCm !== null ? `${avgDistanceCm} cm` : "No webcam data"} (Ergonomic standard: >= 50cm)
- Screen dimming events (forced dimming because eyes too close <40cm for >=10s): ${dimEvents} times
- Average ambient environmental noise: ${avgNoiseDb !== null ? `${avgNoiseDb} dB` : "No mic data"}
- Noise threshold spikes (>65dB): ${noiseSpikes} times
- Eye micro-oscillations / saccades per second: ${eyeOscillationsPerSec} movements/sec (Normal: 0.5-1.5/s, Visual strain: >2.0/s)
- Calculated Daily Fatigue Score: ${fatigueScore !== null ? `${fatigueScore}%` : "No active session"}
- Has session data today: ${hasData ? "Yes" : "No"}
- Study streak: ${streakDays} days (Day ${cycleDay}/30, ${remainingLives} shield lives remaining)
- 7-Day actual recorded history: ${validHistorySummary}
- Additional notes: ${additionalNotes || "None"}

[STRICT USER REQUIREMENTS]:
1. The AI advice (aiAdvice) MUST BE AS CONCISE AS POSSIBLE (maximum 1-2 short, punchy sentences, directly targeting the exact issues found, zero filler/fluff).
2. ABSOLUTELY DO NOT FABRICATE OR HALLUCINATE metrics for days without data.
3. statusTitle must be 2-3 words.
4. statusDescription must be 1 concise sentence.
5. keyInsights: exactly 2 short bullet points referencing the real numbers.
6. actionableRecommendations: exactly 2 concise recommendations (1 sentence each).
7. Return strictly valid JSON adhering to the schema.
`;

    const config = {
      systemInstruction: "You are an expert in vision ergonomics and cognitive fatigue. Always return pure JSON. Follow the constraint of ultra-concise advice (1-2 sentences max). Never invent data for days without data.",
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          fatigueIndex: { type: Type.NUMBER, description: "Composite fatigue index from 0 to 100" },
          riskLevel: { type: Type.STRING, description: "Optimal, Moderate, Warning, or Critical" },
          statusTitle: { type: Type.STRING, description: "2-3 word title describing energy state" },
          statusDescription: { type: Type.STRING, description: "1 concise sentence on user state" },
          aiAdvice: { type: Type.STRING, description: "Ultra-concise advice: 1-2 punchy sentences maximum" },
          recommendedSessionMinutes: { type: Type.NUMBER, description: "Recommended study session length (minutes)" },
          recommendedBreakMinutes: { type: Type.NUMBER, description: "Recommended screen-free Blind Break duration (minutes)" },
          optimalTimeWindows: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "Peak focus time windows"
          },
          keyInsights: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "2 short conclusions from real measured biometric data"
          },
          actionableRecommendations: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                category: { type: Type.STRING, description: "Vision, Posture, Acoustics, or Recovery" },
                title: { type: Type.STRING, description: "Recommendation title" },
                description: { type: Type.STRING, description: "1 concise sentence of guidance" },
                priority: { type: Type.STRING, description: "High, Medium, Low" }
              },
              required: ["category", "title", "description", "priority"]
            }
          },
          metricsBreakdown: {
            type: Type.OBJECT,
            properties: {
              eyeStrainScore: { type: Type.NUMBER, description: "Eye strain score (0-100)" },
              postureDisruptionScore: { type: Type.NUMBER, description: "Posture disruption score (0-100)" },
              cognitiveLoadScore: { type: Type.NUMBER, description: "Cognitive load score (0-100)" },
              acousticStressScore: { type: Type.NUMBER, description: "Noise stress score (0-100)" }
            },
            required: ["eyeStrainScore", "postureDisruptionScore", "cognitiveLoadScore", "acousticStressScore"]
          }
        },
        required: [
          "fatigueIndex",
          "riskLevel",
          "statusTitle",
          "statusDescription",
          "aiAdvice",
          "recommendedSessionMinutes",
          "recommendedBreakMinutes",
          "keyInsights",
          "actionableRecommendations",
          "metricsBreakdown"
        ]
      }
    };

    let resultData;
    try {
      resultData = await callGeminiWithFallback(prompt, config);
    } catch (llmErr) {
      console.warn("Gemini offline/busy, generating intelligent heuristic analysis from real telemetry:", llmErr);
      
      const computedFatigue = hasData
        ? (fatigueScore !== null 
            ? fatigueScore 
            : Math.min(85, Math.max(10, Math.round(15 + dimEvents * 8 + (avgNoiseDb && avgNoiseDb > 55 ? 15 : 0) + (focusMinutes > 60 ? 20 : 0)))))
        : null;

      let conciseAdvice = "Posture and screen distance are in good shape. Maintain regular screen-free breaks each cycle.";
      if (!hasData) {
        conciseAdvice = "No focus sessions recorded today yet. Start a session in the Focus tab to activate real-time biometric telemetry and AI advice.";
      } else if (dimEvents > 0) {
        conciseAdvice = `Screen dimming was triggered ${dimEvents} time(s) due to leaning too close (<40cm). Push your display back to at least 50cm and blink to hydrate your eyes.`;
      } else if (noiseSpikes >= 2) {
        conciseAdvice = `Detected ${noiseSpikes} loud ambient noise spikes. Enable the acoustic shield or wear noise-cancelling headphones to reduce auditory fatigue.`;
      } else if (eyeOscillationsPerSec >= 2.0) {
        conciseAdvice = `High eye oscillation frequency (${eyeOscillationsPerSec}/s) indicates ciliary muscle strain. Rest your eyes for 20 seconds following the 20-20-20 rule.`;
      } else if (focusMinutes >= 60) {
        conciseAdvice = `You have studied continuously for ${focusMinutes} minutes. Stand up, stretch, and focus on an object 6 meters away.`;
      }

      resultData = {
        fatigueIndex: computedFatigue,
        riskLevel: !hasData ? "No Data" : computedFatigue > 65 ? "Warning" : computedFatigue > 40 ? "Moderate" : "Optimal",
        statusTitle: !hasData ? "No Data Recorded" : computedFatigue > 65 ? "Visual Strain Warning" : computedFatigue > 40 ? "Moderate Fatigue" : "Optimal Energy",
        statusDescription: hasData 
          ? `Recorded ${focusMinutes} focus minutes with average eye distance of ${avgDistanceCm || '--'}cm and sound level of ${avgNoiseDb || '--'}dB.`
          : "No focus sessions recorded today yet. Start a session to track telemetry.",
        aiAdvice: conciseAdvice,
        recommendedSessionMinutes: hasData ? (computedFatigue > 50 ? 20 : 25) : 25,
        recommendedBreakMinutes: 5,
        optimalTimeWindows: ["08:30 - 11:30", "14:30 - 16:30"],
        keyInsights: hasData ? [
          avgDistanceCm !== null
            ? `Average screen distance: ${avgDistanceCm}cm (${avgDistanceCm >= 50 ? 'Within safe ergonomic range' : 'Should be moved further back'}).`
            : "No webcam telemetry recorded for eye distance.",
          dimEvents > 0 
            ? `Screen dimming triggered ${dimEvents} time(s) due to safe proximity violations.`
            : `Average noise level: ${avgNoiseDb !== null ? `${avgNoiseDb}dB` : 'Not measured'}, ${noiseSpikes} noise spike(s) detected.`
        ] : [
          "No focus sessions recorded today yet.",
          "Biometric telemetry will be collected during your focus sessions."
        ],
        actionableRecommendations: [
          {
            category: "Vision",
            title: "20-20-20 Vision Rule",
            description: "Every 20 minutes, gaze at an object 6 meters (20 feet) away for 20 seconds to relax ciliary muscles.",
            priority: "High"
          },
          {
            category: "Posture",
            title: "Safe Distance > 50cm",
            description: "Adjust your seat so your eyes remain at least an arm's length (50cm) from the monitor.",
            priority: dimEvents > 0 ? "High" : "Medium"
          }
        ],
        metricsBreakdown: {
          eyeStrainScore: hasData ? Math.min(100, Math.max(10, Math.round(dimEvents * 15 + (avgDistanceCm ? Math.max(0, 50 - avgDistanceCm) * 3 : 20)))) : null,
          postureDisruptionScore: hasData ? Math.min(100, Math.max(10, Math.round(dimEvents * 12 + (avgDistanceCm && avgDistanceCm < 45 ? 30 : 15)))) : null,
          cognitiveLoadScore: hasData ? Math.min(100, Math.max(10, Math.round(focusMinutes * 0.5 + 20))) : null,
          acousticStressScore: hasData ? Math.min(100, Math.max(10, Math.round(noiseSpikes * 12 + (avgNoiseDb ? Math.max(0, avgNoiseDb - 45) * 2 : 15)))) : null
        }
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
      random: "Random curious, lighthearted, and surprising trivia to help the brain unwind after study sessions.",
      cute_animals: "Adorable, humorous, and unexpected facts about animals (sea otters, penguins, cats, dogs, dolphins...).",
      science_curiosity: "Fun science, cosmic wonders, fascinating natural phenomena, and quirky human body facts.",
      riddle_jokes: "Clever, witty riddles and wordplay that inspire smiles and light divergent thinking.",
      brain_wellness: "Fun facts on visual health, relaxation habits, brain nutrition, and energized study routines."
    };

    const selectedTopicDescription = topicPrompts[topic] || topicPrompts.random;

    const prompt = `
You are the witty Quiz Master Assistant for PomoDojo (Eddy the Owl Mascot).
Your mission: Create exactly ${count} fun, lighthearted, 2-choice multiple-choice quizzes (Option A and Option B) for users to enjoy during their screen-free Blind Break.

[MANDATORY PHYSICAL INTERACTION RULES]:
In PomoDojo, users DO NOT touch the mouse or keyboard. MediaPipe Pose Detection AI directly tracks their body movements via camera. To choose Option A or B, the user MUST perform one of the following bodyweight calisthenic movements:
- "squat": Squat (Deep bodyweight squat)
- "lateral_raise": Lateral Raise (Raise both arms sideways)
- "hammer_curl": Hammer Curl (Curl forearms up to chest)
- "push_up": Push-up (Body horizontal chest push)
- "plank": Plank (Core plank hold)
- "russian_twist": Russian Twist (Seated torso rotation)

For every quiz:
- Option A MUST be assigned a body movement from the list above (e.g. requiredPose: "lateral_raise", action: "Raise both arms sideways (Lateral Raise)").
- Option B MUST be assigned a DIFFERENT body movement from the list above (e.g. requiredPose: "squat", action: "Lower into a deep squat (Squat)").

[CONTENT REQUIREMENTS]:
- Topic: ${selectedTopicDescription}
- Style: Humorous, friendly, uplifting, non-academic, with crisp and engaging explanations.
- Language: Natural, engaging English.

Return pure JSON matching the specified schema.
`;

    const config = {
      systemInstruction: "You are a cheerful Quiz Master creating 2-choice physical exercise quizzes (A and B) for mental and ocular recovery. Return pure JSON only.",
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          topicTitle: { type: Type.STRING, description: "Catchy topic title" },
          questions: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING, description: "Question ID (e.g. quiz_1)" },
                question: { type: Type.STRING, description: "Engaging trivia or riddle question" },
                topicName: { type: Type.STRING, description: "Short category badge (e.g. Cute Animals)" },
                optionA: {
                  type: Type.OBJECT,
                  properties: {
                    text: { type: Type.STRING, description: "Option A answer text" },
                    action: { type: Type.STRING, description: "Physical movement instruction to select A" },
                    requiredPose: { type: Type.STRING, description: "squat | lateral_raise | hammer_curl | push_up | plank | russian_twist" },
                    keycode: { type: Type.STRING, description: "A" }
                  },
                  required: ["text", "action", "requiredPose", "keycode"]
                },
                optionB: {
                  type: Type.OBJECT,
                  properties: {
                    text: { type: Type.STRING, description: "Option B answer text" },
                    action: { type: Type.STRING, description: "Physical movement instruction to select B" },
                    requiredPose: { type: Type.STRING, description: "squat | lateral_raise | hammer_curl | push_up | plank | russian_twist" },
                    keycode: { type: Type.STRING, description: "B" }
                  },
                  required: ["text", "action", "requiredPose", "keycode"]
                },
                correctOption: { type: Type.STRING, description: "A or B" },
                explanation: { type: Type.STRING, description: "Humorous, concise, and educational explanation" },
                funFact: { type: Type.STRING, description: "A punchy, fun bonus fact" }
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

import "dotenv/config"; // MUST BE AT THE TOP
import express from "express";
import cors from "cors";
import fs from "fs";
import http from "http";

import { dispatch, FOCUS_REFEREE_SYSTEM_PROMPT } from "./ai.js";
import {
  sendQuestion,
  sendStopListening,
  setupAnswerWebSocket,
} from "./socket.js";
import {
  ARDUINO_COMMANDS,
  onArduinoLine,
  openArduino,
  sendToArduino,
} from "./arduino.js";
import { generateQuestion } from "./question.js";

const app = express();
const port = 3321;

app.use(cors());
app.use(express.json());

const CHOICES_FILE = "./user_choices.json";
const QUESTIONS_FILE = "./questions.json";
const HEALTH_FILE = "./character.json";
const DEFAULT_HEALTH = { health: 100, maxHealth: 100 };

const SCREENPIPE_BASE_URL =
  process.env.SCREENPIPE_BASE_URL || "http://localhost:3030";
const SCREENPIPE_API_KEY = process.env.SCREENPIPE_LOCAL_API_KEY;
const ACTIVITY_WINDOW = process.env.ACTIVITY_WINDOW || "10m";
const FISH_API_KEY = process.env.FISH_API_KEY;

let pendingQuestion = null;
let activeQuestion = null;
let ignoreButtonPressUntil = 0;

async function readJson(filePath, fallback) {
  try {
    const raw = await fs.promises.readFile(filePath, "utf-8");
    return JSON.parse(raw);
  } catch (err) {
    if (err.code !== "ENOENT") {
      throw err;
    }
    return fallback;
  }
}

async function writeJson(filePath, data) {
  await fs.promises.writeFile(filePath, JSON.stringify(data, null, 2), "utf-8");
}

async function getHealth() {
  const state = await readJson(HEALTH_FILE, DEFAULT_HEALTH);
  return {
    health:
      typeof state.health === "number" ? state.health : DEFAULT_HEALTH.health,
    maxHealth:
      typeof state.maxHealth === "number"
        ? state.maxHealth
        : DEFAULT_HEALTH.maxHealth,
  };
}

export async function appendQuestion(
  newQuestion,
  filePath = "question_to_ask.json",
) {
  try {
    let questions = [];

    // 1. Try to read the existing file
    try {
      const data = await fs.promises.readFile(filePath, "utf8");

      // Parse the JSON data if the file is not empty
      if (data.trim()) {
        questions = JSON.parse(data);
      }
    } catch (readError) {
      // If the file doesn't exist yet, we just catch the error
      // and continue with our empty `questions` array
      if (readError.code !== "ENOENT") {
        throw readError;
      }
    }

    // Ensure the parsed data is an array (just in case the JSON was an object)
    if (!Array.isArray(questions)) {
      questions = [questions];
    }

    // 2. Append the new entry
    questions.push(newQuestion);

    // 3. Write the updated array back to the file with nice formatting (2 spaces)
    await fs.promises.writeFile(
      filePath,
      JSON.stringify(questions, null, 2),
      "utf8",
    );

    console.log("Successfully appended to", filePath);
  } catch (error) {
    console.error("Error appending question to file:", error);
  }
}

async function applyDamage(damage) {
  const current = await getHealth();
  const next = {
    health: Math.max(0, Math.min(current.maxHealth, current.health - damage)),
    maxHealth: current.maxHealth,
  };
  await writeJson(HEALTH_FILE, next);
  return next;
}

async function applyHeal(heal) {
  const current = await getHealth();
  const next = {
    health: Math.max(0, Math.min(current.maxHealth, current.health + heal)),
    maxHealth: current.maxHealth,
  };
  await writeJson(HEALTH_FILE, next);
  return next;
}

function parseHealthAmount(value, max = 20) {
  const amount = Number(value);

  if (!Number.isFinite(amount)) {
    return 0;
  }

  return Math.max(0, Math.min(max, Math.round(amount)));
}

// The pet has its own health counter, so a failed signal must never turn a
// working request into an error. Log it and carry on.
async function signalPet(command, amount = null, send = sendToArduino) {
  try {
    return await send(command, amount);
  } catch (err) {
    console.error(`Failed to signal the Arduino (${command}):`, err.message);
    return { sent: false, reason: "error" };
  }
}

// The board boots at full health every time the port opens, but character.json
// survives restarts. Push the stored health onto the freshly reset pet so the
// two counters agree. Runs as the Arduino connect hook, which supplies the
// sender it must use.
async function syncPetHealth(send) {
  const { health, maxHealth } = await getHealth();

  await signalPet("RESET", null, send);

  const missing = maxHealth - health;

  if (missing > 0) {
    await signalPet("DAMAGE", missing, send);
  }

  if (health < 50) {
    await preparePendingQuestion();
  }
}

async function preparePendingQuestion() {
  if (pendingQuestion) {
    return pendingQuestion;
  }

  const contentData = await readJson("questions.json", []);
  const content =
    Array.isArray(contentData) && contentData.length > 0 ? contentData : [];

  const question = await generateQuestion(content);
  const response = JSON.parse(question);

  pendingQuestion = response.question;

  await appendQuestion({
    timestamp: new Date().toISOString(),
    question: pendingQuestion,
  });

  console.log("Question prepared for next hardware button press.");

  return pendingQuestion;
}

function sendPendingQuestion(reason) {
  if (!pendingQuestion) {
    return false;
  }

  const question = pendingQuestion;
  pendingQuestion = null;
  activeQuestion = question;
  sendQuestion(question);
  console.log(`Sent pending question after ${reason}.`);
  return true;
}

function handleArduinoLine(message) {
  if (message === "BUTTON_PUSHED") {
    if (Date.now() < ignoreButtonPressUntil) {
      console.log("Ignored duplicate button line from the same question press.");
      return;
    }

    if (sendPendingQuestion("hardware button press")) {
      return;
    }

    if (activeQuestion) {
      sendStopListening();
    }
    return;
  }

  if (message === "DESPERATE_ACKNOWLEDGED") {
    console.log("Hardware desperate alarm acknowledged.");
    if (sendPendingQuestion("desperate acknowledgement")) {
      ignoreButtonPressUntil = Date.now() + 1000;
    }
  }
}

async function handleAnswerResponse({ question, answer }) {
  const userChoices = await readJson(CHOICES_FILE, {});

  const prompt = `
You are a fair HabitRabbit reflection judge. Your job is to decide whether the
user made a real attempt to answer the question in a useful and intentional way.

Context:
- User intention: ${userChoices.intention ?? "Not provided"}
- Question: ${question}
- User answer: ${answer}

Return exactly one JSON object:
{
  "action": "HEAL",
  "amount": 20,
  "reason": "short reason"
}

Rules:
- Use "HEAL" when the answer is relevant to the question, even if it is short, imperfect, informal, or partially transcribed.
- Use "HEAL" when the user shows any honest reflection, explains what happened, names a challenge, or gives a next step.
- Use "DAMAGE" when the answer is clearly unrelated, evasive, joking, empty, nonsense, or only expresses frustration like wanting to leave.
- If the answer is partly understandable and partly messy, prefer a small HEAL instead of DAMAGE.
- If the answer could apply to almost any question and gives no useful detail, use DAMAGE.
- For HEAL, "amount" must be an integer from 10 to 40.
- For DAMAGE, "amount" must be an integer from 0 to 20.
- For clear good answers, use HEAL 25-40.
- For weak but partially related answers, use HEAL 10-20.
- For unrelated, dismissive, or nonsense answers, use DAMAGE 10-20.
- Do not include Markdown, code fences, or extra text.
`.trim();

  console.log("Judging answer with AI...");

  try {
    const textOutput = await Promise.race([
      dispatch(prompt),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("AI answer judge timed out.")), 30000),
      ),
    ]);
    console.log("AI answer judge response:", textOutput);

    const result = JSON.parse(textOutput);
    const action = String(result.action ?? "").trim().toUpperCase();

    if (action !== "HEAL" && action !== "DAMAGE") {
      throw new Error(`Invalid answer action from AI: ${result.action}`);
    }

    const amount =
      action === "HEAL"
        ? Math.max(10, parseHealthAmount(result.amount, 40))
        : parseHealthAmount(result.amount, 20);

    let health = await getHealth();

    if (amount > 0) {
      if (action === "HEAL") {
        health = await applyHeal(amount);
        await signalPet("HEAL", amount);
      } else {
        health = await applyDamage(amount);
        await signalPet("DAMAGE", amount);
      }
    }

    if (health.health < 50) {
      await preparePendingQuestion();
      await signalPet("DESPERATE");
    }

    return {
      action,
      amount,
      reason: result.reason ?? "",
      health: health.health,
      maxHealth: health.maxHealth,
    };
  } finally {
    if (activeQuestion && question === activeQuestion) {
      activeQuestion = null;
    }
  }
}

async function fetchRecentActivity() {
  const url = `${SCREENPIPE_BASE_URL}/activity-summary?start_time=${encodeURIComponent(`${ACTIVITY_WINDOW} ago`)}&end_time=now`;
  const headers = SCREENPIPE_API_KEY
    ? { Authorization: `Bearer ${SCREENPIPE_API_KEY}` }
    : {};

  const response = await fetch(url, { headers });
  if (!response.ok) {
    throw new Error(`Screenpipe request failed with status ${response.status}`);
  }
  return response.json();
}

app.get("/", (req, res) => {
  res.send("Hello World! Your Express server is running.");
});

app.get("/api/status", (req, res) => {
  res.json({ status: "online", tool: "Express" });
});

app.get("/api/character", async (req, res) => {
  const state = await getHealth();
  res.json(state);
});

app.post("/api/character/reset", async (req, res) => {
  const state = {
    health: DEFAULT_HEALTH.maxHealth,
    maxHealth: DEFAULT_HEALTH.maxHealth,
  };
  await writeJson(HEALTH_FILE, state);
  await signalPet("RESET");
  res.json(state);
});

// Drive the pet by hand. Body: { command, amount } where command is one of
// DAMAGE, HEAL, RESET, BOTHER, DEATH, DESPERATE and amount is an optional
// integer that only DAMAGE and HEAL use.
app.post("/api/arduino", async (req, res) => {
  const { command, amount } = req.body ?? {};

  const verb = String(command ?? "")
    .trim()
    .toUpperCase();

  if (!ARDUINO_COMMANDS.includes(verb)) {
    return res.status(400).json({
      success: false,
      error: `Unknown command. Use one of ${ARDUINO_COMMANDS.join(", ")}.`,
    });
  }

  if (
    amount !== null &&
    amount !== undefined &&
    !Number.isFinite(Number(amount))
  ) {
    return res
      .status(400)
      .json({ success: false, error: "Amount must be a number." });
  }

  const result = await signalPet(
    verb,
    amount === null || amount === undefined ? null : Number(amount),
  );

  res.json({ success: true, ...result });
});

// Pulls the player's recent Screenpipe activity, asks OpenAI (via dispatch) to
// judge it against their stated intention, and applies the resulting damage
// to their character.
app.post("/api/screenpipe", async (req, res) => {
  const userChoices = await readJson(CHOICES_FILE, null);

  if (!userChoices) {
    return res
      .status(400)
      .json({ success: false, error: "No intention set yet." });
  }

  if (pendingQuestion || activeQuestion) {
    return res.status(200).json({
      success: true,
      skipped: true,
      reason: "Waiting for the current hardware question flow to finish.",
    });
  }

  let activitySummary;

  try {
    activitySummary = req.body;
    console.log(activitySummary);
  } catch (err) {
    console.error("Failed to fetch Screenpipe activity:", err);
    return res.status(502).json({
      success: false,
      error: "Could not reach Screenpipe. Is it running?",
    });
  }

  try {
    const prompt =
      FOCUS_REFEREE_SYSTEM_PROMPT +
      JSON.stringify({
        intention: userChoices.intention,
        relevantUrls: userChoices.urls ?? [],
        activitySummary,
      });

    const textOutput = await dispatch(prompt);
    let codexData;

    try {
      codexData = JSON.parse(textOutput);
    } catch (parseErr) {
      console.error("Failed to parse OpenAI response as JSON:", parseErr);
      return res
        .status(500)
        .json({ success: false, error: "Invalid JSON from AI" });
    }

    // Extract the variables now that it is parsed, clamping damage to a sane range
    const rawDamage = Number(codexData.damage);
    const damage = Number.isFinite(rawDamage)
      ? Math.max(0, Math.min(100, Math.round(rawDamage)))
      : 0;
    const health = await applyDamage(damage);
    console.log(health);

    if (damage > 0 && health.health < 50) {
      await preparePendingQuestion();
    }

    // Mirror the same hit onto the physical pet.
    if (damage > 0) {
      await signalPet("DAMAGE", damage);
    }

    // Note: Added damage here so you don't lose that data, remove if unneeded
    const newEntry = {
      at: new Date().toISOString(),
      intention: userChoices.intention,
      damage,
    };
    const existing = await readJson(QUESTIONS_FILE, []);
    const questionsArray = Array.isArray(existing) ? existing : [];
    questionsArray.push(newEntry);
    await writeJson(QUESTIONS_FILE, questionsArray);
    console.log("Successfully appended to questions.json");

    return res.status(200).json({
      success: true,
      damage,
      health: health.health,
      maxHealth: health.maxHealth,
    });
  } catch (error) {
    console.error("Error communicating with OpenAI:", error);
    res.status(500).json({
      success: false,
      error: "Server failed to communicate with OpenAI.",
    });
  }
});

// Proxies Fish Audio TTS so the browser doesn't have to hit their API
// directly (it doesn't send Access-Control-Allow-Origin, and the key
// shouldn't be shipped to the client bundle anyway).
app.post("/api/tts", async (req, res) => {
  const { text } = req.body ?? {};

  if (typeof text !== "string" || !text.trim()) {
    return res.status(400).json({ success: false, error: "No text provided" });
  }

  try {
    const response = await fetch("https://api.fish.audio/v1/tts", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${FISH_API_KEY}`,
        "Content-Type": "application/json",
        model: "s2.1-pro-free",
      },
      body: JSON.stringify({
        text,
        reference_id: "536d3a5e000945adb7038665781a4aca",
        format: "mp3",
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      return res
        .status(response.status)
        .json({ success: false, error: errText });
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    res.set("Content-Type", "audio/mpeg");
    res.send(buffer);
  } catch (err) {
    console.error("TTS proxy failed:", err);
    res
      .status(500)
      .json({ success: false, error: "Server failed to reach Fish Audio." });
  }
});

app.post("/api/user-choices", async (req, res) => {
  const { intention, urls } = req.body ?? {};

  if (!intention && !urls) {
    return res.status(400).send("No intention or urls found in request");
  }

  try {
    await writeJson(CHOICES_FILE, {
      intention: intention ?? "",
      urls: urls ?? [],
    });
    res.status(200).send("User choices saved successfully!");
  } catch (err) {
    console.error("Failed to save user choices", err);
    res.status(500).send("Server failed to write file.");
  }
});

const server = http.createServer(app);
setupAnswerWebSocket(server, { onAnswer: handleAnswerResponse });
onArduinoLine(handleArduinoLine);

server.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
  openArduino({ onConnect: syncPetHealth });
});

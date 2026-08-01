import "dotenv/config"; // MUST BE AT THE TOP
import express from "express";
import cors from "cors";
import fs from "fs";
import http from "http";

import { dispatch } from "./ai.js";
import { setupAnswerWebSocket } from "./socket.js";
import { ARDUINO_COMMANDS, openArduino, sendToArduino } from "./arduino.js";

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

async function applyDamage(damage) {
  const current = await getHealth();
  const next = {
    health: Math.max(0, Math.min(current.maxHealth, current.health - damage)),
    maxHealth: current.maxHealth,
  };
  await writeJson(HEALTH_FILE, next);
  return next;
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
// DAMAGE, HEAL, RESET, BOTHER and amount is an optional integer that only
// DAMAGE and HEAL use.
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

  try {
    const result = await sendToArduino(verb, amount ?? null);
    return res.status(200).json({ success: true, ...result });
  } catch (err) {
    console.error("Failed to signal the Arduino:", err);
    return res
      .status(500)
      .json({ success: false, error: "Server failed to reach the Arduino." });
  }
});

// Pulls the player's recent Screenpipe activity, asks OpenAI (via dispatch) to
// judge it against their stated intention, and applies the resulting damage
// to their character.
app.post("/api/screenpipe", async (req, res) => {
  const userChoices = await readJson(CHOICES_FILE, null);

  if (!userChoices || !userChoices.intention) {
    return res
      .status(400)
      .json({ success: false, error: "No intention set yet." });
  }

  let activitySummary;
  try {
    activitySummary = await fetchRecentActivity();
  } catch (err) {
    console.error("Failed to fetch Screenpipe activity:", err);
    return res.status(502).json({
      success: false,
      error: "Could not reach Screenpipe. Is it running?",
    });
  }

  try {
    const prompt =
      "You are the referee of a focus game. The player stated an intention and, optionally, " +
      "a list of URLs relevant to that intention. You are given a summary of their recent " +
      "screen and audio activity from Screenpipe. Decide how much the player strayed from " +
      "their intention during this window. Respond with strict JSON only: " +
      '{"damage": <integer 0-100>, "reasoning": "<one short sentence>"}. ' +
      "0 damage means they stayed on track or there is not enough evidence of straying. " +
      "10 damage means they were completely off-task for the whole window.\n\n" +
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
    const reasoning =
      typeof codexData.reasoning === "string" ? codexData.reasoning : "";

    const health = await applyDamage(damage);

    // Mirror the same hit onto the physical pet.
    if (damage > 0) {
      await signalPet("DAMAGE", damage);
    }

    // Note: Added damage here so you don't lose that data, remove if unneeded
    const newEntry = {
      at: new Date().toISOString(),
      intention: userChoices.intention,
      damage,
      reasoning,
    };
    const existing = await readJson(QUESTIONS_FILE, []);
    const questionsArray = Array.isArray(existing) ? existing : [];
    questionsArray.push(newEntry);
    await writeJson(QUESTIONS_FILE, questionsArray);
    console.log("Successfully appended to questions.json");

    return res.status(200).json({
      success: true,
      damage,
      reasoning,
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
setupAnswerWebSocket(server);

server.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
  openArduino({ onConnect: syncPetHealth });
});

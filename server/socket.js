import { WebSocketServer } from "ws";
import { dispatch } from "./ai.js";
import { applyDamage, applyHeal, getHealth } from "./health.js";
import { ARDUINO_COMMANDS, sendToArduino } from "./arduino.js";

function send(ws, type, payload = {}) {
  if (ws?.readyState === ws?.OPEN) {
    try { ws.send(JSON.stringify({ type, ...payload })); }
    catch (err) { console.error("send failed:", err); }
  }
}

const clients = new Set();

export function sendQuestion(question) {
  for (const ws of clients) send(ws, "question", { question });
}

export function sendStartListening() {
  for (const ws of clients) send(ws, "start-listening");
}

export function sendStopListening() {
  for (const ws of clients) send(ws, "stop-listening");
}

export function broadcastHealth(state) {
  for (const ws of clients) send(ws, "health", state);
}

// A failed signal must never turn a working websocket request into an
// error - the pet's own health counter is best-effort, mirroring signalPet
// in server.js.
async function signalPet(command, amount = null) {
  try {
    return await sendToArduino(command, amount);
  } catch (err) {
    console.error(`Failed to signal the Arduino (${command}):`, err.message);
    return { sent: false, reason: "error" };
  }
}

function parseAmount(raw) {
  const numeric = Number(raw);
  return Number.isFinite(numeric) ? numeric : null;
}

async function handleDamage(ws, msg) {
  const amount = parseAmount(msg.amount);
  if (amount === null) {
    return send(ws, "error", { error: "Amount must be a number." });
  }

  const health = await applyDamage(amount);
  await signalPet("DAMAGE", amount);
  broadcastHealth(health);
}

async function handleHeal(ws, msg) {
  const amount = parseAmount(msg.amount);
  if (amount === null) {
    return send(ws, "error", { error: "Amount must be a number." });
  }

  const health = await applyHeal(amount);
  await signalPet("HEAL", amount);
  broadcastHealth(health);
}

async function handleArduino(ws, msg) {
  const verb = String(msg.command ?? "").trim().toUpperCase();

  if (!ARDUINO_COMMANDS.includes(verb)) {
    return send(ws, "error", {
      error: `Unknown command. Use one of ${ARDUINO_COMMANDS.join(", ")}.`,
    });
  }

  const amount = msg.amount === null || msg.amount === undefined
    ? null
    : parseAmount(msg.amount);

  if (msg.amount !== null && msg.amount !== undefined && amount === null) {
    return send(ws, "error", { error: "Amount must be a number." });
  }

  const result = await signalPet(verb, amount);
  send(ws, "arduino-result", result);
}

async function handleAnswerResponse(ws, msg) {
  const { question, answer } = msg;

  if (typeof question !== "string" || !question.trim()) {
    return send(ws, "error", { error: "No question found in request" });
  }
  if (typeof answer !== "string" || !answer.trim()) {
    return send(ws, "error", { error: "No answer found in request" });
  }

  console.log("Received question:", question);
  console.log("Received answer:", answer);

  try {
    const outputData = await dispatch(
      `Question: ${question}\nAnswer: ${answer}\n\nIgnore the above for now and return {"score": 0}`,
    );
    send(ws, "result", { success: true, data: outputData });
  } catch (error) {
    console.error("Error communicating with OpenAI:", error);
    send(ws, "result", {
      success: false,
      error: error.isJsonParseError ? error.message : "Server failed to communicate with OpenAI.",
    });
  }
}

const MESSAGE_HANDLERS = {
  "answer-response": handleAnswerResponse,
  damage: handleDamage,
  heal: handleHeal,
  arduino: handleArduino,
};

export function setupAnswerWebSocket(server) {
  const wss = new WebSocketServer({ server, path: "/ws/device" });

  wss.on("connection", async (ws) => {
    console.log("Client connected to /ws/device");
    clients.add(ws);
    send(ws, "health", await getHealth());

    ws.on("message", async (raw) => {
      let msg;
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        return send(ws, "error", { error: "Invalid message" });
      }

      const handler = MESSAGE_HANDLERS[msg.type];

      if (!handler) {
        return send(ws, "error", { error: `Unexpected message type: ${msg.type}` });
      }

      await handler(ws, msg);
    });

    ws.on("close", () => {
      console.log("Client disconnected from /ws/device")
      clients.delete(ws);
    });
  });

  return wss;
}

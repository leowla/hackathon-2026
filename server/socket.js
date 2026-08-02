import { WebSocketServer } from "ws";
import { dispatch } from "./ai.js";

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

export function setupAnswerWebSocket(server) {
  const wss = new WebSocketServer({ server, path: "/ws/device" });

  wss.on("connection", (ws) => {
    console.log("Client connected to /ws/device");
    clients.add(ws);

    ws.on("message", async (raw) => {
      let msg;
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        return send(ws, "error", { error: "Invalid message" });
      }

      if (msg.type !== "answer-response") {
        return send(ws, "error", { error: `Unexpected message type: ${msg.type}` });
      }

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
    });

    ws.on("close", () => {
      console.log("Client disconnected from /ws/device")
      clients.delete(ws);
    });
  });

  return wss;
}

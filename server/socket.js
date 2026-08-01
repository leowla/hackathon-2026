import { WebSocketServer } from "ws";
import { dispatch } from "./ai.js";

function send(ws, type, payload = {}) {
  ws.send(JSON.stringify({ type, ...payload }));
}

let client;

export function sendQuestion(question) {
  send(client, "question", { question });
}

export function sendButtonPress(button) {
  send(client, "button-press", { button });
}

export function setupAnswerWebSocket(server) {
  const wss = new WebSocketServer({ server, path: "/ws/device" });

  wss.on("connection", (ws) => {
    console.log("Client connected to /ws/device");
    client = ws;

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

    ws.on("close", () => console.log("Client disconnected from /ws/device"));
  });

  return wss;
}

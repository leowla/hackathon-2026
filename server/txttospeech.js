import { writeFile, unlink } from "fs/promises";
import path from "path";
import os from "os";
import player from "play-sound";

const token = process.env.FISH_API_KEY;
const audioPlayer = player({});

export async function txtToSpeech(text) {
  const response = await fetch("https://api.fish.audio/v1/tts", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
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
    throw new Error(`TTS request failed: ${response.status} ${errText}`);
  }
  return response.arrayBuffer();
}

export async function playAudio(buffer) {
  const tmpFile = path.join(os.tmpdir(), `tts-${Date.now()}.mp3`);
  await writeFile(tmpFile, Buffer.from(buffer));

  return new Promise((resolve, reject) => {
    audioPlayer.play(tmpFile, async (err) => {
      await unlink(tmpFile).catch(() => { });
      if (err) return reject(err);
      resolve();
    });
  });
}

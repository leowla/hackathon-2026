import 'dotenv/config'; // MUST BE AT THE TOP
import express from 'express';
import fs from 'fs';
import { dispatch } from './ai.js';
import { txtToSpeech, playAudio } from './txttospeech.js';

import cors from 'cors';
const app = express();

app.use(cors());
const port = 3321;

app.use(express.json());

app.get('/', (req, res) => {
  res.send('Hello World! Your Express server is running.');
});

app.get('/api/status', (req, res) => {
  res.json({ status: 'online', tool: 'Express' });
});

app.post('/api/screenpipe', async (req, res) => {
  // Extract screenPipeResponse from the request body
  const screenPipeResponse = req.body.screenPipeResponse;

  if (!screenPipeResponse) {
    return res.status(400).send("No screenPipeResponse found in request");
  }

  try {
    // 3. Make the API request using the initialized 'openai' client
    const output = await dispatch("hello");
    let codexData;

    // 2. Parse the string response into a usable JavaScript object
    try {
      codexData = JSON.parse(output);
    } catch (parseErr) {
      console.error("Failed to parse OpenAI response as JSON:", parseErr);
      return res.status(500).json({ success: false, error: "Invalid JSON from AI" });
    }

    return res.status(200).json({
      success: true,
      data: codexData // Returning the parsed object instead of the raw string
    });
  } catch (err) {
    console.error(err);
  }
});

app.post('/api/user-choices', (req, res) => {
  const userChoices = req.body.user_choice;

  if (!userChoices) {
    return res.status(400).send("No user_choice found in request");
  }

  const jsonString = JSON.stringify(userChoices, null, 2);

  fs.writeFile("./user_choices.json", jsonString, 'utf-8', (err) => {
    if (err) {
      console.error("There is an err", err);
      return res.status(500).send("Server failed to write file.");
    }
    console.log("no error lol");
    res.status(200).send("User choices saved successfully!");
  });
});

app.post('/api/answer', async (req, res) => {
    // Extract the question we asked and the answer the user gave
    const { question, answer } = req.body;

    if (typeof question !== 'string' || !question.trim()) {
        return res.status(400).json({ success: false, error: "No question found in request" });
    }

    if (typeof answer !== 'string' || !answer.trim()) {
        return res.status(400).json({ success: false, error: "No answer found in request" });
    }

    console.log("Received question:", question);
    console.log("Received answer:", answer);

    try {
        // Temporary promt: we only want to confirm the package arrives and the
        // round trip works. Real grading promt goes here later.
        const codexData = await dispatch(
            `Question: ${question}\nAnswer: ${answer}\n\nIgnore the above for now and return {"score": 0}`
        );
        return res.status(200).json({ success: true, data: codexData });

    } catch (error) {
        console.error("Error communicating with OpenAI:", error);
        return res.status(500).json({
            success: false,
            // Never forward OpenAI's own error text -- it can contain key fragments
            error: error.isJsonParseError ? error.message : "Server failed to communicate with OpenAI."
        });
    }
});

app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});
;

const jimmy = await txtToSpeech("hello kim how are you man");
const play = await playAudio(jimmy);

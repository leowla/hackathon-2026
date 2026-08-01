require('dotenv').config(); // MUST BE AT THE TOP


const express = require('express');
const fs = require('fs');
const OpenAI = require('openai'); // 1. Import OpenAI
const { dispatch } = require('./ai');

// 2. Initialize the OpenAI client. 
// It automatically looks for the process.env.OPENAI_API_KEY environment variable.
const openai = new OpenAI();

const app = express();
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
    const output = await dispatch();
    let codexData;

    // 2. Parse the string response into a usable JavaScript object
    try {
      codexData = JSON.parse(output);
    } catch (parseErr) {
      console.error("Failed to parse OpenAI response as JSON:", parseErr);
      return res.status(500).json({ success: false, error: "Invalid JSON from AI" });
    }

    // 3. Extract the variables now that it is parsed
    const questions = codexData.questions;
    const damage = codexData.damage;

    // Note: Added damage here so you don't lose that data, remove if unneeded
    const newEntry = { questions, damage };
    const filePath = './questions.json';
    let questionsArray = [];

    // 4. Read the existing file using Promises
    try {
      const existingData = await fs.promises.readFile(filePath, 'utf-8');
      questionsArray = JSON.parse(existingData);

      if (!Array.isArray(questionsArray)) {
        questionsArray = [];
      }
    } catch (fileErr) {
      if (fileErr.code !== 'ENOENT') {
        throw fileErr;
      }
      console.log("questions.json does not exist yet. Creating a new one.");
    }

    // 5. Append the new entry and write back to the file
    questionsArray.push(newEntry);

    await fs.promises.writeFile(filePath, JSON.stringify(questionsArray, null, 2), 'utf-8');
    console.log("Successfully appended to questions.json");

    // 6. Send the response back to the client using res.json()
    return res.status(200).json({
      success: true,
      data: codexData // Returning the parsed object instead of the raw string
    });

  } catch (error) {
    console.error("Error communicating with OpenAI:", error);
    res.status(500).send("Server failed to communicate with OpenAI.");
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

app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});
;

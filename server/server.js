require('dotenv').config(); // MUST BE AT THE TOP


const express = require('express');
const fs = require('fs');
const OpenAI = require('openai'); // 1. Import OpenAI
const { dispatch } = require('./ai');

// 2. Initialize the OpenAI client. 
// It automatically looks for the process.env.OPENAI_API_KEY environment variable.
const openai = new OpenAI(); 
const cors = require('cors');
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
        // 3. Make the API request using the initialized 'openai' client
        const response = await openai.chat.completions.create({ // Ensure you use 'openai' if that's what you named your client
            model: "gpt-4o-mini",
            response_format: { type: "json_object" }, // This ensures OpenAI returns clean JSON
            messages: [
                { 
                    role: "system", 
                    content: "You must respond with valid JSON." 
                },
                { 
                    role: "user", 
                    content: `return {damage: 42069}` // temporary promt 
                }
            ],
        });

        const textOutput = response.choices[0].message.content;
        let codexData;

        // 2. Parse the string response into a usable JavaScript object
        try {
            codexData = JSON.parse(textOutput);
        } catch (parseErr) {
            console.error("Failed to parse OpenAI response as JSON:", parseErr);
            return res.status(500).json({ success: false, error: "Invalid JSON from AI" });
        }

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

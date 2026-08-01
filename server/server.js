require('dotenv').config(); // MUST BE AT THE TOP


const express = require('express');
const fs = require('fs');
const OpenAI = require('openai'); // 1. Import OpenAI

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

// Sends a prompt to OpenAI and hands back the reply already parsed as JSON.
// Tags the error with .isJsonParseError if the model returns something that
// isn't valid JSON, so the route can tell that apart from a network failure.
// (Don't use .status for that -- OpenAI's own errors already set it.)
async function askOpenAIForJson(systemPrompt, userPrompt) {
    const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        response_format: { type: "json_object" }, // This ensures OpenAI returns clean JSON
        messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt }
        ],
    });

    const textOutput = response.choices[0].message.content;

    try {
        return JSON.parse(textOutput);
    } catch (parseErr) {
        console.error("Failed to parse OpenAI response as JSON:", textOutput);
        const err = new Error("Invalid JSON from AI");
        err.isJsonParseError = true;
        throw err;
    }
}

// Appends one entry to a JSON file holding an array, creating the file if it
// isn't there yet.
async function appendToJsonFile(filePath, entry) {
    let entries = [];

    try {
        const existingData = await fs.promises.readFile(filePath, 'utf-8');
        entries = JSON.parse(existingData);

        if (!Array.isArray(entries)) {
            entries = [];
        }
    } catch (fileErr) {
        if (fileErr.code !== 'ENOENT') {
            throw fileErr;
        }
        console.log(`${filePath} does not exist yet. Creating a new one.`);
    }

    entries.push(entry);
    await fs.promises.writeFile(filePath, JSON.stringify(entries, null, 2), 'utf-8');
    console.log(`Successfully appended to ${filePath}`);
}

app.post('/api/screenpipe', async (req, res) => {
    // Extract screenPipeResponse from the request body
    const screenPipeResponse = req.body.screenPipeResponse;

    if (!screenPipeResponse) {
        return res.status(400).send("No screenPipeResponse found in request");
    }

    try {
        const codexData = await askOpenAIForJson(
            "You must respond with valid JSON.",
            `return {damage: 42069}` // temporary promt
        );

        // Note: Added damage here so you don't lose that data, remove if unneeded
        const { questions, damage } = codexData;
        await appendToJsonFile('./questions.json', { questions, damage });

        // Send the response back to the client using res.json()
        return res.status(200).json({
            success: true,
            data: codexData // Returning the parsed object instead of the raw string
        });

    } catch (error) {
        console.error("Error communicating with OpenAI:", error);
        return res.status(500).json({
            success: false,
            // Never forward OpenAI's own error text -- it can contain key fragments
            error: error.isJsonParseError ? error.message : "Server failed to communicate with OpenAI."
        });
    }
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
        const codexData = await askOpenAIForJson(
            "You must respond with valid JSON.",
            `Question: ${question}\nAnswer: ${answer}\n\nIgnore the above for now and return {"score": 0}`
        );

        await appendToJsonFile('./answers.json', { question, answer, ...codexData });

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
import OpenAI from 'openai';

// Initialize the OpenAI client. It automatically looks for the
// process.env.OPENAI_API_KEY environment variable.
const openai = new OpenAI();

export async function dispatch(prompt) {
  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: "You must respond with valid JSON."
      },
      {
        role: "user",
        content: prompt
      }
    ],
  });

  return response.choices[0].message.content;
}

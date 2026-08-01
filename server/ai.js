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
}

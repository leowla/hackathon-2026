import { dispatch } from "./ai";

export async function generateQuestion(history) {
  const response = await dispatch(history.join("\n") + "\ngenerate a reflective question based on the content of this activity");
  const output = response.choices[0].message.content;
  return output;
}

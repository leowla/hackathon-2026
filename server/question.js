import { dispatch } from "./ai.js";

export async function generateQuestion(history) {
  return dispatch(history.join("\n") + "\ngenerate a reflective question based on the content of this activity");
}

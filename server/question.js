import { dispatch } from "./ai.js";

export async function generateQuestion(history) {
  return await dispatch(
    history.join("\n") +
      "\nYou have to return in the json a 'question': '<generate one short question based on their recent activity if they are doing something technical like coding otherwise generate a general reflective question>'",
  );
}

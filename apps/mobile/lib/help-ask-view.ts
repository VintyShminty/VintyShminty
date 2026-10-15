import { HELP_QUESTION_MAX, HELP_QUESTION_MIN, type HelpAnswer } from "@vinty/shared";

/** The question as it is sent: trimmed and cut to the length the server accepts. Null when it is too short to ask. */
export function cleanQuestion(raw: string): string | null {
  const q = raw.trim().slice(0, HELP_QUESTION_MAX).trim();
  return q.length >= HELP_QUESTION_MIN ? q : null;
}

/** What the page shows under the field: nothing yet, waiting, an answer, or the "not in our help pages" line. */
export type HelpAskView = "idle" | "thinking" | "answer" | "noAnswer";

export function helpAskView(state: {
  asked: boolean;
  pending: boolean;
  failed: boolean;
  data?: HelpAnswer;
}): HelpAskView {
  if (!state.asked) return "idle";
  if (state.pending) return "thinking";
  if (state.failed || !state.data) return "noAnswer";
  return state.data.answered && state.data.answer ? "answer" : "noAnswer";
}

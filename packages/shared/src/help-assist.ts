import { z } from "zod";
import { localeSchema } from "./common.js";
import { HELP_ARTICLE_IDS } from "./help-topics.js";

/**
 * Help answers (D-043): a question in the person's own words, answered by Claude Haiku from our own help articles only.
 * The AI cannot see anyone's account, orders or messages. When the articles do not cover the question it says so and
 * the page offers "Write to us". Every answer is labelled as written by AI.
 */

export const HELP_QUESTION_MIN = 3;
export const HELP_QUESTION_MAX = 300;
export const HELP_ANSWER_MAX = 700;
/** How many articles an answer points to. */
export const HELP_ANSWER_ARTICLES_MAX = 2;

/** POST /v1/help/ask */
export const helpAskRequestSchema = z.object({
  question: z.string().trim().min(HELP_QUESTION_MIN).max(HELP_QUESTION_MAX),
  language: localeSchema,
});
export type HelpAskRequest = z.infer<typeof helpAskRequestSchema>;

/**
 * `answered` is false when the help articles do not cover the question, or the AI is off, slow or over its limit: the
 * page then shows its "not in our help pages" line and the Write to us button. `articleIds` are real help article ids.
 */
export const helpAnswerSchema = z.object({
  answered: z.boolean(),
  answer: z.string().max(HELP_ANSWER_MAX).nullable(),
  articleIds: z.array(z.string().refine((id) => HELP_ARTICLE_IDS.includes(id))).max(HELP_ANSWER_ARTICLES_MAX),
});
export type HelpAnswer = z.infer<typeof helpAnswerSchema>;

export const EMPTY_HELP_ANSWER: HelpAnswer = { answered: false, answer: null, articleIds: [] };

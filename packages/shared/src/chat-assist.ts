import { z } from "zod";
import { idSchema, localeSchema } from "./common.js";

/**
 * Chat helpers (D-041). Quick replies are suggestions above the typing box: a tap puts the words in the box, the person
 * edits and sends them. Nothing is ever sent in someone's name. Warnings live on the message itself (`warning`).
 */

/** How many quick replies are offered, and how long each may be. */
export const QUICK_REPLIES_MAX = 3;
export const QUICK_REPLY_MAX_CHARS = 80;

/** POST /v1/conversations/:id/quick-replies */
export const quickRepliesRequestSchema = z.object({ language: localeSchema });

/**
 * Suggestions for answering the newest message. `forMessageId` is the message they answer, so the app can drop them
 * once a newer message arrives. Empty when the AI is off, unsure, or the newest message is not from the other person.
 */
export const quickRepliesSchema = z.object({
  forMessageId: idSchema.nullable(),
  replies: z.array(z.string().min(1).max(QUICK_REPLY_MAX_CHARS)).max(QUICK_REPLIES_MAX),
});
export type QuickReplies = z.infer<typeof quickRepliesSchema>;

export const EMPTY_QUICK_REPLIES: QuickReplies = { forMessageId: null, replies: [] };

import type { Message } from "@vinty/shared";

// Pure rules for the chat helpers (D-039): when the quick replies are offered, how a tapped reply lands in the box
// and who sees a warning. Kept free of React so they are easy to test.

type Chat = Pick<Message, "id" | "senderId" | "kind" | "body" | "createdAt">;

/** The newest message of the chat, whatever the order of the list. */
export function newestMessage<T extends Pick<Message, "createdAt">>(messages: readonly T[]): T | undefined {
  let newest: T | undefined;
  for (const m of messages) if (!newest || m.createdAt > newest.createdAt) newest = m;
  return newest;
}

/**
 * The message quick replies would answer: the newest one, only when it is a text message from the other person.
 * Null when the chat is empty, the newest is mine, a photo, an offer or a system line, or a message is still sending.
 */
export function quickReplyTarget(
  messages: readonly Chat[],
  me: string | undefined,
  hasPending = false,
): Chat | null {
  if (!me || hasPending) return null;
  const newest = newestMessage(messages);
  if (newest?.kind !== "text" || !newest.body?.trim()) return null;
  if (!newest.senderId || newest.senderId === me) return null;
  return newest;
}

/** Warnings show only to the person who received the message, never to the one who wrote it. */
export function shouldShowWarning(message: Pick<Message, "senderId" | "warning">, me: string | undefined) {
  return Boolean(message.warning) && Boolean(me) && message.senderId !== me && message.senderId !== null;
}

/**
 * The replies to show above the box. Hidden when they answer an older message, when the person has typed anything
 * (dismissedFor holds the message they were hidden for), when the box is not empty, or when there are none.
 */
export function visibleQuickReplies(opts: {
  forMessageId: string | null | undefined;
  replies: readonly string[] | undefined;
  newestId: string | undefined;
  dismissedFor: string | null;
  composerText: string;
}): string[] {
  const { forMessageId, replies, newestId, dismissedFor, composerText } = opts;
  if (!replies?.length || !forMessageId || forMessageId !== newestId) return [];
  if (dismissedFor === forMessageId || composerText !== "") return [];
  return [...replies];
}

/** A tapped reply goes into the box: replaces it when empty, otherwise follows what is there after a space. */
export function putReplyInBox(current: string, reply: string): string {
  if (current.trim() === "") return reply;
  return `${current.replace(/\s+$/, "")} ${reply}`;
}

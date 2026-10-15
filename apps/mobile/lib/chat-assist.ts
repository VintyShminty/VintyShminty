import type { Message } from "@vinty/shared";

// Pure rule for the chat warnings (D-041): who sees a warning. Kept free of React so it is easy to test.

/** Warnings show only to the person who received the message, never to the one who wrote it. */
export function shouldShowWarning(message: Pick<Message, "senderId" | "warning">, me: string | undefined) {
  return Boolean(message.warning) && Boolean(me) && message.senderId !== me && message.senderId !== null;
}

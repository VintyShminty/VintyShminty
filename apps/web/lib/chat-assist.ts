import type { ChatWarningKind, Message } from "@vinty/shared";

/** The warning line (D-041) is for the person who received the message, never for the one who wrote it. */
export function warningFor(
  message: Pick<Message, "senderId" | "warning" | "kind">,
  me?: string,
): ChatWarningKind | null {
  if (!me || message.kind === "system" || message.senderId === me) return null;
  return message.warning ?? null;
}

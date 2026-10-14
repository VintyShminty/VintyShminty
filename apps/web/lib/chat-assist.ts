import type { ChatWarningKind, Message } from "@vinty/shared";

/** The warning line (D-039) is for the person who received the message, never for the one who wrote it. */
export function warningFor(
  message: Pick<Message, "senderId" | "warning" | "kind">,
  me?: string,
): ChatWarningKind | null {
  if (!me || message.kind === "system" || message.senderId === me) return null;
  return message.warning ?? null;
}

/**
 * Should the chat ask for quick replies (D-039)? Only when the helper is on, the newest message is a text from the
 * other person, nothing of ours is still on its way and the chat is not blocked.
 */
export function quickReplyTarget({
  enabled,
  newest,
  me,
  hasPending,
  blocked,
}: {
  enabled: boolean;
  newest: Pick<Message, "id" | "kind" | "senderId"> | undefined;
  me?: string;
  hasPending: boolean;
  blocked: boolean;
}): string | null {
  if (!enabled || !me || !newest || hasPending || blocked) return null;
  if (newest.kind !== "text" || newest.senderId === me) return null;
  return newest.id;
}

/** The replies to show: only those written for the newest message, and only while the box is empty. */
export function visibleQuickReplies(
  data: { forMessageId: string | null; replies: string[] } | undefined,
  newestId: string | null,
  draft: string,
): string[] {
  if (!data || !newestId || data.forMessageId !== newestId) return [];
  if (draft.trim() !== "") return [];
  return data.replies;
}

/** A tap on a reply: an empty box takes it, a box with words gets it added after a space. */
export function withReply(draft: string, reply: string): string {
  const trimmed = draft.trimEnd();
  return trimmed === "" ? reply : `${trimmed} ${reply}`;
}

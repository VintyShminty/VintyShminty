import type { Message } from "./messaging.js";

/** What the thread list needs to know about a message that is still being sent (the app and the website add their own fields). */
export type PendingLike = { clientMessageId: string; createdAt: string };

/** Time shown on an inbox row: the clock today, the weekday this week, else the date. */
export function formatRowTime(iso: string, language: string, now: Date = new Date()): string {
  const d = new Date(iso);
  if (sameDay(d, now)) return d.toLocaleTimeString(language, { hour: "numeric", minute: "2-digit" });
  const days = (startOfDay(now).getTime() - startOfDay(d).getTime()) / 86_400_000;
  if (days < 7) return d.toLocaleDateString(language, { weekday: "short" });
  return d.toLocaleDateString(language, { day: "numeric", month: "short" });
}

export const formatClock = (iso: string, language: string) =>
  new Date(iso).toLocaleTimeString(language, { hour: "numeric", minute: "2-digit" });

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
export const sameDay = (a: Date, b: Date) => startOfDay(a).getTime() === startOfDay(b).getTime();

/** "Today", "Yesterday" or "Tue, 7 Oct" for the day dividers in a chat. */
export function dayLabel(
  iso: string,
  language: string,
  labels: { today: string; yesterday: string },
  now = new Date(),
) {
  const d = new Date(iso);
  if (sameDay(d, now)) return labels.today;
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (sameDay(d, yesterday)) return labels.yesterday;
  return d.toLocaleDateString(language, {
    weekday: "short",
    day: "numeric",
    month: "short",
    ...(d.getFullYear() === now.getFullYear() ? {} : { year: "numeric" }),
  });
}

export type ThreadItem<P extends PendingLike = PendingLike> =
  | { type: "typing"; key: string }
  | {
      type: "message";
      key: string;
      message: Message;
      mine: boolean;
      /** Close to the message before it from the same side: less space above. */
      tight: boolean;
      /** Your newest message: it carries the Sent or Seen line. */
      lastMine: boolean;
      /** The newest of a run of close messages from one side: it carries the time. */
      groupEnd: boolean;
    }
  | { type: "pending"; key: string; pending: P; tight: boolean }
  | { type: "day"; key: string; iso: string }
  | { type: "intro"; key: string };

type Input<P extends PendingLike> = {
  /** Newest first, as the server sends them. */
  messages: Message[];
  pending: P[];
  me: string | undefined;
  /** More, older, messages can still be loaded. */
  hasMore: boolean;
  otherTyping: boolean;
};

const TIGHT_MS = 5 * 60 * 1000;

/**
 * The list the chat draws, newest first (the list is inverted, so index 0 is the bottom). Pending messages sit at the
 * bottom, a day divider follows the last message of each day, and the intro card closes the list once everything older
 * is loaded.
 */
export function buildThreadItems<P extends PendingLike>({
  messages,
  pending,
  me,
  hasMore,
  otherTyping,
}: Input<P>): ThreadItem<P>[] {
  const confirmed = new Set(messages.map((m) => m.clientMessageId).filter(Boolean));
  const waiting = pending
    .filter((p) => !confirmed.has(p.clientMessageId))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  type Entry = { at: string; side: string; pending: P } | { at: string; side: string; message: Message };
  const entries: Entry[] = [
    ...waiting.map((p) => ({ at: p.createdAt, side: "me", pending: p })),
    ...messages.map((m) => ({
      at: m.createdAt,
      side: m.senderId === null ? "system" : m.senderId === me ? "me" : "them",
      message: m,
    })),
  ];

  const items: ThreadItem<P>[] = [];
  if (otherTyping) items.push({ type: "typing", key: "typing" });
  let lastMineSeen = false;
  entries.forEach((entry, index) => {
    const older = entries[index + 1];
    const tight =
      Boolean(older) &&
      older?.side === entry.side &&
      entry.side !== "system" &&
      new Date(entry.at).getTime() - new Date(older?.at ?? entry.at).getTime() < TIGHT_MS;
    const newer = entries[index - 1];
    const groupEnd =
      !newer ||
      newer.side !== entry.side ||
      new Date(newer.at).getTime() - new Date(entry.at).getTime() >= TIGHT_MS;
    if ("pending" in entry) {
      items.push({
        type: "pending",
        key: `p-${entry.pending.clientMessageId}`,
        pending: entry.pending,
        tight,
      });
    } else {
      const mine = entry.side === "me";
      const lastMine = mine && !lastMineSeen;
      if (mine) lastMineSeen = true;
      items.push({
        type: "message",
        key: entry.message.id,
        message: entry.message,
        mine,
        tight,
        lastMine,
        groupEnd,
      });
    }
    if (!older) {
      if (!hasMore) items.push({ type: "day", key: `d-${entry.at.slice(0, 10)}-${index}`, iso: entry.at });
    } else if (!sameDay(new Date(entry.at), new Date(older.at))) {
      items.push({ type: "day", key: `d-${entry.at.slice(0, 10)}-${index}`, iso: entry.at });
    }
  });
  if (!hasMore) items.push({ type: "intro", key: "intro" });
  return items;
}

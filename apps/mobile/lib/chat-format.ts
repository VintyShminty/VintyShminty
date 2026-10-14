// The inbox time, day labels and the thread list live in the shared package so the website writes them the same way.
import type { ThreadItem as SharedThreadItem } from "@vinty/shared";
import type { PendingMessage } from "./chat-send";

export { buildThreadItems, dayLabel, formatClock, formatRowTime, sameDay } from "@vinty/shared";
export type ThreadItem = SharedThreadItem<PendingMessage>;

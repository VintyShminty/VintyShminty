import type { Query } from "@tanstack/react-query";

// What is saved on the phone between launches, so Home shows its last feed the moment the app opens.
// Only the Home feed (the For you list) and the reference data. Nothing else is ever written to disk.

/** The storage key of the saved copy. */
export const PERSIST_KEY = "vinty-query-cache";

/** A saved copy older than this is thrown away. */
export const PERSIST_MAX_AGE = 7 * 24 * 60 * 60 * 1000;

/** Saves the successful reference data and the plain For you feed (no category, no trending, no mood chip). */
export function shouldPersistQuery(query: Pick<Query, "queryKey" | "state">): boolean {
  if (query.state.status !== "success") return false;
  const [head, categoryId, trending, mood] = query.queryKey;
  if (head === "reference") return true;
  return head === "feed" && (categoryId ?? null) === null && !trending && (mood ?? "for_you") === "for_you";
}

/**
 * The saved copy only restores for the same app version and the same person.
 * A different person (or a signed out phone) gets a different value, so the old copy is thrown away.
 */
export function persistBuster(appVersion: string, userId: string | undefined): string {
  return `${appVersion}:${userId ?? "signed-out"}`;
}

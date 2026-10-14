"use client";

import { eventBatchResultSchema } from "@vinty/shared";
import { clientApi } from "@/lib/api-client";
import { EventQueue, type NewEvent } from "@/lib/event-queue";

// The website's one queue for the actions only the browser sees (docs/blueprint/api.md, Milestone 7), the same as the
// app's. Switched on by `EventCollector` for a logged in person whose personalised feed is on, and off otherwise.
// Hearts, item opens and searches are not sent from here: the server records them itself from the calls it handles.

export const events = new EventQueue({
  send: (batch) =>
    clientApi("/v1/events", { method: "POST", body: { events: batch }, schema: eventBatchResultSchema }),
  // The page is going away: `keepalive` lets the request finish after it has closed.
  sendOnLeave: (batch) => {
    void fetch("/v1/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ events: batch }),
      credentials: "include",
      keepalive: true,
    }).catch(() => undefined);
  },
});

/** A card half visible for a second, on Home. */
export function trackImpression(seen: { listingId: string; position: number; feedId: string | null }) {
  events.push({
    type: "impression",
    listingId: seen.listingId,
    surface: "home",
    position: seen.position,
    ...(seen.feedId ? { feedId: seen.feedId } : {}),
  });
}

/** Ten seconds on an item, or three photos swiped. */
export function trackDwell(listingId: string, dwellMs: number, photosSwiped: number) {
  events.push({ type: "listing_dwell", listingId, data: { dwellMs, photosSwiped } });
}

/** A Browse tile or category was opened. */
export function trackCategoryVisit(categoryId: string) {
  events.push({ type: "category_visit", categoryId, surface: "browse" } satisfies NewEvent);
}

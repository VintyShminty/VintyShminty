import { eventBatchResultSchema } from "@vinty/shared";
import { api } from "@/lib/api";
import { EventQueue, type NewEvent } from "@/lib/event-queue";

// The app's one queue for the actions only the phone sees (docs/blueprint/api.md, Milestone 7). Switched on in
// `app/(app)/_layout.tsx` for a signed in person whose personalised feed is on, and off otherwise.

export const events = new EventQueue({
  send: (batch) =>
    api("/v1/events", { method: "POST", body: { events: batch }, schema: eventBatchResultSchema }),
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

/** A category panel, a leaf or a Browse tile was opened. */
export function trackCategoryVisit(categoryId: string) {
  events.push({ type: "category_visit", categoryId, surface: "browse" } satisfies NewEvent);
}

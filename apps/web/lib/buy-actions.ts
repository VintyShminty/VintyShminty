import type { ListingDetail } from "@vinty/shared";

/** Whether the Buy / make your price buttons (and on a phone the bar at the bottom) show for this viewer. */
export function hasBuyActions(listing: Pick<ListingDetail, "status" | "viewer">): boolean {
  return (
    !listing.viewer.isOwner && listing.status !== "sold" && (listing.viewer.canBuy || listing.viewer.canOffer)
  );
}

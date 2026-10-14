import type { AdminReviewItem, ReportUrgency, ReviewAction } from "@vinty/shared";

/** The buttons an open item gets. Hide and remove only make sense when the target is a listing that still exists. */
export function reviewActionsFor(item: Pick<AdminReviewItem, "target" | "status">): ReviewAction[] {
  if (item.status !== "open" && item.status !== "reviewing") return [];
  const isListing = item.target?.kind === "listing";
  return isListing ? ["hide_listing", "remove_listing", "dismiss", "handled"] : ["dismiss", "handled"];
}

export type UrgencyTone = "high" | "normal" | "low" | "none";

/** Which pill look an item gets. No urgency means the AI did not sort it. */
export function urgencyTone(urgency: ReportUrgency | null): UrgencyTone {
  return urgency ?? "none";
}

/** The class names of each pill look, all from the shared tokens. */
export const URGENCY_CLASS: Record<UrgencyTone, string> = {
  high: "bg-error-tint text-error",
  normal: "bg-pressed text-text-1",
  low: "bg-surface text-text-3 border border-border",
  none: "border border-dashed border-text-4 text-text-3",
};

/** Only a note that has text is sent. */
export function cleanNote(note: string): string | undefined {
  const trimmed = note.trim();
  return trimmed ? trimmed : undefined;
}

/** The profile page of a person on the website. */
export const sellerHref = (lang: string, id: string) => `/${lang}/seller/${id}`;

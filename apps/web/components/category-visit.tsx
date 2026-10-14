"use client";

import { useEffect } from "react";
import { useViewer } from "@/components/site-context";
import { trackCategoryVisit } from "@/lib/events";

/**
 * Tells the server a Browse tile was opened, like the app does (up to six of its categories), so the Home feed can learn
 * what the person likes. Goes through the shared event queue, so it is batched with the other signals, only for a
 * logged in person whose personalised feed is on, and silent when it fails.
 */
export function CategoryVisit({ categoryIds }: { categoryIds: string[] }) {
  const viewer = useViewer();
  const key = categoryIds.slice(0, 6).join(",");
  const signedIn = Boolean(viewer);
  useEffect(() => {
    if (!signedIn || !key) return;
    for (const categoryId of key.split(",")) trackCategoryVisit(categoryId);
  }, [signedIn, key]);
  return null;
}

"use client";

import { useEffect } from "react";
import { useViewer } from "@/components/site-context";
import { clientApi } from "@/lib/api-client";

/**
 * Tells the server a Browse tile was opened, like the app does (up to six of its categories), so the Home feed can learn
 * what the person likes. Only for a logged in person, once per visit, and silent when it fails.
 */
export function CategoryVisit({ categoryIds }: { categoryIds: string[] }) {
  const viewer = useViewer();
  const key = categoryIds.slice(0, 6).join(",");
  const signedIn = Boolean(viewer);
  useEffect(() => {
    if (!signedIn || !key) return;
    const events = key.split(",").map((categoryId) => ({
      clientEventId: crypto.randomUUID(),
      type: "category_visit" as const,
      categoryId,
      surface: "browse" as const,
    }));
    clientApi("/v1/events", { method: "POST", body: { events } }).catch(() => undefined);
  }, [signedIn, key]);
  return null;
}

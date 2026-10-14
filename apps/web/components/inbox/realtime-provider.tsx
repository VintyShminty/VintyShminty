"use client";

import { useEffect } from "react";
import { useViewer } from "@/components/site-context";
import { getQueryClient } from "@/lib/query-client";
import { startRealtime, stopRealtime } from "@/lib/realtime";

/**
 * Opens the one live connection while someone is logged in and closes it at log out. It lives in the language layout,
 * so the connection stays open while pages change. Renders nothing.
 */
export function RealtimeProvider() {
  const viewer = useViewer();
  const userId = viewer?.id;

  useEffect(() => {
    if (!userId) return;
    startRealtime(userId);
    return () => {
      stopRealtime();
      // What belongs to this person must not show for the next one who logs in on this browser.
      const queryClient = getQueryClient();
      for (const key of ["conversations", "conversation", "messages", "unread", "notifications", "order"]) {
        queryClient.removeQueries({ queryKey: [key] });
      }
    };
  }, [userId]);

  return null;
}

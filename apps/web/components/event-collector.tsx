"use client";

import { useQuery } from "@tanstack/react-query";
import { userSettingsSchema } from "@vinty/shared";
import { useEffect } from "react";
import { useViewer } from "@/components/site-context";
import { clientApi } from "@/lib/api-client";
import { events } from "@/lib/events";

/**
 * Switches the website's feed signals on (cards seen, time on an item, category visits) for a logged in person whose
 * "Tailor Home to what I do" is on, like the app, and sends what is waiting when the page is hidden or closed.
 * Mounted once in the language layout. Renders nothing.
 */
export function EventCollector() {
  const viewer = useViewer();
  const settings = useQuery({
    queryKey: ["settings"],
    queryFn: () => clientApi("/v1/me/settings", { schema: userSettingsSchema }),
    enabled: Boolean(viewer),
    staleTime: 5 * 60_000,
  });
  const collecting = Boolean(viewer) && settings.data?.personaliseFeed !== false;

  useEffect(() => {
    events.setEnabled(collecting);
    return () => events.setEnabled(false);
  }, [collecting]);

  useEffect(() => {
    const leave = () => events.flushOnLeave();
    const onVisibility = () => {
      if (document.visibilityState === "hidden") leave();
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", leave);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", leave);
    };
  }, []);

  return null;
}

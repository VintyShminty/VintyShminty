"use client";

import { useQuery } from "@tanstack/react-query";
import { useSyncExternalStore } from "react";
import { useViewer } from "@/components/site-context";
import { unreadQuery } from "@/lib/messaging-queries";

const noop = () => () => {};

/** False while the page is built on the server and during the browser's first matching pass, true after. */
function useHydrated(): boolean {
  return useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
}

/**
 * The unread chats and notifications of the logged in person. Zero for a visitor. Live: the socket keeps it right.
 * Zero until the page has settled in the browser too, so the numbers never disagree with the server's HTML (parts of
 * a page can settle after the first answer from the server has already arrived).
 */
export function useUnread() {
  const viewer = useViewer();
  const hydrated = useHydrated();
  const { data } = useQuery({ ...unreadQuery(), enabled: viewer !== null });
  return {
    messages: hydrated ? (data?.messages ?? 0) : 0,
    notifications: hydrated ? (data?.notifications ?? 0) : 0,
  };
}

"use client";

import { useEffect } from "react";
import { useUnread } from "@/lib/use-unread";

const PREFIX = /^\(\d+\)\s/;

/**
 * Puts "(3) " in front of the browser tab title while something is unread (chats plus notifications). Pages set their
 * own title when they load, so a small watcher puts the number back whenever the title changes. Renders nothing.
 */
export function UnreadTitle() {
  const { messages, notifications } = useUnread();
  const total = messages + notifications;

  useEffect(() => {
    const apply = () => {
      const bare = document.title.replace(PREFIX, "");
      const next = total > 0 ? `(${total}) ${bare}` : bare;
      if (document.title !== next) document.title = next;
    };
    apply();
    const target = document.querySelector("title");
    if (!target) return;
    const observer = new MutationObserver(apply);
    observer.observe(target, { childList: true, characterData: true, subtree: true });
    return () => {
      observer.disconnect();
      document.title = document.title.replace(PREFIX, "");
    };
  }, [total]);

  return null;
}

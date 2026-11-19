"use client";

import { useEffect, useRef } from "react";
import { useViewer } from "@/components/site-context";
import { clientApi } from "@/lib/api-client";
import { recentSearchBody } from "@/lib/search-visit";

/**
 * Tells the server about a search by words, like the app does when a search is submitted, so the Home feed can learn
 * what the person looks for (docs/plans/home-feed.md section 17). Only for a logged in person, once per search, and
 * silent when it fails. `query` is the address query, given by the page: it holds the filters.
 */
export function SearchVisit({ q, query }: { q: string; query: string }) {
  const viewer = useViewer();
  const signedIn = Boolean(viewer);
  const sent = useRef<string | null>(null);
  useEffect(() => {
    if (!signedIn || !q) return;
    const key = `${q}|${query}`;
    if (sent.current === key) return;
    sent.current = key;
    void clientApi("/v1/me/recent-searches", { method: "POST", body: recentSearchBody(q, query) }).catch(
      () => undefined,
    );
  }, [signedIn, q, query]);
  return null;
}

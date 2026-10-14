"use client";

import { useLayoutEffect } from "react";

/**
 * Jumps the window to the top when it appears. Put it in a `loading.tsx`: while the placeholder shows, Next keeps the
 * scroll of the page you came from (a long Home feed), so the new page would open part way down with its top cut off.
 */
export function ScrollToTop() {
  useLayoutEffect(() => {
    window.scrollTo(0, 0);
  }, []);
  return null;
}

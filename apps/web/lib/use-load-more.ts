"use client";

import { useEffect, useRef } from "react";

/**
 * For endless lists: returns a ref to put on a small element at the end of the list. When it comes into view (with
 * a margin, so the next page starts loading a little early) `load` is called, as long as there is more and nothing is
 * loading.
 */
export function useLoadMore(hasMore: boolean, loading: boolean, load: () => void) {
  const mark = useRef<HTMLDivElement>(null);
  const loadRef = useRef(load);
  loadRef.current = load;
  useEffect(() => {
    const el = mark.current;
    if (!el || !hasMore || loading) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) loadRef.current();
      },
      { rootMargin: "300px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, loading]);
  return mark;
}

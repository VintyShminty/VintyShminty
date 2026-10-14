"use client";

import { DWELL_MIN_MS, DWELL_MIN_PHOTOS } from "@vinty/shared";
import { useEffect } from "react";
import { events, trackDwell } from "@/lib/events";

/** The photo gallery announces every photo the visitor steps to with this event. */
export const PHOTO_SWIPE_EVENT = "vinty:photo-swipe";

/**
 * Time on an item page (only while the tab is in front) and photos swiped. One "time on item" action is sent when the
 * visitor leaves the page, if it was 10 seconds or 3 photos, like the app. Renders nothing.
 */
export function ItemDwell({ listingId }: { listingId: string }) {
  useEffect(() => {
    const state = { ms: 0, since: document.visibilityState === "visible" ? Date.now() : null, photos: 0 };
    let sent = false;
    const stop = () => {
      if (state.since !== null) state.ms += Date.now() - state.since;
      state.since = null;
    };
    const finish = () => {
      stop();
      if (sent) return;
      if (state.ms >= DWELL_MIN_MS || state.photos >= DWELL_MIN_PHOTOS) {
        sent = true;
        trackDwell(listingId, Math.round(state.ms), state.photos);
      }
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") state.since = Date.now();
      else stop();
    };
    const onPhoto = () => {
      state.photos += 1;
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener(PHOTO_SWIPE_EVENT, onPhoto);
    const leave = () => {
      finish();
      // The collector's own page-hide handler may already have run, so send what this page just queued.
      events.flushOnLeave();
    };
    window.addEventListener("pagehide", leave);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener(PHOTO_SWIPE_EVENT, onPhoto);
      window.removeEventListener("pagehide", leave);
      finish();
    };
  }, [listingId]);

  return null;
}

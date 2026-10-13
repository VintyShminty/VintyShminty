import { DWELL_MIN_MS, DWELL_MIN_PHOTOS } from "@vinty/shared";
import { useFocusEffect } from "expo-router";
import { useCallback, useRef } from "react";
import { trackDwell } from "@/lib/events";

/** True when time on an item or photos swiped show real interest (the numbers are shared with the server). */
export function isInterested(dwellMs: number, photosSwiped: number): boolean {
  return dwellMs >= DWELL_MIN_MS || photosSwiped >= DWELL_MIN_PHOTOS;
}

/**
 * Time on an item page (only while it is the screen in front) and photos swiped. One "time on item" action is sent
 * when the person leaves the page, if it was 10 seconds or 3 photos. Give `onPhotoSwipe` to the photo carousel.
 */
export function useDwell(listingId: string) {
  const state = useRef({ ms: 0, since: null as number | null, photos: 0, sent: false });

  useFocusEffect(
    useCallback(() => {
      const s = state.current;
      s.since = Date.now();
      return () => {
        if (s.since !== null) s.ms += Date.now() - s.since;
        s.since = null;
        if (!s.sent && isInterested(s.ms, s.photos)) {
          s.sent = true;
          trackDwell(listingId, Math.round(s.ms), s.photos);
        }
      };
    }, [listingId]),
  );

  return {
    onPhotoSwipe: useCallback(() => {
      state.current.photos += 1;
    }, []),
  };
}

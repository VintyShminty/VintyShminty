import { queryOptions, useQuery } from "@tanstack/react-query";
import {
  mergeGuesses,
  PHOTO_ASSIST_MAX_PHOTOS,
  type PhotoAssistStatus,
  type PhotoCheck,
  type PhotoSuggestion,
  photoAssistStatusSchema,
  photoCheckSchema,
  photoSuggestionSchema,
  type ReferenceData,
  type SellGuesses,
  TEXT_ASSIST_MIN_CHARS,
  type TextSuggestion,
  textSuggestionSchema,
} from "@vinty/shared";
import { useCallback, useEffect } from "react";
import { api } from "@/lib/api";
import { useSellStore } from "@/lib/sell-store";

/** Whether the server has the photo helper switched on. Cached, so the answer is ready when the first photo lands. */
export const photoAssistStatusQuery = () =>
  queryOptions({
    queryKey: ["photo-assist"],
    queryFn: () => api<PhotoAssistStatus>("/v1/sell/assist", { schema: photoAssistStatusSchema }),
    staleTime: 5 * 60 * 1000,
  });

/** Wait this long after the last photo finished uploading, so a batch of photos is read together. */
const SETTLE_MS = 700;

/**
 * Reads the seller's photos once per new listing, in the background, as soon as the photos are uploaded. Whatever comes
 * back is only stored (sell-store receiveSuggestion), never filled in. The pickers show it first. A failure or an empty
 * answer changes nothing.
 */
export function usePhotoAssist(opts: {
  /** False when editing a saved listing. */
  enabled: boolean;
  language: "en" | "he";
  reference: ReferenceData | undefined;
}) {
  const { data } = useQuery(photoAssistStatusQuery());
  const on = Boolean(data?.photoAssist) && opts.enabled && Boolean(opts.reference);
  const assist = useSellStore((s) => s.assist);
  const photos = useSellStore((s) => s.values.photos);
  const uploading = photos.some((p) => p.state === "uploading");
  const keys = photos.filter((p) => p.state === "done" && p.key).map((p) => p.key as string);
  const keyList = keys.join("|");

  // biome-ignore lint/correctness/useExhaustiveDependencies: keyList stands for keys
  useEffect(() => {
    if (!on || assist !== "idle" || uploading || keys.length === 0) return;
    const timer = setTimeout(() => {
      const store = useSellStore.getState();
      if (store.assist !== "idle" || !opts.reference) return;
      const session = store.session;
      store.setAssist("reading");
      store.markChecked(session, keys.slice(0, PHOTO_ASSIST_MAX_PHOTOS));
      api<PhotoSuggestion>("/v1/listings/suggest", {
        method: "POST",
        body: { photoKeys: keys.slice(0, PHOTO_ASSIST_MAX_PHOTOS), language: opts.language },
        schema: photoSuggestionSchema,
      })
        .then((suggestion) => useSellStore.getState().receiveSuggestion(session, suggestion))
        .catch((error) => {
          if (__DEV__) console.warn("Photo helper failed:", error);
          useSellStore.getState().finishAssist(session);
        });
    }, SETTLE_MS);
    return () => clearTimeout(timer);
  }, [on, assist, uploading, keyList, opts.language, opts.reference]);
}

/** The helper's guesses as they are right now: photos and words together (D-036). Null when there are none. */
export function currentGuesses(): SellGuesses | null {
  const { suggestion, textSuggestion } = useSellStore.getState();
  return mergeGuesses(suggestion, textSuggestion);
}

/** At most this many times the words are read per listing. */
const TEXT_CALLS_MAX = 5;

/**
 * Reads the title and description (D-036), for new listings only. Give the returned function to the title and
 * description fields as their blur handler: when the seller leaves a field and there is enough new text, and something
 * is still left to choose, the words are sent. The answer is only stored, never filled in. A failure changes nothing.
 */
export function useTextAssist(opts: { enabled: boolean; language: "en" | "he" }) {
  const { data } = useQuery(photoAssistStatusQuery());
  const on = Boolean(data?.textAssist) && opts.enabled;
  const { language } = opts;

  return useCallback(() => {
    if (!on) return;
    const store = useSellStore.getState();
    const { title, description, categoryId, brand, conditionId, colourIds } = store.values;
    if (categoryId && brand && conditionId && colourIds.length > 0) return;
    const text = `${title.trim()}\n${description.trim()}`;
    if (`${title}${description}`.trim().length < TEXT_ASSIST_MIN_CHARS) return;
    if (text === store.lastTextSent || store.textCalls >= TEXT_CALLS_MAX) return;
    const session = store.session;
    store.markTextSent(session, text);
    api<TextSuggestion>("/v1/listings/suggest-text", {
      method: "POST",
      body: { title: title.trim(), description: description.trim(), language },
      schema: textSuggestionSchema,
    })
      .then((suggestion) => useSellStore.getState().receiveTextSuggestion(session, suggestion))
      .catch((error) => {
        if (__DEV__) console.warn("Text helper failed:", error);
      });
  }, [on, language]);
}

/**
 * Photo tips for photos added after the first read (D-036): when their uploads settle, the ones never checked (up to
 * four, oldest first) are sent for tips only. The tips are stored by photo key. A failure changes nothing, and those
 * photos are not asked about again.
 */
export function usePhotoTipCheck(opts: { enabled: boolean }) {
  const { data } = useQuery(photoAssistStatusQuery());
  const on = Boolean(data?.photoAssist) && opts.enabled;
  const assist = useSellStore((s) => s.assist);
  const photos = useSellStore((s) => s.values.photos);
  const checked = useSellStore((s) => s.checkedKeys);
  const uploading = photos.some((p) => p.state === "uploading");
  const fresh = photos
    .filter((p) => p.state === "done" && p.key && !checked.includes(p.key))
    .map((p) => p.key as string);
  const freshList = fresh.join("|");

  // biome-ignore lint/correctness/useExhaustiveDependencies: freshList stands for fresh
  useEffect(() => {
    if (!on || assist !== "done" || uploading || fresh.length === 0) return;
    const timer = setTimeout(() => {
      const store = useSellStore.getState();
      const session = store.session;
      const send = store.values.photos
        .filter((p) => p.state === "done" && p.key && !store.checkedKeys.includes(p.key))
        .map((p) => p.key as string)
        .slice(0, PHOTO_ASSIST_MAX_PHOTOS);
      if (send.length === 0) return;
      store.markChecked(session, send);
      api<PhotoCheck>("/v1/listings/photo-check", {
        method: "POST",
        body: { photoKeys: send },
        schema: photoCheckSchema,
      })
        .then((check) => useSellStore.getState().addPhotoTips(session, check.photoTips))
        .catch((error) => {
          if (__DEV__) console.warn("Photo check failed:", error);
        });
    }, SETTLE_MS);
    return () => clearTimeout(timer);
  }, [on, assist, uploading, freshList]);
}

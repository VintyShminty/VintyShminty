import { queryOptions, useQuery } from "@tanstack/react-query";
import {
  PHOTO_ASSIST_MAX_PHOTOS,
  type PhotoAssistStatus,
  type PhotoSuggestion,
  photoAssistStatusSchema,
  photoSuggestionSchema,
  type ReferenceData,
} from "@vinty/shared";
import { useEffect } from "react";
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
 * back is filled into empty fields only (sell-store applyPhotoSuggestion). A failure or an empty answer changes nothing.
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
      const reference = opts.reference;
      const session = store.session;
      store.setAssist("reading");
      api<PhotoSuggestion>("/v1/listings/suggest", {
        method: "POST",
        body: { photoKeys: keys.slice(0, PHOTO_ASSIST_MAX_PHOTOS), language: opts.language },
        schema: photoSuggestionSchema,
      })
        .then((suggestion) => useSellStore.getState().applyPhotoSuggestion(session, suggestion, reference))
        .catch((error) => {
          if (__DEV__) console.warn("Photo helper failed:", error);
          useSellStore.getState().finishAssist(session);
        });
    }, SETTLE_MS);
    return () => clearTimeout(timer);
  }, [on, assist, uploading, keyList, opts.language, opts.reference]);
}

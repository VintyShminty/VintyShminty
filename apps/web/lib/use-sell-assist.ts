"use client";

import {
  PHOTO_ASSIST_MAX_PHOTOS,
  type PhotoSuggestion,
  type PhotoTipKind,
  photoCheckSchema,
  photoSuggestionSchema,
  type TextSuggestion,
  textSuggestionSchema,
} from "@vinty/shared";
import { useCallback, useEffect, useRef, useState } from "react";
import { clientApi } from "@/lib/api-client";
import { MAX_TEXT_ASSIST_CALLS, nextCheckKeys, shouldAskText, tipLines } from "@/lib/sell-assist";

type Lang = "en" | "he";

/**
 * The sell form helpers (D-028, D-036): the photo read, the photo tips and the text guesses.
 * They only ever suggest, nothing here fills a field.
 */
export function useSellAssist({
  photoOn,
  textOn,
  lang,
  order,
  uploading,
  title,
  description,
  allChosen,
}: {
  photoOn: boolean;
  textOn: boolean;
  lang: Lang;
  /** The seller's photos in order: the upload key of each finished one, null for one still uploading or failed. */
  order: (string | null)[];
  uploading: boolean;
  title: string;
  description: string;
  /** Category, brand, condition and colours are all chosen, nothing left to guess. */
  allChosen: boolean;
}) {
  const [assist, setAssist] = useState<"idle" | "reading" | "done">("idle");
  const [suggestion, setSuggestion] = useState<PhotoSuggestion | null>(null);
  const [textSuggestion, setTextSuggestion] = useState<TextSuggestion | null>(null);
  const [tips, setTips] = useState<Record<string, PhotoTipKind[]>>({});
  const [dismissed, setDismissed] = useState<string[]>([]);
  const checked = useRef(new Set<string>());
  const lastText = useRef("");
  const textCalls = useRef(0);
  const photoKeys = order.filter((k): k is string => Boolean(k));
  const keyList = photoKeys.join("|");

  const addTips = useCallback((list: { key: string; kinds: PhotoTipKind[] }[]) => {
    if (list.length === 0) return;
    setTips((prev) => {
      const next = { ...prev };
      for (const tip of list) next[tip.key] = tip.kinds;
      return next;
    });
  }, []);

  // The first read (guesses and tips), once, after the uploads settle.
  // biome-ignore lint/correctness/useExhaustiveDependencies: keyList stands for photoKeys
  useEffect(() => {
    if (!photoOn || assist !== "idle" || uploading || photoKeys.length === 0) return;
    const timer = setTimeout(() => {
      const keys = photoKeys.slice(0, PHOTO_ASSIST_MAX_PHOTOS);
      for (const k of keys) checked.current.add(k);
      setAssist("reading");
      clientApi("/v1/listings/suggest", {
        method: "POST",
        body: { photoKeys: keys, language: lang },
        schema: photoSuggestionSchema,
      })
        .then((s) => {
          setSuggestion(s);
          addTips(s.photoTips);
        })
        .catch(() => undefined)
        .finally(() => setAssist("done"));
    }, 700);
    return () => clearTimeout(timer);
  }, [photoOn, assist, uploading, keyList, lang, addTips]);

  // Photos added after the first read: check only those, only for tips, never twice.
  // biome-ignore lint/correctness/useExhaustiveDependencies: keyList stands for photoKeys
  useEffect(() => {
    if (!photoOn || assist !== "done" || uploading) return;
    if (nextCheckKeys(photoKeys, checked.current).length === 0) return;
    const timer = setTimeout(() => {
      const keys = nextCheckKeys(photoKeys, checked.current);
      if (keys.length === 0) return;
      for (const k of keys) checked.current.add(k);
      clientApi("/v1/listings/photo-check", {
        method: "POST",
        body: { photoKeys: keys },
        schema: photoCheckSchema,
      })
        .then((r) => addTips(r.photoTips))
        .catch(() => undefined);
    }, 700);
    return () => clearTimeout(timer);
  }, [photoOn, assist, uploading, keyList, addTips]);

  /** Call when the seller leaves the title or the description. */
  const onTextBlur = useCallback(() => {
    if (!textOn || allChosen || textCalls.current >= MAX_TEXT_ASSIST_CALLS) return;
    if (!shouldAskText(title, description, lastText.current)) return;
    lastText.current = `${title}\n${description}`.trim();
    textCalls.current += 1;
    clientApi("/v1/listings/suggest-text", {
      method: "POST",
      body: { title, description, language: lang },
      schema: textSuggestionSchema,
    })
      .then((s) => setTextSuggestion(s))
      .catch(() => undefined);
  }, [textOn, allChosen, title, description, lang]);

  const tipRows = photoOn ? tipLines(order, tips, dismissed) : [];
  const dismissTip = useCallback((key: string) => setDismissed((d) => [...d, key]), []);

  return { assist, suggestion, textSuggestion, tipRows, dismissTip, onTextBlur };
}

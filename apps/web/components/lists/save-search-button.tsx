"use client";

import { Bookmark } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useLoginPrompt } from "@/components/login-prompt";
import { useViewer } from "@/components/site-context";
import { clientApi } from "@/lib/api-client";
import { hasFilters, parseCategories, parseFilters } from "@/lib/filters";

/**
 * The bookmark next to the search (like the app): saves the words and filters in the address as a saved search, with
 * alerts on. Only shown when there is something to save. Logged out it asks to log in. The page address is its memory
 * of "already saved" (`query` is the address query, given by the page), so changing the words or a filter makes it a new search again.
 */
export function SaveSearchButton({ q, query }: { q: string; query: string }) {
  const { t } = useTranslation();
  const viewer = useViewer();
  const { ask } = useLoginPrompt();
  const params = new URLSearchParams(query);
  const [savedKey, setSavedKey] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);

  const filters = parseFilters(params, "relevance");
  const categories = parseCategories(params);
  if (!q && !hasFilters(filters) && categories.length === 0) return null;
  const key = query;
  const saved = savedKey === key;

  const save = async () => {
    if (!viewer) return ask();
    setFailed(false);
    setBusy(true);
    try {
      await clientApi("/v1/me/saved-searches", {
        method: "POST",
        body: {
          ...(q ? { queryText: q } : {}),
          filters: {
            sort: filters.sort,
            ...(filters.brands.length ? { brandIds: filters.brands.map((b) => b.id) } : {}),
            ...(filters.sizeIds.length ? { sizeIds: filters.sizeIds } : {}),
            ...(filters.conditionIds.length ? { conditionIds: filters.conditionIds } : {}),
            ...(filters.colourIds.length ? { colourIds: filters.colourIds } : {}),
            ...(filters.min !== undefined ? { priceMinMinor: filters.min * 100 } : {}),
            ...(filters.max !== undefined ? { priceMaxMinor: filters.max * 100 } : {}),
            ...(categories.length ? { categoryIds: categories.map((c) => c.id) } : {}),
          },
          notifyOnNew: true,
        },
      });
      setSavedKey(key);
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col items-start gap-xs md:items-end">
      <button
        type="button"
        onClick={save}
        disabled={saved || busy}
        aria-pressed={saved}
        className="inline-flex h-10 items-center gap-xs rounded-full border border-primary px-md text-pill font-semibold text-primary hover:bg-accent-tint disabled:opacity-70"
      >
        <Bookmark size={18} aria-hidden fill={saved ? "currentColor" : "none"} />
        {saved ? t("search.saved") : t("search.save")}
      </button>
      {failed ? (
        <p role="alert" className="text-body-sm text-error">
          {t("search.saveFailed")}
        </p>
      ) : null}
    </div>
  );
}

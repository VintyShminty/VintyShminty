import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  EMPTY_SEARCH_UNDERSTANDING,
  type SearchUnderstanding,
  searchNeedsUnderstanding,
  searchUnderstandingSchema,
} from "@vinty/shared";
import { useCallback, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "@/lib/api";
import { referenceQuery } from "@/lib/queries";
import { findCategory } from "@/lib/saved-search-summary";
import { activeFilters, type SearchState, useSearchStore } from "@/lib/search-store";
import { applyUnderstandingToState } from "@/lib/search-understanding";
import { photoAssistStatusQuery } from "@/lib/sell-assist";

/** What the quiet line above the results needs: the way back and the search it belongs to. */
type Note = { original: string; undo: SearchState; key: string };

/**
 * Search in plain words (D-037). `run` is called after a search is submitted: when the server has the helper on and the
 * words are long enough it asks for filters and switches them on, keeping a way back to the exact words. Anything that
 * goes wrong leaves the plain word search as it was.
 */
export function useSearchAssist() {
  const { i18n } = useTranslation();
  const queryClient = useQueryClient();
  const status = useQuery(photoAssistStatusQuery());
  const enabled = Boolean(status.data?.searchAssist);
  const language = i18n.language === "he" ? "he" : "en";
  const [pending, setPending] = useState(false);
  const [note, setNote] = useState<Note | null>(null);
  const latest = useRef(0);
  const state = useSearchStore((s) => s.scopes.search);

  const run = useCallback(
    async (text: string) => {
      const id = ++latest.current;
      setNote(null);
      if (!enabled || !searchNeedsUnderstanding(text)) {
        setPending(false);
        return;
      }
      setPending(true);
      try {
        const store = useSearchStore.getState();
        let understanding: SearchUnderstanding = EMPTY_SEARCH_UNDERSTANDING;
        try {
          understanding = await api<SearchUnderstanding>("/v1/search/understand", {
            method: "POST",
            body: { text, language },
            schema: searchUnderstandingSchema,
          });
        } catch {
          // Plain word search, as without the helper.
        }
        if (id !== latest.current || !understanding.understood) return;

        const reference = await queryClient.fetchQuery(referenceQuery()).catch(() => undefined);
        if (id !== latest.current) return;
        const category = understanding.categoryId
          ? findCategory(reference?.categories, understanding.categoryId)
          : undefined;
        const { next, undo } = applyUnderstandingToState(store.scopes.search, text, understanding, {
          categoryName: () => category?.name[language],
        });
        store.reset("search", next);
        setNote({ original: text, undo, key: JSON.stringify(activeFilters(next)) });
      } finally {
        if (id === latest.current) setPending(false);
      }
    },
    [enabled, language, queryClient],
  );

  /** "Search the exact words": back to the search from before, with the person's own words. */
  const undo = useCallback(() => {
    if (!note) return;
    latest.current++;
    useSearchStore.getState().reset("search", note.undo);
    setNote(null);
  }, [note]);

  // The line belongs to one search. Once the words or filters change, it goes away.
  const visible = note && note.key === JSON.stringify(activeFilters(state)) ? note : null;
  return { pending, note: visible, run, undo };
}

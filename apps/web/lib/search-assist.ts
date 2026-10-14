import {
  applyUnderstanding,
  type CategoryNode,
  type SearchUnderstanding,
  searchNeedsUnderstanding,
} from "@vinty/shared";
import { savedSearchHref } from "./filters";

/**
 * Search in plain words on the website (D-037). The pure parts: turning what the AI understood into the search
 * address, and reading and dropping the marker that makes the results page show "Searched as filters".
 */

/** The address key that carries the visitor's original words. Present only on a search that was turned into filters. */
export const ASKED_PARAM = "asked";
const MAX_ASKED = 100;

/** Only a sentence-like search is sent to the AI, and only when the helper is on. */
export function shouldUnderstand(text: string, on: boolean): boolean {
  return on && searchNeedsUnderstanding(text);
}

/** Category id to its name, for the category chip. Every node of the tree, groups and leaves. */
export function categoryNameMap(tree: CategoryNode[], lang: "en" | "he"): Record<string, string> {
  const out: Record<string, string> = {};
  const walk = (nodes: CategoryNode[]) => {
    for (const node of nodes) {
      out[node.id] = node.name[lang];
      walk(node.children);
    }
  };
  walk(tree);
  return out;
}

/**
 * The results address for an understood search, or null when nothing the website can show as a filter came out
 * (the website has no material or pattern filter), so the caller falls back to the plain word search.
 * Starts from no other filters on purpose: a new sentence is a new search.
 */
export function understoodHref(
  lang: string,
  asked: string,
  understanding: SearchUnderstanding,
  names: { brands: Record<string, string>; categories: Record<string, string>; brandFallback: string },
): string | null {
  if (!understanding.understood) return null;
  const filters = applyUnderstanding({}, understanding);
  // A category whose name is unknown would be silently dropped by the address, so leave it out of the check too.
  const categoryKnown = Boolean(filters.categoryId && names.categories[filters.categoryId]);
  const href = savedSearchHref(
    lang,
    { queryText: filters.q ?? null, filters: { ...filters, sort: filters.sort ?? "relevance" } },
    names,
  );
  const [path = "", query = ""] = href.split("?");
  const params = new URLSearchParams(query);
  const hasFilter = [...params.keys()].some((k) => k !== "q") || categoryKnown;
  if (!hasFilter) return null;
  params.set(ASKED_PARAM, asked.trim().slice(0, MAX_ASKED));
  return `${path}?${params.toString()}`;
}

/** The original words, when this results page came from a plain-words search. */
export function readAsked(value: string | string[] | null | undefined): string {
  const first = Array.isArray(value) ? value[0] : value;
  return first?.trim().slice(0, MAX_ASKED) ?? "";
}

/** The same address query without the marker. Any change of filters or words uses this, so the line goes away. */
export function withoutAsked(params: URLSearchParams): URLSearchParams {
  const next = new URLSearchParams(params);
  next.delete(ASKED_PARAM);
  return next;
}

/** The plain word search for the original words: no filters from the AI. */
export function exactWordsHref(lang: string, asked: string): string {
  return `/${lang}/search?${new URLSearchParams({ q: asked }).toString()}`;
}

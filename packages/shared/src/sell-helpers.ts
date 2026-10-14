import { categoryTrail, findCategory } from "./listing-rules.js";
import type { PhotoSuggestion } from "./photo-assist.js";
import type { CategoryNode } from "./reference-data.js";

/** Top level categories the sell form does not offer (Browse still shows them). */
export const SELL_HIDDEN_ROOTS: readonly string[] = ["designer"];

/** A guessed category with the names above it, for the "Looks like" rows ("Women · Shoes"). */
export type CategoryGuess = { node: CategoryNode; parents: CategoryNode[] };

/**
 * The helper's category guesses as real leaf categories, best first. Guesses the sell form cannot offer (hidden top
 * rows such as Designer) are left out.
 */
export function categoryGuesses(
  suggestion: PhotoSuggestion | null,
  categories: CategoryNode[],
  hiddenRoots: readonly string[] = [],
): CategoryGuess[] {
  const found: CategoryGuess[] = [];
  for (const guess of suggestion?.categories ?? []) {
    const node = findCategory(categories, guess.id);
    if (!node?.isLeaf) continue;
    const trail = categoryTrail(categories, node.id);
    if (trail[0] && hiddenRoots.includes(trail[0].slug)) continue;
    found.push({ node, parents: trail.slice(0, -1) });
  }
  return found;
}

/** Moves one photo to a new place in the list, the rest keep their order. Out of range indexes change nothing. */
export function movePhoto<T>(list: readonly T[], from: number, to: number): T[] {
  if (from === to || from < 0 || from >= list.length || to < 0 || to >= list.length) return [...list];
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item as T);
  return next;
}

export type CategoryHit = { node: CategoryNode; trail: CategoryNode[] };

/** Leaf categories whose name contains the text (two letters or more), with the path to each. At most `limit`. */
export function searchLeafCategories(
  tree: readonly CategoryNode[],
  query: string,
  name: (value: CategoryNode["name"]) => string,
  limit = 50,
): CategoryHit[] {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];
  const found: CategoryHit[] = [];
  const walk = (nodes: readonly CategoryNode[], trail: CategoryNode[]) => {
    for (const n of nodes) {
      if (found.length >= limit) return;
      if (n.isLeaf && name(n.name).toLowerCase().includes(q)) found.push({ node: n, trail });
      walk(n.children, [...trail, n]);
    }
  };
  walk(tree, []);
  return found;
}

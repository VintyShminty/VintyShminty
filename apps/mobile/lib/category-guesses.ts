import { type CategoryNode, categoryTrail, findCategory, type PhotoSuggestion } from "@vinty/shared";

/** A guessed category with the names above it, for the "Looks like" rows ("Women · Shoes"). */
export type CategoryGuess = { node: CategoryNode; parents: CategoryNode[] };

/**
 * The helper's category guesses as real leaf categories, best first. Guesses the sell form cannot offer (hidden top
 * rows such as Designer) are left out.
 */
export function categoryGuesses(
  suggestion: PhotoSuggestion | null,
  categories: CategoryNode[],
  hiddenRoots: string[] = [],
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

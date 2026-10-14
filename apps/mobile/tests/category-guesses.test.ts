import type { CategoryNode, PhotoSuggestion } from "@vinty/shared";
import { describe, expect, it } from "vitest";
import { categoryGuesses } from "../lib/category-guesses";

const node = (id: string, slug: string, children: CategoryNode[] = []) =>
  ({
    id,
    slug,
    isLeaf: children.length === 0,
    children,
    name: { en: slug, he: slug },
  }) as unknown as CategoryNode;

const tree = [
  node("women", "women", [node("shoes", "shoes", [node("boots", "boots"), node("sneakers", "sneakers")])]),
  node("designer", "designer", [node("d-bags", "d-bags")]),
];
const suggestion = (ids: string[]): PhotoSuggestion => ({
  categories: ids.map((id) => ({ id, confidence: 0.5 })),
  brand: null,
  colourIds: [],
  materialId: null,
  title: null,
  description: null,
  photoTips: [],
});

describe("categoryGuesses", () => {
  it("keeps the helper's order and gives the names above each guess", () => {
    const guesses = categoryGuesses(suggestion(["boots", "sneakers"]), tree);
    expect(guesses.map((g) => g.node.id)).toEqual(["boots", "sneakers"]);
    expect(guesses[0]?.parents.map((p) => p.slug)).toEqual(["women", "shoes"]);
  });

  it("leaves out hidden top rows, unknown ids and rows that are not leaves", () => {
    const guesses = categoryGuesses(suggestion(["d-bags", "nope", "shoes", "boots"]), tree, ["designer"]);
    expect(guesses.map((g) => g.node.id)).toEqual(["boots"]);
  });

  it("is empty with no suggestion", () => {
    expect(categoryGuesses(null, tree)).toEqual([]);
  });
});

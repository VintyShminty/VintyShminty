import { describe, expect, it } from "vitest";
import type { CategoryNode } from "./reference-data.js";
import { categoryGuesses, movePhoto, searchLeafCategories } from "./sell-helpers.js";

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
  node("designer", "designer", [node("d-boots", "d-boots")]),
];
const name = (n: CategoryNode["name"]) => n.en;

describe("sell helpers", () => {
  it("moves a photo and ignores out of range moves", () => {
    expect(movePhoto([1, 2, 3], 2, 0)).toEqual([3, 1, 2]);
    expect(movePhoto([1, 2, 3], 0, 5)).toEqual([1, 2, 3]);
  });

  it("finds leaf categories by name with their path", () => {
    const hits = searchLeafCategories(tree, "boot", name);
    expect(hits.map((h) => h.node.id)).toEqual(["boots", "d-boots"]);
    expect(hits[0]?.trail.map((n) => n.id)).toEqual(["women", "shoes"]);
    expect(searchLeafCategories(tree, "b", name)).toEqual([]);
  });

  it("leaves hidden roots out of the guesses", () => {
    const suggestion = {
      categories: [
        { id: "d-boots", confidence: 0.9 },
        { id: "boots", confidence: 0.5 },
      ],
      brand: null,
      colourIds: [],
      materialId: null,
      title: null,
      description: null,
    };
    expect(categoryGuesses(suggestion, tree, ["designer"]).map((g) => g.node.id)).toEqual(["boots"]);
  });
});

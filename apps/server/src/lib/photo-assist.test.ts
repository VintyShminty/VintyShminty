import type { ReferenceData } from "@vinty/shared";
import { describe, expect, it } from "vitest";
import { flattenCategories } from "../../../../packages/db/src/seed/reference/categories.js";
import {
  type BrandMatcher,
  buildCatalog,
  normaliseBrand,
  PHOTO_HINTS,
  photoHint,
  resolveSuggestion,
} from "./photo-assist.js";

const name = (en: string) => ({ en, he: en });
const reference = {
  categories: [
    {
      id: "cat-women",
      isLeaf: false,
      name: name("Women"),
      children: [
        { id: "cat-dresses", isLeaf: true, name: name("Dresses"), children: [] },
        { id: "cat-jeans", isLeaf: true, name: name("Jeans"), children: [] },
      ],
    },
  ],
  colours: [
    { id: "col-black", name: name("Black") },
    { id: "col-red", name: name("Red") },
    { id: "col-blue", name: name("Blue") },
  ],
  materials: [{ id: "mat-cotton", name: name("Cotton") }],
} as unknown as ReferenceData;

const matcher: BrandMatcher = {
  async match(text) {
    return normaliseBrand(text) === "zara" ? { id: "brand-zara", name: "Zara" } : null;
  },
};

describe("normaliseBrand", () => {
  it("ignores case, accents, spaces and punctuation", () => {
    expect(normaliseBrand("  Levi's ")).toBe("levis");
    expect(normaliseBrand("Hermès")).toBe("hermes");
    expect(normaliseBrand("H & M")).toBe("handm");
    expect(normaliseBrand("Ralph-Lauren")).toBe(normaliseBrand("ralph lauren"));
  });
});

describe("buildCatalog", () => {
  it("lists leaf categories with codes and paths, and is the same every time", () => {
    const a = buildCatalog(reference);
    expect(a.text).toContain("C1: Women > Dresses");
    expect(a.text).toContain("C2: Women > Jeans");
    expect(a.text).not.toContain("Women\n");
    expect(a.categories.get("C2")).toBe("cat-jeans");
    expect(a.colours.get("K2")).toBe("col-red");
    expect(a.materials.get("M1")).toBe("mat-cotton");
    expect(buildCatalog(reference).text).toBe(a.text);
  });
});

describe("photo hints", () => {
  it("follow the category in the list, for Women and Men alike", () => {
    expect(photoHint("women-clothing-tops-overshirts")).toBe(PHOTO_HINTS["clothing-tops-overshirts"]);
    expect(photoHint("men-clothing-vests")).toBe(PHOTO_HINTS["clothing-vests"]);
    expect(photoHint("women-shoes-heels")).toBeUndefined();
    const withHint = {
      ...reference,
      categories: [
        {
          id: "cat-men",
          isLeaf: false,
          name: name("Men"),
          children: [
            {
              id: "cat-over",
              slug: "men-clothing-shirts-overshirts",
              isLeaf: true,
              name: name("Overshirts"),
              children: [],
            },
          ],
        },
      ],
    } as unknown as ReferenceData;
    expect(buildCatalog(withHint).text).toContain(
      "C1: Men > Overshirts (thick shirt worn open as a light jacket)",
    );
  });

  it("only name leaf categories that exist", () => {
    const leaves = new Set(
      flattenCategories()
        .filter((c) => c.isLeaf)
        .map((c) => c.slug),
    );
    const unknown = Object.keys(PHOTO_HINTS).filter(
      (key) => !leaves.has(`women-${key}`) && !leaves.has(`men-${key}`),
    );
    expect(unknown).toEqual([]);
  });
});

describe("resolveSuggestion", () => {
  const catalog = buildCatalog(reference);

  it("turns codes into ids and keeps what is real", async () => {
    const s = await resolveSuggestion(
      {
        categories: [
          { code: " c2 ", confidence: 0.7 },
          { code: "C1", confidence: 0.2 },
        ],
        brandText: "ZARA",
        colours: ["K1", "K3"],
        material: "M1",
        title: "  Black   dress ",
        description: "A dress.",
      },
      catalog,
      matcher,
    );
    expect(s.categories).toEqual([
      { id: "cat-jeans", confidence: 0.7 },
      { id: "cat-dresses", confidence: 0.2 },
    ]);
    expect(s.brand).toEqual({ id: "brand-zara", name: "Zara" });
    expect(s.colourIds).toEqual(["col-black", "col-blue"]);
    expect(s.materialId).toBe("mat-cotton");
    expect(s.title).toBe("Black dress");
  });

  it("drops codes that are not in our lists, repeats and a third colour", async () => {
    const s = await resolveSuggestion(
      {
        categories: [
          { code: "C99", confidence: 0.99 },
          { code: "C1", confidence: 7 },
          { code: "C1", confidence: 0.5 },
          { code: "C2" },
        ],
        colours: ["K9", "K2", "K2", "K3", "K1"],
        material: "M7",
        title: "",
      },
      catalog,
      matcher,
    );
    expect(s.categories).toEqual([
      { id: "cat-dresses", confidence: 1 },
      { id: "cat-jeans", confidence: 0 },
    ]);
    expect(s.colourIds).toEqual(["col-red", "col-blue"]);
    expect(s.materialId).toBeNull();
    expect(s.title).toBeNull();
  });

  it("keeps a brand we do not know as text only", async () => {
    const s = await resolveSuggestion({ brandText: "Obscure Label" }, catalog, matcher);
    expect(s.brand).toEqual({ id: null, name: "Obscure Label" });
  });

  it("copes with an empty answer", async () => {
    const s = await resolveSuggestion({}, catalog, matcher);
    expect(s.categories).toEqual([]);
    expect(s.brand).toBeNull();
    expect(s.colourIds).toEqual([]);
  });
});

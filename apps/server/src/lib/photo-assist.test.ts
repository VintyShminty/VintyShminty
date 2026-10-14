import type { ReferenceData } from "@vinty/shared";
import { describe, expect, it } from "vitest";
import { flattenCategories } from "../../../../packages/db/src/seed/reference/categories.js";
import {
  type BrandMatcher,
  buildCatalog,
  buildTextCatalog,
  normaliseBrand,
  PHOTO_HINTS,
  photoHint,
  resolvePhotoTips,
  resolveSuggestion,
  resolveTextSuggestion,
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
  conditions: [
    { id: "cond-new", name: name("New with tags"), description: name("Never worn, tags attached") },
    { id: "cond-good", name: name("Good"), description: name("") },
  ],
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
    expect(a.text).not.toContain("MATERIALS");
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
    // The retired guesses are always null, so older app builds still parse the answer.
    expect(s.materialId).toBeNull();
    expect(s.title).toBeNull();
    expect(s.description).toBeNull();
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

describe("buildTextCatalog", () => {
  it("adds the conditions after the same categories and colours as the photo catalog", () => {
    const photo = buildCatalog(reference);
    const text = buildTextCatalog(reference);
    expect(text.text.startsWith(photo.text)).toBe(true);
    expect(text.text).toContain("CONDITIONS (code: name, meaning)");
    expect(text.text).toContain("Q1: New with tags, Never worn, tags attached");
    expect(text.text).toContain("Q2: Good");
    expect(text.text).not.toContain("Q2: Good,");
    expect(text.conditions.get("Q2")).toBe("cond-good");
  });

  it("leaves the photo catalog text without conditions, so its prompt cache holds", () => {
    expect(buildCatalog(reference).text).not.toContain("CONDITIONS");
    expect(buildCatalog(reference).text).toBe(
      [
        "CATEGORIES (code: path)",
        "C1: Women > Dresses",
        "C2: Women > Jeans",
        "",
        "COLOURS (code: name)",
        "K1: Black",
        "K2: Red",
        "K3: Blue",
      ].join("\n"),
    );
  });
});

describe("resolvePhotoTips", () => {
  const keys = ["listings/u/a.jpg", "listings/u/b.jpg", "listings/u/c.jpg"];

  it("maps photo numbers to the keys that were sent, orders kinds and merges repeats", () => {
    const tips = resolvePhotoTips(
      [
        { photo: 2, issues: ["dark", "contact"] },
        { photo: 2, issues: ["cut_off", "dark"] },
        { photo: 1, issues: ["dark"] },
      ],
      keys,
    );
    expect(tips).toEqual([
      { key: "listings/u/a.jpg", kinds: ["dark"] },
      { key: "listings/u/b.jpg", kinds: ["contact", "cut_off", "dark"] },
    ]);
  });

  it("drops unknown numbers, unknown kinds and empty entries", () => {
    expect(
      resolvePhotoTips(
        [
          { photo: 0, issues: ["dark"] },
          { photo: 4, issues: ["dark"] },
          { photo: 1.5, issues: ["dark"] },
          { photo: null, issues: ["dark"] },
          { photo: 1, issues: ["blurry"] },
          { photo: 3, issues: null },
        ],
        keys,
      ),
    ).toEqual([]);
    expect(resolvePhotoTips(undefined, keys)).toEqual([]);
  });

  it("uses the keys of the photos really sent, so a skipped photo does not shift the numbers", async () => {
    // Photo b could not be read, so the model saw a and c as photos 1 and 2.
    const sent = ["listings/u/a.jpg", "listings/u/c.jpg"];
    const s = await resolveSuggestion(
      { photoIssues: [{ photo: 2, issues: ["cut_off"] }] },
      buildCatalog(reference),
      matcher,
      sent,
    );
    expect(s.photoTips).toEqual([{ key: "listings/u/c.jpg", kinds: ["cut_off"] }]);
    expect((await resolveSuggestion({}, buildCatalog(reference), matcher)).photoTips).toEqual([]);
  });
});

describe("resolveTextSuggestion", () => {
  const catalog = buildTextCatalog(reference);

  it("turns codes into ids, matches the brand and reads the condition", async () => {
    const s = await resolveTextSuggestion(
      {
        categories: [
          { code: "C2", confidence: 0.8 },
          { code: "C77", confidence: 0.9 },
        ],
        brandText: "zara",
        condition: " q1 ",
        colours: ["K3", "K42"],
      },
      catalog,
      matcher,
    );
    expect(s).toEqual({
      categories: [{ id: "cat-jeans", confidence: 0.8 }],
      brand: { id: "brand-zara", name: "Zara" },
      conditionId: "cond-new",
      colourIds: ["col-blue"],
    });
  });

  it("drops a made up condition and copes with an empty answer", async () => {
    expect((await resolveTextSuggestion({ condition: "Q9" }, catalog, matcher)).conditionId).toBeNull();
    expect(await resolveTextSuggestion({}, catalog, matcher)).toEqual({
      categories: [],
      brand: null,
      conditionId: null,
      colourIds: [],
    });
  });
});

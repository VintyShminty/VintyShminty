import type { CategoryNode, ReferenceData } from "@vinty/shared";
import { describe, expect, it } from "vitest";
import type { BrandMatcher } from "./photo-assist.js";
import { searchMentionsSize, searchRulesIndex, understandByRules } from "./search-rules.js";

const name = (en: string, he: string) => ({ en, he });
const node = (id: string, en: string, he: string, children: CategoryNode[] = []): CategoryNode => ({
  id,
  slug: id,
  path: id,
  name: name(en, he),
  icon: null,
  isLeaf: children.length === 0,
  rules: {
    brand: "optional",
    size: "optional",
    condition: "optional",
    colour: "optional",
    material: "optional",
    pattern: "optional",
  },
  sizeGroupIds: [],
  defaultParcelSizeId: null,
  children,
});

const reference = {
  version: "v1",
  categories: [
    node("women", "Women", "נשים", [
      node("w-clothing", "Clothing", "ביגוד", [
        node("w-dresses", "Dresses", "שמלות", [node("w-mini", "Mini dresses", "שמלות מיני")]),
        node("w-jeans", "Jeans", "ג'ינסים"),
        node("w-blazers", "Blazers", "בלייזרים"),
      ]),
      node("w-shoes", "Shoes", "נעליים"),
      node("w-skirts", "Skirts", "חצאיות"),
    ]),
    node("men", "Men", "גברים", [
      node("m-clothing", "Clothing", "ביגוד", [node("m-jeans", "Jeans", "ג'ינסים")]),
      node("m-shoes", "Shoes", "נעליים"),
      node("m-suits", "Suits", "חליפות"),
    ]),
    node("kids", "Kids", "ילדים", [
      node("girls", "Girls' clothing", "בגדי בנות", [node("g-dresses", "Dresses", "שמלות")]),
      node("boys", "Boys' clothing", "בגדי בנים", [node("b-trousers", "Trousers", "מכנסיים")]),
    ]),
  ],
  colours: [
    { id: "k-red", slug: "red", name: name("Red", "אדום"), swatchHex: "#f00" },
    { id: "k-black", slug: "black", name: name("Black", "שחור"), swatchHex: "#000" },
    { id: "k-white", slug: "white", name: name("White", "לבן"), swatchHex: "#fff" },
    { id: "k-navy", slug: "navy", name: name("Dark blue", "כחול כהה"), swatchHex: "#003" },
    { id: "k-blue", slug: "blue", name: name("Blue", "כחול"), swatchHex: "#00f" },
  ],
  sizeGroups: [],
  conditions: [],
  materials: [],
  patterns: [],
} as unknown as ReferenceData;

const index = searchRulesIndex(reference);
const brands: Record<string, { id: string; name: string }> = {
  zara: { id: "b-zara", name: "Zara" },
  nike: { id: "b-nike", name: "Nike" },
  "levi's": { id: "b-levis", name: "Levi's" },
};
const matcher: BrandMatcher = {
  async match(text) {
    const key = text.toLowerCase();
    if (brands[key]) return brands[key];
    // Like the real one, it also matches the first words ("Nike Sportswear" finds Nike).
    return brands[key.split(" ")[0] ?? ""] ?? null;
  },
};
const run = (text: string) => understandByRules(text, index, matcher);

describe("search rules: prices", () => {
  it.each([
    ["blazer under 100", null, 10000],
    ["blazer below 100 shekels", null, 10000],
    ["blazer up to ₪250", null, 25000],
    ["blazer less than 80 nis", null, 8000],
    ["blazer max 60", null, 6000],
    ["בלייזר עד 100", null, 10000],
    ["בלייזר מתחת ל 100 שקל", null, 10000],
    ["בלייזר מתחת ל-100", null, 10000],
    ['בלייזר פחות מ 90 ש"ח', null, 9000],
    ["בלייזר פחות מ-90 ש״ח", null, 9000],
  ])("max: %s", async (text, min, max) => {
    const r = await run(text);
    expect(r?.priceMaxMinor).toBe(max);
    expect(r?.priceMinMinor).toBe(min);
    expect(r?.categoryId).toBe("w-blazers");
  });

  it.each([
    ["blazer over 50", 5000],
    ["blazer above 50 shekels", 5000],
    ["blazer from 50", 5000],
    ["blazer more than 50", 5000],
    ["בלייזר מעל 50", 5000],
    ["בלייזר יותר מ 50", 5000],
    ["בלייזר החל מ 50", 5000],
  ])("min: %s", async (text, min) => {
    const r = await run(text);
    expect(r?.priceMinMinor).toBe(min);
    expect(r?.priceMaxMinor).toBeNull();
  });

  it.each([
    ["blazer between 40 and 80", 4000, 8000],
    ["blazer 40-80 shekels", 4000, 8000],
    ["blazer 40 to 80 nis", 4000, 8000],
    ["בלייזר בין 40 ל 80", 4000, 8000],
    ["בלייזר בין 40 ל-80 שקלים", 4000, 8000],
    ["בלייזר בין 40 ו80", 4000, 8000],
  ])("range: %s", async (text, min, max) => {
    const r = await run(text);
    expect(r?.priceMinMinor).toBe(min);
    expect(r?.priceMaxMinor).toBe(max);
  });

  it("gives up on a bare number or a reversed range", async () => {
    expect(await run("blazer 100")).toBeNull();
    expect(await run("blazer between 90 and 40")).toBeNull();
    expect(await run("blazer under 100 under 50")).toBeNull();
  });
});

describe("search rules: colours", () => {
  it.each(["אדום", "אדומה", "אדומים", "אדומות", "ואדום", "red"])("understands red as %s", async (word) => {
    const r = await run(`${word} בלייזר עד 100`);
    expect(r?.colourIds).toEqual(["k-red"]);
  });

  it("understands black and white forms", async () => {
    for (const w of ["שחור", "שחורה", "שחורים", "שחורות"]) {
      expect((await run(`${w} בלייזרים עד 100`))?.colourIds).toEqual(["k-black"]);
    }
    for (const w of ["לבן", "לבנה", "לבנים", "לבנות"]) {
      expect((await run(`${w} בלייזרים עד 100`))?.colourIds).toEqual(["k-white"]);
    }
  });

  it("prefers a two word colour and takes several colours", async () => {
    expect((await run("בלייזר כחול כהה עד 100"))?.colourIds).toEqual(["k-navy"]);
    expect((await run("בלייזר כחולה עד 100"))?.colourIds).toEqual(["k-blue"]);
    expect((await run("red and black blazer under 100"))?.colourIds).toEqual(["k-red", "k-black"]);
    expect((await run("בלייזר אדומה ושחורה"))?.colourIds).toEqual(["k-red", "k-black"]);
  });
});

describe("search rules: categories", () => {
  it("matches singular and plural in both languages", async () => {
    expect((await run("red dress for women under 100"))?.categoryId).toBe("w-dresses");
    expect((await run("red dresses for women"))?.categoryId).toBe("w-dresses");
    expect((await run("שמלה אדומה לנשים"))?.categoryId).toBe("w-dresses");
    expect((await run("שמלות אדומות לנשים"))?.categoryId).toBe("w-dresses");
    expect((await run("black blazers under 100"))?.categoryId).toBe("w-blazers");
    expect((await run("בלייזר שחור עד 100"))?.categoryId).toBe("w-blazers");
    expect((await run("שחור נעל לנשים עד 100"))?.categoryId).toBe("w-shoes");
    expect((await run("נעליים לגברים עד 100"))?.categoryId).toBe("m-shoes");
  });

  it("uses the longer name first", async () => {
    expect((await run("red mini dresses under 100"))?.categoryId).toBe("w-mini");
    expect((await run("שמלות מיני אדומות"))?.categoryId).toBe("w-mini");
  });

  it("lets gender words choose the branch", async () => {
    expect((await run("women's jeans under 100"))?.categoryId).toBe("w-jeans");
    expect((await run("jeans for women under 100"))?.categoryId).toBe("w-jeans");
    expect((await run("men jeans under 100"))?.categoryId).toBe("m-jeans");
    expect((await run("ג'ינס לגברים עד 100"))?.categoryId).toBe("m-jeans");
    expect((await run("ג'ינסים לנשים"))?.categoryId).toBe("w-jeans");
    expect((await run("girls dresses under 100"))?.categoryId).toBe("g-dresses");
    expect((await run("שמלות לילדות עד 100"))?.categoryId).toBe("g-dresses");
    expect((await run("שמלה לילדה עד 100"))?.categoryId).toBe("g-dresses");
    expect((await run("kids dresses under 100"))?.categoryId).toBe("g-dresses");
    expect((await run("boys trousers under 100"))?.categoryId).toBe("b-trousers");
    expect((await run("מכנסיים לילד עד 100"))?.categoryId).toBe("b-trousers");
  });

  it("picks the top category for a gender word alone", async () => {
    expect(await run("red things for women")).toBeNull();
    expect((await run("red women under 100"))?.categoryId).toBe("women");
    expect((await run("אדום לגברים עד 100"))?.categoryId).toBe("men");
  });

  it("gives up when the name is in several branches and no gender decides", async () => {
    expect(await run("red dress for girls and women under 100")).toBeNull();
    expect(await run("black jeans under 100")).toBeNull();
    expect(await run("shoes under 100")).toBeNull();
    // A gender that has no such category.
    expect(await run("men dresses under 100")).toBeNull();
    // Dresses exist for women and girls: kids alone is fine (only girls have them), but two kinds of item is not.
    expect(await run("dresses jeans under 100")).toBeNull();
  });
});

describe("search rules: one adult branch decides", () => {
  it("takes Women when only the women's branch (and maybe kids) has the name", async () => {
    expect((await run("שמלה עד 100 שקל"))?.categoryId).toBe("w-dresses");
    expect((await run("red dress under 100"))?.categoryId).toBe("w-dresses");
    expect((await run("skirt under 50"))?.categoryId).toBe("w-skirts");
    // A Hebrew singular in ית finds its plural in יות.
    expect((await run("חצאית אדומה עד 80"))?.categoryId).toBe("w-skirts");
  });

  it("takes Men for a men only name and leaves kids only names to the AI", async () => {
    expect((await run("suits under 100"))?.categoryId).toBe("m-suits");
    expect(await run("trousers under 100")).toBeNull(); // boys only
  });

  it("still gives up when both adult branches have it", async () => {
    expect(await run("black jeans")).toBeNull();
    expect(await run("shoes under 100")).toBeNull();
  });
});

describe("search rules: brands, sorting and fillers", () => {
  it("understands a known brand written exactly", async () => {
    const r = await run("zara blazer under 100");
    expect(r?.brandIds).toEqual(["b-zara"]);
    expect(r?.brands).toEqual([{ id: "b-zara", name: "Zara" }]);
    expect((await run("Levi's jeans for women"))?.brandIds).toEqual(["b-levis"]);
  });

  it("does not take a brand the matcher only half matches", async () => {
    expect(await run("nike sportswear blazer under 100")).toBeNull();
    expect(await run("nikee blazer under 100")).toBeNull();
  });

  it("understands sort words", async () => {
    expect((await run("cheapest red blazer"))?.sort).toBe("price_asc");
    expect((await run("lowest price blazers for women"))?.sort).toBe("price_asc");
    expect((await run("הכי זול בלייזרים לנשים"))?.sort).toBe("price_asc");
    expect((await run("בלייזרים הזול ביותר לנשים"))?.sort).toBe("price_asc");
    expect((await run("most expensive blazers for women"))?.sort).toBe("price_desc");
    expect((await run("בלייזרים הכי יקר"))?.sort).toBe("price_desc");
    expect((await run("newest zara blazer"))?.sort).toBe("newest");
    expect((await run("just listed red blazers"))?.sort).toBe("newest");
    expect((await run("בלייזרים אדומות הכי חדשות"))?.sort).toBe("newest");
  });

  it("ignores filler words and strips Hebrew prefixes", async () => {
    const r = await run("I am looking for a red blazer under 100");
    expect(r).toBeNull(); // "am" is not a filler
    expect((await run("I want a red blazer under 100"))?.categoryId).toBe("w-blazers");
    expect((await run("אני מחפשת את הבלייזר האדומה עד 100"))?.colourIds).toEqual(["k-red"]);
    expect(await run("אני מחפשת בלייזר של זארה")).toBeNull();
  });

  it("returns the exact shape of the AI answer", async () => {
    expect(await run("red blazer under 100")).toEqual({
      understood: true,
      q: "",
      categoryId: "w-blazers",
      brandIds: [],
      brands: [],
      sizeIds: [],
      colourIds: ["k-red"],
      conditionIds: [],
      materialIds: [],
      patternIds: [],
      priceMinMinor: null,
      priceMaxMinor: 10000,
      sort: null,
    });
  });
});

describe("search rules: falls through to the AI", () => {
  it.each([
    "red summer dress under 100",
    "dress size 38",
    "שמלה מידה 38 עד 100",
    "jeans W32 for women",
    "new red dress under 100",
    "linen dress under 100",
    "שמלה חדשה עד 100",
    "stripy dress under 100",
    "air force 1 sneakers",
    "dress for my daughter",
    "dress xl under 100",
    "dress 100",
    "just under 100",
    "girls under 100",
  ])("%s", async (text) => {
    expect(await run(text)).toBeNull();
  });
});

describe("searchMentionsSize", () => {
  it.each([
    ["עד 100 שקל", false],
    ["red dress under 100", false],
    ["dress between 40 and 80 nis", false],
    ["dress 40-80 shekels", false],
    ["שמלה מתחת ל-100", false],
    ["שמלה אדומה", false],
    ["מידה 38", true],
    ["size 8 dress", true],
    ["jeans W32", true],
    ["dress xl under 100", true],
    ["dress M under 100", true],
    ["dress 3XL", true],
    ["coat for 8y", true],
    ["coat 18 months", true],
    ["nike 42", true],
    ["levis 501 under 100", true],
  ])("%s", (text, expected) => {
    expect(searchMentionsSize(text)).toBe(expected);
  });
});

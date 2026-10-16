import {
  type CategoryNode,
  EMPTY_SEARCH_UNDERSTANDING,
  type ReferenceData,
  type SearchUnderstanding,
} from "@vinty/shared";
import { type BrandMatcher, normaliseBrand } from "./photo-assist.js";

/**
 * Instant answers for simple searches (D-037): fixed rules, no AI. They answer only when EVERY word was understood
 * (a price phrase, a colour, a category, a gender word, a brand, a sort phrase or a filler word) and at least one
 * filter came out. Anything else, a size, a condition, a material, an unknown word, an ambiguous category, returns
 * null and the AI reads the search. Better to fall through than to guess.
 */

/** Whole shekels to minor units (agorot). Negative, odd or too large numbers are dropped. */
export function shekelsToMinor(value: number | null | undefined): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return null;
  const minor = Math.round(value) * 100;
  return minor <= 2_000_000_000 ? minor : null;
}

// ---------- Prices ----------

const CUR = "(?:₪|shekels?|nis|ils|שקלים|שקל|שח)";
const NUM = "(?:\\d{1,3}(?:,\\d{3})+|\\d+(?:\\.\\d+)?)";
const END = "(?![\\p{L}\\p{N}])";
const START = "(?<![\\p{L}\\p{N}])";
const amount = (name: string) => `(?:₪\\s*)?(?<${name}>${NUM})(?:\\s*${CUR}${END})?${END}`;

const RANGE_WITH_WORD = new RegExp(
  `${START}(?:between|from|בין)\\s+${amount("a")}\\s*(?:and|to|-|ל-?|ו-?|עד)\\s*${amount("b")}`,
  "giu",
);
const RANGE_WITH_CURRENCY = new RegExp(
  `${START}(?:₪\\s*)?(?<a>${NUM})\\s*(?:${CUR}\\s*)?(?:-|to)\\s*(?:₪\\s*)?(?<b>${NUM})\\s*${CUR}${END}`,
  "giu",
);
const MAX_WORDS =
  "(?:under|below|up\\s+to|upto|less\\s+than|max(?:imum)?|at\\s+most|no\\s+more\\s+than|cheaper\\s+than|עד|מתחת(?:\\s+ל-?)?|פחות\\s+מ-?|לא\\s+יותר\\s+מ-?|מקסימום)";
const MIN_WORDS =
  "(?:over|above|from|more\\s+than|at\\s+least|min(?:imum)?|starting\\s+(?:at|from)|מעל|יותר\\s+מ-?|החל\\s+מ-?|לפחות|מינימום)";
const MAX_RE = new RegExp(`${START}${MAX_WORDS}\\s*-?\\s*${amount("a")}`, "giu");
const MIN_RE = new RegExp(`${START}${MIN_WORDS}\\s*-?\\s*${amount("a")}`, "giu");
const BARE_PRICE = new RegExp(`${START}(?:(?:₪\\s*)?${NUM}\\s*${CUR}${END}|₪\\s*${NUM}${END})`, "giu");

const toNumber = (text: string | undefined) => Number((text ?? "").replace(/,/g, ""));

type Prices = { rest: string; min: number | null; max: number | null; conflict: boolean };

/** Cuts the price phrases out of the text and says what they meant. */
function takePrices(text: string): Prices {
  let rest = text;
  let min: number | null = null;
  let max: number | null = null;
  let conflict = false;
  const setMin = (n: number) => {
    if (min !== null) conflict = true;
    min = n;
  };
  const setMax = (n: number) => {
    if (max !== null) conflict = true;
    max = n;
  };

  for (const re of [RANGE_WITH_WORD, RANGE_WITH_CURRENCY]) {
    rest = rest.replace(re, (...args) => {
      const groups = args[args.length - 1] as { a: string; b: string };
      setMin(toNumber(groups.a));
      setMax(toNumber(groups.b));
      return " ";
    });
  }
  rest = rest.replace(MAX_RE, (...args) => {
    setMax(toNumber((args[args.length - 1] as { a: string }).a));
    return " ";
  });
  rest = rest.replace(MIN_RE, (...args) => {
    setMin(toNumber((args[args.length - 1] as { a: string }).a));
    return " ";
  });
  return { rest, min, max, conflict };
}

// ---------- Sizes ----------

/**
 * True when the words seem to name a size, so the AI needs the size lists: a number that is not a price, the word
 * size (or מידה), a letter size (S, XL, 3XL) as a whole word, W followed by digits (jeans W32) or an age (8y, 18m).
 */
export function searchMentionsSize(text: string): boolean {
  const lowered = clean(text);
  const withoutPrices = takePrices(lowered).rest.replace(BARE_PRICE, " ");
  if (/\p{Nd}/u.test(withoutPrices)) return true;
  if (/size|מידה|מידות|מידת/u.test(withoutPrices)) return true;
  return withoutPrices.split(/[^\p{L}\p{N}]+/u).some((word) => /^(?:[2-5]?x{0,3}[sl]|m)$/.test(word));
}

// ---------- Words ----------

const HEBREW = /[֐-׿]/;
const HEBREW_PREFIXES = "הובלמשכ";

/** Lower case, one kind of quote and dash. Apostrophes inside words stay. */
function clean(text: string): string {
  return text
    .normalize("NFC")
    .toLowerCase()
    .replace(/ש[”"״]ח/g, "שח")
    .replace(/[“”„]/g, '"')
    .replace(/[‘’`]/g, "'")
    .replace(/[–—]/g, "-");
}

/** A word without punctuation around it, without a trailing 's and without apostrophes inside ("women's" is "women"). */
function plain(token: string): string {
  return token
    .replace(/^[^\p{L}\p{N}₪&]+|[^\p{L}\p{N}₪&]+$/gu, "")
    .replace(/'s$/, "")
    .replace(/['׳"]/g, "");
}

const FINALS: Record<string, string> = { ם: "מ", ן: "נ", ץ: "צ", ף: "פ", ך: "כ" };

/**
 * One key for the forms of a word, so singular and plural, masculine and feminine meet: red/reds, dress/dresses,
 * אדום/אדומה/אדומים/אדומות. Both our names and the shopper's words go through it.
 */
function stem(word: string): string {
  if (HEBREW.test(word)) {
    let w = word.replace(/[םןץףך]/g, (c) => FINALS[c] ?? c);
    let cut = false;
    for (const ending of ["ות", "ימ", "ה"]) {
      if (w.endsWith(ending) && w.length - ending.length >= 2) {
        w = w.slice(0, -ending.length);
        cut = true;
        break;
      }
    }
    // A singular in ית meets its plural in יות: חצאית and חצאיות both become חצאי.
    if (!cut && w.endsWith("ית") && w.length >= 4) w = w.slice(0, -1);
    return w;
  }
  if (word.length > 3) {
    if (word.endsWith("ies")) return `${word.slice(0, -3)}y`;
    if (/(?:sses|ches|shes|xes|zes)$/.test(word)) return word.slice(0, -2);
    if (word.endsWith("s") && !word.endsWith("ss")) return word.slice(0, -1);
  }
  return word;
}

const stemPhrase = (words: string[]) => words.map(stem).join(" ");

/** The word as typed, then with Hebrew prefixes (ה, ו, ב, ל, מ, ש, כ, also stacked as in של or וה) taken off. */
function variants(word: string): string[] {
  const out = [word];
  if (!HEBREW.test(word)) return out;
  let current = word;
  for (let i = 0; i < 3; i++) {
    if (!HEBREW_PREFIXES.includes(current[0] ?? "") || current.length - 1 < 2) break;
    current = current.slice(1);
    out.push(current);
  }
  return out;
}

/** A few singular forms our category names do not have. */
const ALIASES: Record<string, string> = { נעל: "נעליים", גינס: "גינסים", מכנס: "מכנסיים" };

const wordsOf = (name: string) => clean(name).split(/\s+/).map(plain).filter(Boolean);

const FILLERS = new Set([
  // English
  ...["a", "an", "the", "for", "with", "in", "of", "i", "im", "i'm", "want", "looking", "look", "need"],
  ...["some", "nice", "cute", "and", "or", "to", "me", "my", "please", "find", "show", "get", "pretty", "im"],
  // Hebrew
  ...["את", "של", "עם", "אני", "מחפש", "מחפשת", "רוצה", "צריך", "צריכה", "יפה", "יפים", "יפות", "חמוד"],
  ...["חמודה", "חמודים", "חמודות", "בבקשה", "או", "גם", "לי", "שלי", "בשביל"],
]);

type Gender = "women" | "men" | "girls" | "boys" | "kids";
const GENDER_WORDS = new Map<string, Gender>([
  ...(["women", "woman", "womens", "ladies", "lady", "נשים", "אישה", "אשה", "נשית", "נשי"] as const).map(
    (w) => [w, "women"] as const,
  ),
  ...(["men", "man", "mens", "גברים", "גבר", "גברי"] as const).map((w) => [w, "men"] as const),
  ...(["girls", "girl", "בנות", "בת", "ילדה", "ילדות", "נערה", "נערות"] as const).map(
    (w) => [w, "girls"] as const,
  ),
  ...(["boys", "boy", "בנים", "בן", "ילד", "נער", "נערים"] as const).map((w) => [w, "boys"] as const),
  ...(["kids", "kid", "children", "child", "ילדים"] as const).map((w) => [w, "kids"] as const),
]);

type Sort = "price_asc" | "price_desc" | "newest";
const SORT_PHRASES: [string, Sort][] = [
  ["cheapest", "price_asc"],
  ["lowest price", "price_asc"],
  ["הכי זול", "price_asc"],
  ["זול ביותר", "price_asc"],
  ["most expensive", "price_desc"],
  ["highest price", "price_desc"],
  ["הכי יקר", "price_desc"],
  ["יקר ביותר", "price_desc"],
  ["newest", "newest"],
  ["just listed", "newest"],
  ["הכי חדש", "newest"],
  ["חדש ביותר", "newest"],
];

// ---------- The index of our names ----------

type CategoryHit = { id: string; depth: number; gender: Gender | null };
type Hit =
  | { kind: "category"; hits: CategoryHit[] }
  | { kind: "colour"; id: string }
  | { kind: "sort"; sort: Sort };

export type SearchRulesIndex = {
  /** Phrase keys (stemmed words joined by a space) to what they mean. */
  names: Map<string, Hit>;
  /** The top Women, Men and Kids categories, for "women" with nothing more. */
  genderRoots: Map<Gender, string>;
};

function genderOf(path: CategoryNode[]): Gender | null {
  const top = path[0]?.name.en.toLowerCase();
  if (top === "women") return "women";
  if (top === "men") return "men";
  if (top === "kids") {
    const second = path[1]?.name.en.toLowerCase() ?? "";
    if (second.startsWith("girl")) return "girls";
    if (second.startsWith("boy")) return "boys";
    return "kids";
  }
  return null;
}

const indexes = new WeakMap<ReferenceData, SearchRulesIndex>();

/** Builds (once per reference data) the lookup of category, colour and sort names in both languages. */
export function searchRulesIndex(reference: ReferenceData): SearchRulesIndex {
  const known = indexes.get(reference);
  if (known) return known;

  const names = new Map<string, Hit>();
  const genderRoots = new Map<Gender, string>();

  const add = (name: string, hit: Hit) => {
    const key = stemPhrase(wordsOf(name));
    if (!key) return;
    const existing = names.get(key);
    if (!existing) names.set(key, hit);
    else if (existing.kind === "category" && hit.kind === "category") existing.hits.push(...hit.hits);
    else names.set(key, { kind: "category", hits: [] }); // a colour and a category with one name: never guess
  };

  const walk = (nodes: CategoryNode[], parents: CategoryNode[]) => {
    for (const node of nodes) {
      // The Designer section repeats names like Dresses. It would make every such name look unclear, so the rules leave
      // it to the AI (a search that says "designer" falls through anyway, the word is unknown here).
      if (parents.length === 0 && node.slug === "designer") continue;
      const path = [...parents, node];
      const gender = genderOf(path);
      if (parents.length === 0 && gender && gender !== "girls" && gender !== "boys") {
        genderRoots.set(gender, node.id);
      } else {
        const hit: Hit = { kind: "category", hits: [{ id: node.id, depth: path.length, gender }] };
        add(node.name.en, hit);
        add(node.name.he, { kind: "category", hits: [{ id: node.id, depth: path.length, gender }] });
      }
      walk(node.children, path);
    }
  };
  walk(reference.categories, []);

  for (const colour of reference.colours) {
    add(colour.name.en, { kind: "colour", id: colour.id });
    add(colour.name.he, { kind: "colour", id: colour.id });
  }
  for (const [phrase, sort] of SORT_PHRASES) add(phrase, { kind: "sort", sort });

  const index = { names, genderRoots };
  indexes.set(reference, index);
  return index;
}

// ---------- The rules ----------

type Taken =
  | { kind: "category"; hits: CategoryHit[] }
  | { kind: "colour"; id: string }
  | { kind: "sort"; sort: Sort }
  | { kind: "gender"; gender: Gender }
  | { kind: "filler" };

/** Looks at the words from `at`: the longest phrase of our names first, then a single word. Null when it is unknown. */
function take(words: string[], at: number, index: SearchRulesIndex): { used: number; taken: Taken } | null {
  const first = words[at];
  if (first === undefined) return null;
  for (const start of variants(first)) {
    for (let n = Math.min(3, words.length - at); n >= 2; n--) {
      const key = stemPhrase([start, ...words.slice(at + 1, at + n)]);
      const hit = index.names.get(key);
      if (hit) return { used: n, taken: hit };
    }
    const alias = ALIASES[start] ?? start;
    const single = index.names.get(stem(alias));
    if (single) return { used: 1, taken: single };
    const gender = GENDER_WORDS.get(start);
    if (gender) return { used: 1, taken: { kind: "gender", gender } };
    if (FILLERS.has(start)) return { used: 1, taken: { kind: "filler" } };
  }
  return null;
}

const genderMatches = (wanted: Gender, has: Gender | null) =>
  has !== null && (wanted === has || (wanted === "kids" && (has === "girls" || has === "boys")));

/**
 * The one category the words mean, or null when it is unclear. With no gender word, a name found in several branches
 * is taken only when exactly one adult branch (Women or Men) has it. Kids-only names and names in both adult
 * branches are left to the AI.
 */
function chooseCategory(hits: CategoryHit[], gender: Gender | null): string | null {
  let candidates = gender ? hits.filter((h) => genderMatches(gender, h.gender)) : hits;
  if (candidates.length === 0) return null;
  const branches = new Set(candidates.map((h) => h.gender ?? "none"));
  if (!gender && (branches.size > 1 || !branches.has("none"))) {
    candidates = candidates.filter((h) => h.gender === "women" || h.gender === "men");
    if (candidates.length === 0 || (branches.has("none") && branches.size > 1)) return null;
  }
  if (new Set(candidates.map((h) => h.gender ?? "none")).size > 1) return null;
  const shallowest = Math.min(...candidates.map((h) => h.depth));
  const best = candidates.filter((h) => h.depth === shallowest);
  const ids = new Set(best.map((h) => h.id));
  return ids.size === 1 ? (best[0]?.id ?? null) : null;
}

/**
 * Tries to understand the search with fixed rules. Returns the same shape the AI gives, or null when any word is not
 * understood (the AI then reads it). Never throws on odd text.
 */
export async function understandByRules(
  text: string,
  index: SearchRulesIndex,
  brandMatcher: BrandMatcher,
): Promise<SearchUnderstanding | null> {
  const prices = takePrices(clean(text));
  if (prices.conflict) return null;
  const { min, max } = prices;
  if (min !== null && max !== null && min > max) return null;

  const rawWords = prices.rest.split(/\s+/).filter(Boolean);
  const words = rawWords.map(plain);

  let categoryHits: CategoryHit[] | null = null;
  let gender: Gender | null = null;
  const colourIds: string[] = [];
  let sort: Sort | null = null;
  const leftover: number[] = [];

  for (let i = 0; i < words.length; ) {
    const word = words[i];
    if (!word) {
      i += 1;
      continue;
    }
    const found = take(words, i, index);
    if (!found) {
      leftover.push(i);
      i += 1;
      continue;
    }
    const { taken } = found;
    i += found.used;
    switch (taken.kind) {
      case "category":
        if (categoryHits) return null; // two different kinds of item
        categoryHits = taken.hits;
        break;
      case "colour":
        if (!colourIds.includes(taken.id)) colourIds.push(taken.id);
        break;
      case "sort":
        if (sort && sort !== taken.sort) return null;
        sort = taken.sort;
        break;
      case "gender":
        if (gender && gender !== taken.gender) return null;
        gender = taken.gender;
        break;
      case "filler":
        break;
    }
  }
  if (colourIds.length > 3) return null;

  // Whatever is left must be a brand we know, written exactly (one or two words).
  const brands: { id: string; name: string }[] = [];
  for (let k = 0; k < leftover.length; ) {
    const at = leftover[k] as number;
    let matched: { id: string; name: string } | null = null;
    let used = 1;
    for (const size of [2, 1]) {
      const run = leftover.slice(k, k + size);
      const consecutive = run.length === size && run.every((p, j) => p === at + j);
      if (!consecutive) continue;
      const candidate = run
        .map((p) => (rawWords[p] ?? "").replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, ""))
        .join(" ");
      if (normaliseBrand(candidate).length < 2) continue;
      const found = await brandMatcher.match(candidate);
      if (found && normaliseBrand(found.name) === normaliseBrand(candidate)) {
        matched = found;
        used = size;
        break;
      }
    }
    if (!matched) return null;
    if (!brands.some((b) => b.id === matched?.id)) brands.push({ id: matched.id, name: matched.name });
    k += used;
  }
  if (brands.length > 2) return null;

  let categoryId: string | null = null;
  if (categoryHits) {
    categoryId = chooseCategory(categoryHits, gender);
    if (!categoryId) return null;
  } else if (gender) {
    categoryId = index.genderRoots.get(gender) ?? null;
    if (!categoryId) return null; // "girls" alone names no category
  }

  const priceMinMinor = shekelsToMinor(min);
  const priceMaxMinor = shekelsToMinor(max);
  if ((min !== null && priceMinMinor === null) || (max !== null && priceMaxMinor === null)) return null;

  const understood =
    categoryId !== null ||
    brands.length > 0 ||
    colourIds.length > 0 ||
    priceMinMinor !== null ||
    priceMaxMinor !== null ||
    sort !== null;
  if (!understood) return null;

  return {
    ...EMPTY_SEARCH_UNDERSTANDING,
    understood: true,
    categoryId,
    brandIds: brands.map((b) => b.id),
    brands,
    colourIds,
    priceMinMinor,
    priceMaxMinor,
    sort,
  };
}

// ---------- Category words in a plain word search ----------

const categoryWordIndexes = new WeakMap<readonly CategoryNode[], Map<string, string[]>>();

/** Each word of every category name (both languages, stemmed) to the categories that have it. Built once per tree. */
function categoryWordIndex(tree: readonly CategoryNode[]): Map<string, string[]> {
  const known = categoryWordIndexes.get(tree);
  if (known) return known;
  const words = new Map<string, string[]>();
  const walk = (nodes: readonly CategoryNode[]) => {
    for (const node of nodes) {
      for (const word of [...wordsOf(node.name.en), ...wordsOf(node.name.he)]) {
        if (word.length < 3 || FILLERS.has(word)) continue;
        const key = stem(word);
        const ids = words.get(key) ?? [];
        if (!ids.includes(node.id)) ids.push(node.id);
        words.set(key, ids);
      }
      walk(node.children);
    }
  };
  walk(tree);
  categoryWordIndexes.set(tree, words);
  return words;
}

/**
 * The categories a single search word names, so "shoes" or "נעליים" also finds every item listed under Shoes, not only
 * the ones with the word in the title. Singular and plural meet (נעל, נעליים) and Hebrew prefixes are taken off.
 * Empty when the word names no category.
 */
export function categoriesNamedBy(word: string, tree: readonly CategoryNode[]): string[] {
  const index = categoryWordIndex(tree);
  const ids = new Set<string>();
  for (const variant of variants(plain(clean(word)))) {
    if (variant.length < 3 || FILLERS.has(variant)) continue;
    for (const id of index.get(stem(ALIASES[variant] ?? variant)) ?? []) ids.add(id);
  }
  return [...ids];
}

import {
  type CategoryNode,
  EMPTY_SEARCH_UNDERSTANDING,
  LISTING_SORTS,
  type ReferenceData,
  type SearchUnderstanding,
} from "@vinty/shared";
import type { FastifyInstance } from "fastify";
import { type BrandMatcher, createBrandMatcher } from "./photo-assist.js";
import type { RawSearchReading, SearchReader } from "./search-reader.js";
import { searchMentionsSize, shekelsToMinor } from "./search-rules.js";

/** A condition meaning longer than this many characters is left out of the list. */
const SHORT_MEANING = 30;

export type SearchCatalogCodes = {
  /** The lists as text for the prompt. Identical until the reference data changes, so the prompt cache holds. */
  text: string;
  categories: Map<string, string>;
  colours: Map<string, string>;
  conditions: Map<string, string>;
  materials: Map<string, string>;
  patterns: Map<string, string>;
  sizes: Map<string, string>;
};

/**
 * Writes our lists as text for the search reader. Unlike the sell helpers it lists EVERY category, groups included,
 * because "dresses" means the whole Dresses group. One line per category as an indented tree, with its own English
 * and Hebrew name only ("    C3 Dresses | שמלות" under Women and Clothing), because shoppers type either language and
 * repeating whole paths made the list huge. The model answers with short codes and the server turns them back into ids.
 * The size lists are only written when `withSizes` is true (the words mention a size). Both variants are identical
 * text every time, so both stay in the prompt cache.
 */
export function buildSearchCatalog(reference: ReferenceData, withSizes = true): SearchCatalogCodes {
  const categories = new Map<string, string>();
  const colours = new Map<string, string>();
  const conditions = new Map<string, string>();
  const materials = new Map<string, string>();
  const patterns = new Map<string, string>();
  const sizes = new Map<string, string>();

  const lines: string[] = [
    "CATEGORIES (code name in English | name in Hebrew, indented under the group it belongs to)",
  ];
  let n = 0;
  const walk = (nodes: CategoryNode[], depth: number) => {
    for (const node of nodes) {
      n += 1;
      categories.set(`C${n}`, node.id);
      lines.push(`${"  ".repeat(depth)}C${n} ${node.name.en} | ${node.name.he}`);
      walk(node.children, depth + 1);
    }
  };
  walk(reference.categories, 0);

  const simple = (
    title: string,
    prefix: string,
    rows: { id: string; name: { en: string; he: string } }[],
    map: Map<string, string>,
  ) => {
    lines.push("", title);
    rows.forEach((row, i) => {
      map.set(`${prefix}${i + 1}`, row.id);
      lines.push(`${prefix}${i + 1}: ${row.name.en} | ${row.name.he}`);
    });
  };
  simple("COLOURS (code: English | Hebrew)", "K", reference.colours, colours);

  // Names only, plus the English meaning when it is short. Long meanings cost more than they help.
  lines.push("", "CONDITIONS (code: name, short meaning | Hebrew)");
  reference.conditions.forEach((c, i) => {
    conditions.set(`Q${i + 1}`, c.id);
    const meaning = c.description?.en?.trim();
    lines.push(
      `Q${i + 1}: ${c.name.en}${meaning && meaning.length <= SHORT_MEANING ? `, ${meaning}` : ""} | ${c.name.he}`,
    );
  });

  simple("MATERIALS (code: English | Hebrew)", "M", reference.materials, materials);
  simple("PATTERNS (code: English | Hebrew)", "P", reference.patterns, patterns);

  // Sizes by group, answered as "G6: 42". Codes per size (S120 next to a label 41) made the model pick a neighbour.
  if (withSizes) {
    lines.push("", "SIZE GROUPS (code: group: the sizes in it)");
    reference.sizeGroups.forEach((group, i) => {
      for (const size of group.sizes) sizes.set(sizeKey(`G${i + 1}`, size.label), size.id);
      lines.push(`G${i + 1}: ${group.name.en}: ${group.sizes.map((size) => size.label).join(", ")}`);
    });
  } else {
    lines.push("", "SIZES: no size list this time, so leave sizes empty.");
  }
  return { text: lines.join("\n"), categories, colours, conditions, materials, patterns, sizes };
}

const code = (text: string | null | undefined) => (text ?? "").trim().toUpperCase();
const cleanKeywords = (words: string[] | null | undefined) =>
  (words ?? [])
    .map((w) => w.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join(" ")
    .slice(0, 100)
    .trim();

/** Codes to ids: unknown codes dropped, repeats merged, no more than `max`. */
function pick(codes: string[] | null | undefined, map: Map<string, string>, max: number): string[] {
  const ids: string[] = [];
  for (const c of codes ?? []) {
    const id = map.get(code(c));
    if (id && !ids.includes(id)) ids.push(id);
    if (ids.length >= max) break;
  }
  return ids;
}

/** A size in the lookup: the group code and the label, upper case without spaces ("G6|42", "G8|8Y"). */
function sizeKey(group: string, label: string): string {
  return `${code(group)}|${label.toUpperCase().replace(/\s+/g, "")}`;
}

/** Sizes answered as "G6: 42". A label that is not in that group matches nothing. */
function pickSizes(answers: string[] | null | undefined, map: Map<string, string>, max: number): string[] {
  const ids: string[] = [];
  for (const answer of answers ?? []) {
    const at = answer.indexOf(":");
    if (at < 0) continue;
    const id = map.get(sizeKey(answer.slice(0, at), answer.slice(at + 1)));
    if (id && !ids.includes(id)) ids.push(id);
    if (ids.length >= max) break;
  }
  return ids;
}

/** Turns the model's raw answer into filters the app can trust. Anything not in our lists is dropped. */
export async function resolveSearchUnderstanding(
  raw: RawSearchReading,
  catalog: SearchCatalogCodes,
  brandMatcher: BrandMatcher,
): Promise<SearchUnderstanding> {
  const categoryId = raw.category ? (catalog.categories.get(code(raw.category)) ?? null) : null;

  // Only brands we know. A brand we do not have cannot filter, and the words are not worth searching for.
  const brandIds: string[] = [];
  const brands: { id: string; name: string }[] = [];
  for (const text of (raw.brands ?? []).slice(0, 2)) {
    const trimmed = text?.replace(/\s+/g, " ").trim().slice(0, 80);
    if (!trimmed) continue;
    const found = await brandMatcher.match(trimmed);
    if (found && !brandIds.includes(found.id)) {
      brandIds.push(found.id);
      brands.push({ id: found.id, name: found.name });
    }
  }

  let priceMinMinor = shekelsToMinor(raw.priceMin);
  let priceMaxMinor = shekelsToMinor(raw.priceMax);
  if (priceMinMinor !== null && priceMaxMinor !== null && priceMinMinor > priceMaxMinor) {
    [priceMinMinor, priceMaxMinor] = [priceMaxMinor, priceMinMinor];
  }

  const sortWord = raw.sort?.trim().toLowerCase();
  const sort = LISTING_SORTS.find((s) => s === sortWord && s !== "relevance") ?? null;

  const result: SearchUnderstanding = {
    understood: false,
    q: cleanKeywords(raw.keywords),
    categoryId,
    brandIds,
    brands,
    sizeIds: pickSizes(raw.sizes, catalog.sizes, 10),
    colourIds: pick(raw.colours, catalog.colours, 5),
    conditionIds: pick(raw.conditions, catalog.conditions, 5),
    materialIds: pick(raw.materials, catalog.materials, 3),
    patternIds: pick(raw.patterns, catalog.patterns, 3),
    priceMinMinor,
    priceMaxMinor,
    sort,
  };
  result.understood =
    categoryId !== null ||
    brandIds.length > 0 ||
    result.sizeIds.length > 0 ||
    result.colourIds.length > 0 ||
    result.conditionIds.length > 0 ||
    result.materialIds.length > 0 ||
    result.patternIds.length > 0 ||
    priceMinMinor !== null ||
    priceMaxMinor !== null ||
    sort !== null;
  // Nothing turned into a filter: the app searches the exact words, so keywords alone would only drop words.
  return result.understood ? result : EMPTY_SEARCH_UNDERSTANDING;
}

const SEARCH_TIMEOUT_MS = 8_000;

/** Lower case, spaces collapsed. The language does not matter, the words are the same. */
export function normaliseSearchText(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

/**
 * Reads a search with a (metered) reader. Never throws: `ok` is false when it is off, refused by the AI meter, slow
 * (8 seconds) or wrong, and the understanding is then empty. Only ok answers are worth remembering. The shopper's
 * words are never logged.
 */
export function createSearchUnderstander(
  app: Pick<FastifyInstance, "db" | "reference">,
  reader: SearchReader,
  brandMatcher: BrandMatcher = createBrandMatcher(app.db),
) {
  // Two variants of the list, each built once per reference version: with the size groups and without.
  let catalogs: {
    version: string;
    withSizes?: SearchCatalogCodes;
    withoutSizes?: SearchCatalogCodes;
  } | null = null;

  return async function understand(input: {
    text: string;
    userId?: string;
    log: { info: (o: object, m: string) => void; warn: (o: object, m: string) => void };
  }): Promise<{ understanding: SearchUnderstanding; ok: boolean }> {
    const { text, userId, log } = input;
    const startedAt = Date.now();
    try {
      const reference = await app.reference.get();
      if (catalogs?.version !== reference.version) catalogs = { version: reference.version };
      const withSizes = searchMentionsSize(text);
      const slot = withSizes ? "withSizes" : "withoutSizes";
      const catalog = catalogs[slot] ?? buildSearchCatalog(reference, withSizes);
      catalogs[slot] = catalog;
      const { reading, usage } = await reader.read({
        text,
        catalog: catalog.text,
        ...(userId ? { userId } : {}),
        signal: AbortSignal.timeout(SEARCH_TIMEOUT_MS),
      });
      log.info(
        { ms: Date.now() - startedAt, source: "ai", sizes: withSizes, ...usage },
        "search helper read",
      );
      return {
        understanding: await resolveSearchUnderstanding(reading, catalog, brandMatcher),
        ok: true,
      };
    } catch (error) {
      log.warn(
        { ms: Date.now() - startedAt, source: "ai", error: error instanceof Error ? error.name : "unknown" },
        "search helper failed",
      );
      return { understanding: EMPTY_SEARCH_UNDERSTANDING, ok: false };
    }
  };
}

/** A small memory of answers: 500 phrases, each kept for 24 hours. Oldest out first. */
export class UnderstandingCache {
  private entries = new Map<string, { at: number; value: SearchUnderstanding }>();

  constructor(
    private readonly max = 500,
    private readonly ttlMs = 24 * 3_600_000,
    private readonly now: () => number = Date.now,
  ) {}

  get(key: string): SearchUnderstanding | undefined {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    if (this.now() - entry.at >= this.ttlMs) {
      this.entries.delete(key);
      return undefined;
    }
    // Touch: most recently used goes last.
    this.entries.delete(key);
    this.entries.set(key, entry);
    return entry.value;
  }

  set(key: string, value: SearchUnderstanding): void {
    this.entries.delete(key);
    this.entries.set(key, { at: this.now(), value });
    while (this.entries.size > this.max) {
      const oldest = this.entries.keys().next().value;
      if (oldest === undefined) break;
      this.entries.delete(oldest);
    }
  }
}

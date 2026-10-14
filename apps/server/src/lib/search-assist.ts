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
 * because "dresses" means the whole Dresses group. Names come in English and Hebrew ("C12: Women > Dresses | נשים >
 * שמלות") because shoppers type either. The model answers with short codes and the server turns them back into ids.
 */
export function buildSearchCatalog(reference: ReferenceData): SearchCatalogCodes {
  const categories = new Map<string, string>();
  const colours = new Map<string, string>();
  const conditions = new Map<string, string>();
  const materials = new Map<string, string>();
  const patterns = new Map<string, string>();
  const sizes = new Map<string, string>();

  const lines: string[] = ["CATEGORIES (code: path in English | path in Hebrew)"];
  let n = 0;
  const walk = (nodes: CategoryNode[], en: string[], he: string[]) => {
    for (const node of nodes) {
      const pathEn = [...en, node.name.en];
      const pathHe = [...he, node.name.he];
      n += 1;
      categories.set(`C${n}`, node.id);
      lines.push(`C${n}: ${pathEn.join(" > ")} | ${pathHe.join(" > ")}`);
      walk(node.children, pathEn, pathHe);
    }
  };
  walk(reference.categories, [], []);

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

  lines.push("", "CONDITIONS (code: name, meaning, in English | Hebrew)");
  reference.conditions.forEach((c, i) => {
    conditions.set(`Q${i + 1}`, c.id);
    const meaningEn = c.description?.en?.trim();
    const meaningHe = c.description?.he?.trim();
    lines.push(
      `Q${i + 1}: ${c.name.en}${meaningEn ? `, ${meaningEn}` : ""} | ${c.name.he}${meaningHe ? `, ${meaningHe}` : ""}`,
    );
  });

  simple("MATERIALS (code: English | Hebrew)", "M", reference.materials, materials);
  simple("PATTERNS (code: English | Hebrew)", "P", reference.patterns, patterns);

  lines.push("", "SIZES (code: size group: size)");
  let s = 0;
  for (const group of reference.sizeGroups) {
    for (const size of group.sizes) {
      s += 1;
      sizes.set(`S${s}`, size.id);
      lines.push(`S${s}: ${group.name.en}: ${size.label}`);
    }
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

/** Whole shekels from the model to minor units (agorot). Negative, odd or too large numbers are dropped. */
function shekelsToMinor(value: number | null | undefined): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return null;
  const minor = Math.round(value) * 100;
  return minor <= 2_000_000_000 ? minor : null;
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
    sizeIds: pick(raw.sizes, catalog.sizes, 10),
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
) {
  const brandMatcher = createBrandMatcher(app.db);
  let catalog: { version: string; value: SearchCatalogCodes } | null = null;

  return async function understand(input: {
    text: string;
    userId?: string;
    log: { info: (o: object, m: string) => void; warn: (o: object, m: string) => void };
  }): Promise<{ understanding: SearchUnderstanding; ok: boolean }> {
    const { text, userId, log } = input;
    const startedAt = Date.now();
    try {
      const reference = await app.reference.get();
      if (catalog?.version !== reference.version) {
        catalog = { version: reference.version, value: buildSearchCatalog(reference) };
      }
      const { reading, usage } = await reader.read({
        text,
        catalog: catalog.value.text,
        ...(userId ? { userId } : {}),
        signal: AbortSignal.timeout(SEARCH_TIMEOUT_MS),
      });
      log.info({ ms: Date.now() - startedAt, ...usage }, "search helper read");
      return {
        understanding: await resolveSearchUnderstanding(reading, catalog.value, brandMatcher),
        ok: true,
      };
    } catch (error) {
      log.warn(
        { ms: Date.now() - startedAt, error: error instanceof Error ? error.name : "unknown" },
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

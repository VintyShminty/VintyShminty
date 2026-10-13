import { brands, type Database } from "@vinty/db";
import {
  type CategoryNode,
  EMPTY_PHOTO_SUGGESTION,
  LISTING_COLOURS_MAX,
  LISTING_DESCRIPTION_MAX,
  LISTING_TITLE_MAX,
  PHOTO_ASSIST_MAX_CATEGORIES,
  type PhotoSuggestion,
  type ReferenceData,
} from "@vinty/shared";
import { eq } from "drizzle-orm";
import type { RawReading } from "./photo-reader.js";

type Db = NonNullable<Database["db"]>;

export type CatalogCodes = {
  /** The lists as text for the prompt. Identical until the reference data changes, so the prompt cache holds. */
  text: string;
  categories: Map<string, string>;
  colours: Map<string, string>;
  materials: Map<string, string>;
};

/**
 * Writes our leaf categories, colours and materials as text. The model answers with short codes (C12, K3, M2) and the
 * server turns them back into ids. Codes are cheaper than ids, and a made up code simply matches nothing.
 */
export function buildCatalog(reference: ReferenceData): CatalogCodes {
  const categories = new Map<string, string>();
  const colours = new Map<string, string>();
  const materials = new Map<string, string>();

  const lines: string[] = ["CATEGORIES (code: path)"];
  let n = 0;
  const walk = (nodes: CategoryNode[], trail: string[]) => {
    for (const node of nodes) {
      const path = [...trail, node.name.en];
      if (node.isLeaf) {
        n += 1;
        categories.set(`C${n}`, node.id);
        lines.push(`C${n}: ${path.join(" > ")}`);
      } else {
        walk(node.children, path);
      }
    }
  };
  walk(reference.categories, []);

  lines.push("", "COLOURS (code: name)");
  reference.colours.forEach((c, i) => {
    colours.set(`K${i + 1}`, c.id);
    lines.push(`K${i + 1}: ${c.name.en}`);
  });
  lines.push("", "MATERIALS (code: name)");
  reference.materials.forEach((m, i) => {
    materials.set(`M${i + 1}`, m.id);
    lines.push(`M${i + 1}: ${m.name.en}`);
  });
  return { text: lines.join("\n"), categories, colours, materials };
}

/** Lower case, no accents, no spaces or punctuation: "Ralph Lauren", "ralph-lauren" and "RÅLPH LAUREN" all match. */
export function normaliseBrand(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^\p{L}\p{N}]/gu, "");
}

export type BrandMatcher = {
  match(text: string): Promise<{ id: string; name: string } | null>;
};

/** Matches a brand read from a tag against our brands table, in memory (a few hundred rows, refreshed every 5 minutes). */
export function createBrandMatcher(db: Db, ttlMs = 5 * 60_000): BrandMatcher {
  let cached: { at: number; byKey: Map<string, { id: string; name: string }> } | null = null;
  const load = async () => {
    if (cached && Date.now() - cached.at < ttlMs) return cached.byKey;
    const rows = await db
      .select({ id: brands.id, name: brands.name })
      .from(brands)
      .where(eq(brands.isActive, true));
    const byKey = new Map<string, { id: string; name: string }>();
    for (const row of rows) {
      const key = normaliseBrand(row.name);
      if (key && !byKey.has(key)) byKey.set(key, row);
    }
    cached = { at: Date.now(), byKey };
    return byKey;
  };
  return {
    async match(text) {
      const byKey = await load();
      const exact = byKey.get(normaliseBrand(text));
      if (exact) return exact;
      // A tag often says more than the brand ("ZARA BASIC", "Nike Sportswear"). Try the first words alone, longest first.
      const words = text.split(/\s+/).filter(Boolean);
      for (let n = words.length - 1; n >= 1; n--) {
        const key = normaliseBrand(words.slice(0, n).join(" "));
        const found = key.length >= 3 ? byKey.get(key) : undefined;
        if (found) return found;
      }
      return null;
    },
  };
}

const clamp01 = (n: number | null | undefined) =>
  typeof n === "number" && Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0;
const cleanText = (text: string | null | undefined, max: number) => {
  const t = (text ?? "").replace(/\s+/g, " ").trim();
  return t ? t.slice(0, max) : null;
};
const code = (text: string | null | undefined) => (text ?? "").trim().toUpperCase();

/**
 * Turns the model's raw answer into a suggestion the app can trust. Anything that is not in our lists is dropped, and
 * a category guess without a confidence counts as unsure (0).
 */
export async function resolveSuggestion(
  raw: RawReading,
  catalog: CatalogCodes,
  brandMatcher: BrandMatcher,
): Promise<PhotoSuggestion> {
  // Up to 3 real leaf categories in the order the model gave them. Made up codes and repeats are dropped.
  const categories: PhotoSuggestion["categories"] = [];
  for (const guess of raw.categories ?? []) {
    const id = catalog.categories.get(code(guess.code));
    if (id && !categories.some((c) => c.id === id))
      categories.push({ id, confidence: clamp01(guess.confidence) });
    if (categories.length >= PHOTO_ASSIST_MAX_CATEGORIES) break;
  }

  const colourIds: string[] = [];
  for (const c of raw.colours ?? []) {
    const id = catalog.colours.get(code(c));
    if (id && !colourIds.includes(id)) colourIds.push(id);
    if (colourIds.length >= LISTING_COLOURS_MAX) break;
  }

  const materialId = catalog.materials.get(code(raw.material)) ?? null;

  let brand: PhotoSuggestion["brand"] = null;
  const brandText = cleanText(raw.brandText, 80);
  if (brandText) {
    const found = await brandMatcher.match(brandText);
    brand = found ? { id: found.id, name: found.name } : { id: null, name: brandText };
  }

  const suggestion: PhotoSuggestion = {
    categories,
    brand,
    colourIds,
    materialId,
    title: cleanText(raw.title, LISTING_TITLE_MAX),
    description: cleanText(raw.description, LISTING_DESCRIPTION_MAX),
  };
  return suggestion;
}

export { EMPTY_PHOTO_SUGGESTION };

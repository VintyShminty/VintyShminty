import { brands, type Database } from "@vinty/db";
import {
  type CategoryNode,
  EMPTY_PHOTO_SUGGESTION,
  LISTING_COLOURS_MAX,
  PHOTO_ASSIST_MAX_CATEGORIES,
  type PhotoSuggestion,
  type ReferenceData,
} from "@vinty/shared";
import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import type { PhotoMediaType, PhotoReader, RawReading } from "./photo-reader.js";

type Db = NonNullable<Database["db"]>;

/**
 * One short note for categories the model tends to mix up. It follows the category in the list, so the model reads
 * "Overshirts (a thick shirt worn open like a light jacket)". Keyed by slug without the first part, so one note
 * serves Women and Men. Every key must be a real leaf (a test checks it).
 */
export const PHOTO_HINTS: Record<string, string> = {
  "clothing-tops-button-up": "shirt with a collar and buttons down the front",
  "clothing-tops-blouses": "soft, dressy top, often loose or with ruffles, usually no collar stand",
  "clothing-tops-overshirts": "thick shirt worn open as a light jacket",
  "clothing-tops-tunics": "long top that reaches past the hips",
  "clothing-shirts-button-up": "shirt with a collar and buttons down the front, long sleeves",
  "clothing-shirts-short-sleeve": "button-up shirt with short sleeves",
  "clothing-shirts-overshirts": "thick shirt worn open as a light jacket",
  "clothing-sweatshirts-hoodies": "soft jersey with a hood, pulled over the head",
  "clothing-sweatshirts-sweatshirts": "soft jersey, no hood, round neck",
  "clothing-sweatshirts-zip-hoodies": "soft jersey with a hood and a front zip",
  "clothing-knitwear-jumpers": "knitted, pulled over the head",
  "clothing-knitwear-cardigans": "knitted, opens down the front",
  "clothing-jackets-other": "a jacket that fits none of the other jacket types",
  "clothing-jackets-utility": "workwear style jacket with big pockets, like a chore coat",
  "clothing-coats-wool": "long wool coat",
  "clothing-coats-puffer": "long quilted padded coat",
  "clothing-vests": "sleeveless layer worn over other clothes, such as a puffer vest",
  "clothing-sportswear-track-jackets": "zip-up sports jacket, part of a tracksuit",
  "clothing-sportswear-team-shirts": "football or team shirt with a crest or number",
  "clothing-jumpsuits-playsuits": "jumpsuit with short legs",
  "clothing-dresses-cocktail": "knee length party dress",
  "clothing-dresses-gowns": "floor length formal dress",
  "clothing-uniforms-military": "army surplus or military clothing",
};

/** The note for a leaf slug such as women-clothing-tops-overshirts, or undefined. */
export function photoHint(slug: string | undefined): string | undefined {
  if (!slug) return undefined;
  return PHOTO_HINTS[slug.slice(slug.indexOf("-") + 1)];
}

export type CatalogCodes = {
  /** The lists as text for the prompt. Identical until the reference data changes, so the prompt cache holds. */
  text: string;
  categories: Map<string, string>;
  colours: Map<string, string>;
};

/**
 * Writes our leaf categories and colours as text. The model answers with short codes (C12, K3) and the
 * server turns them back into ids. Codes are cheaper than ids, and a made up code simply matches nothing.
 */
export function buildCatalog(reference: ReferenceData): CatalogCodes {
  const categories = new Map<string, string>();
  const colours = new Map<string, string>();

  const lines: string[] = ["CATEGORIES (code: path)"];
  let n = 0;
  const walk = (nodes: CategoryNode[], trail: string[]) => {
    for (const node of nodes) {
      const path = [...trail, node.name.en];
      if (node.isLeaf) {
        n += 1;
        categories.set(`C${n}`, node.id);
        const hint = photoHint(node.slug);
        lines.push(`C${n}: ${path.join(" > ")}${hint ? ` (${hint})` : ""}`);
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
  return { text: lines.join("\n"), categories, colours };
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
    // Retired guesses, null for older app builds that still expect the keys.
    materialId: null,
    title: null,
    description: null,
  };
  return suggestion;
}

/** The API takes images up to 5 MB each. The app already shrinks photos to about 1 MB, so this is a safety net. */
const MAX_IMAGE_BYTES = 5_000_000;
const READ_TIMEOUT_MS = 15_000;

const MEDIA_TYPES: Record<string, PhotoMediaType> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

/**
 * Reads already uploaded photos with a (metered) photo reader and turns the answer into a suggestion. Shared by the
 * sell form's helper (routes/photo-assist.ts) and the admin listing upload (routes/admin-uploads.ts). It checks nothing
 * about who owns the keys, the caller does that first. Never throws: when the reader is off, refused by the AI meter,
 * slow or wrong, the answer is the empty suggestion.
 */
export function createPhotoSuggester(
  app: Pick<FastifyInstance, "db" | "storage" | "reference">,
  reader: PhotoReader,
) {
  const brandMatcher = createBrandMatcher(app.db);
  let catalog: { version: string; value: ReturnType<typeof buildCatalog> } | null = null;

  return async function suggest(input: {
    keys: string[];
    language: "en" | "he";
    userId: string;
    log: { info: (o: object, m: string) => void; warn: (o: object, m: string) => void };
  }): Promise<PhotoSuggestion> {
    const { keys, language, userId, log } = input;
    const startedAt = Date.now();
    try {
      const images = (
        await Promise.all(
          keys.map(async (key) => {
            const mediaType = MEDIA_TYPES[key.split(".").pop()?.toLowerCase() ?? ""];
            if (!mediaType) return null;
            const data = await app.storage.read(key, MAX_IMAGE_BYTES);
            return data ? { mediaType, data } : null;
          }),
        )
      ).filter((image): image is NonNullable<typeof image> => image !== null);
      if (images.length === 0) return EMPTY_PHOTO_SUGGESTION;

      const reference = await app.reference.get();
      if (catalog?.version !== reference.version) {
        catalog = { version: reference.version, value: buildCatalog(reference) };
      }
      const { reading, usage } = await reader.read({
        images,
        catalog: catalog.value.text,
        language,
        userId,
        signal: AbortSignal.timeout(READ_TIMEOUT_MS),
      });
      log.info({ photos: images.length, ms: Date.now() - startedAt, ...usage }, "photo helper read");
      return await resolveSuggestion(reading, catalog.value, brandMatcher);
    } catch (error) {
      // Never a 500: the form works without help. The error text can name the model, never the key or the photos.
      log.warn(
        { ms: Date.now() - startedAt, error: error instanceof Error ? error.name : "unknown" },
        "photo helper failed",
      );
      return EMPTY_PHOTO_SUGGESTION;
    }
  };
}

export { EMPTY_PHOTO_SUGGESTION };

import { brands, type Database } from "@vinty/db";
import {
  type CategoryNode,
  EMPTY_PHOTO_SUGGESTION,
  EMPTY_TEXT_SUGGESTION,
  hasHebrew,
  LISTING_COLOURS_MAX,
  PHOTO_ASSIST_MAX_CATEGORIES,
  PHOTO_TIP_KINDS,
  type PhotoCheck,
  type PhotoSuggestion,
  type PhotoTip,
  type PhotoTipKind,
  type ReferenceData,
  skeletonsMatch,
  skeletonsOf,
  type TextSuggestion,
} from "@vinty/shared";
import { and, desc, eq, or, sql } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import type { PhotoMediaType, PhotoReader, RawCheck, RawReading } from "./photo-reader.js";
import type { RawTextReading, TextReader } from "./text-reader.js";

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

/** The category and colour lists as text, plus the code maps. Shared by the photo catalog and the text catalog. */
function categoryAndColourLines(reference: ReferenceData) {
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
  return { lines, categories, colours };
}

/**
 * Writes our leaf categories and colours as text. The model answers with short codes (C12, K3) and the
 * server turns them back into ids. Codes are cheaper than ids, and a made up code simply matches nothing.
 */
export function buildCatalog(reference: ReferenceData): CatalogCodes {
  const { lines, categories, colours } = categoryAndColourLines(reference);
  return { text: lines.join("\n"), categories, colours };
}

export type TextCatalogCodes = CatalogCodes & { conditions: Map<string, string> };

/**
 * The same lists for the text helper, plus the conditions (Q1, Q2...) with their meaning, because words can say how
 * worn something is. The category and colour part is the same text as the photo catalog.
 */
export function buildTextCatalog(reference: ReferenceData): TextCatalogCodes {
  const { lines, categories, colours } = categoryAndColourLines(reference);
  const conditions = new Map<string, string>();
  lines.push("", "CONDITIONS (code: name, meaning)");
  reference.conditions.forEach((c, i) => {
    conditions.set(`Q${i + 1}`, c.id);
    const meaning = c.description?.en?.trim();
    lines.push(`Q${i + 1}: ${c.name.en}${meaning ? `, ${meaning}` : ""}`);
  });
  return { text: lines.join("\n"), categories, colours, conditions };
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

/** `exact` is true when the text IS one of the brand's names (English, Hebrew or an alias), in any capitals or spacing. */
export type BrandMatch = { id: string; name: string; exact?: boolean };

export type BrandMatcher = {
  /**
   * The brand the text names. Always tries the exact names first (English, Hebrew, aliases) and then the first words.
   * With `wholeOnly` the first-words step is skipped. With `fuzzy` it also forgives typos and spacing (pg_trgm) and reads Hebrew spellings of brands that have no Hebrew
   * name yet (by sound). Fuzzy costs a database query, so it is for searches, not for tags.
   */
  match(text: string, options?: { fuzzy?: boolean; wholeOnly?: boolean }): Promise<BrandMatch | null>;
};

/** A typo or a missing space still passes at this similarity (0 to 1, pg_trgm). */
const BRAND_SIMILARITY_MIN = 0.5;

type BrandRow = { id: string; name: string; nameHe: string | null; aliases: string[] };

/** Matches a text against our brands table, mostly in memory (a few hundred rows, refreshed every 5 minutes). */
export function createBrandMatcher(db: Db, ttlMs = 5 * 60_000): BrandMatcher {
  type Loaded = {
    at: number;
    byKey: Map<string, BrandMatch>;
    /** Sound skeletons of every Latin name and alias, for Hebrew spellings that no name or alias has. */
    sounds: { skeleton: string; brand: BrandMatch }[];
    fuzzy: Map<string, BrandMatch | null>;
  };
  let cached: Loaded | null = null;
  const load = async (): Promise<Loaded> => {
    if (cached && Date.now() - cached.at < ttlMs) return cached;
    const rows: BrandRow[] = await db
      .select({ id: brands.id, name: brands.name, nameHe: brands.nameHe, aliases: brands.aliases })
      .from(brands)
      .where(eq(brands.isActive, true));
    const byKey = new Map<string, BrandMatch>();
    const add = (text: string | null | undefined, row: BrandRow) => {
      const key = text ? normaliseBrand(text) : "";
      if (key && !byKey.has(key)) byKey.set(key, { id: row.id, name: row.name, exact: true });
    };
    // Real names first, so one brand's nickname never hides another brand's name.
    for (const row of rows) add(row.name, row);
    for (const row of rows) add(row.nameHe, row);
    for (const row of rows) for (const alias of row.aliases) add(alias, row);
    const sounds: Loaded["sounds"] = [];
    for (const row of rows) {
      for (const text of [row.name, ...row.aliases.filter((a) => !hasHebrew(a))]) {
        for (const skeleton of skeletonsOf(text)) {
          sounds.push({ skeleton, brand: { id: row.id, name: row.name } });
        }
      }
    }
    cached = { at: Date.now(), byKey, sounds, fuzzy: new Map() };
    return cached;
  };

  /** Typos and spacing: the closest name by trigram similarity, unless two brands are about as close. */
  const byTrigram = async (text: string): Promise<BrandMatch | null> => {
    const q = text.toLowerCase().replace(/\s+/g, " ").trim();
    const squeezed = q.replace(/\s/g, "");
    const score = sql<number>`greatest(
      similarity(lower(${brands.name}), ${q}),
      similarity(replace(lower(${brands.name}), ' ', ''), ${squeezed}),
      coalesce(similarity(lower(${brands.nameHe}), ${q}), 0)
    )`;
    const rows = await db
      .select({ id: brands.id, name: brands.name, score })
      .from(brands)
      .where(
        and(
          eq(brands.isActive, true),
          or(
            sql`lower(${brands.name}) % ${q}`,
            sql`replace(lower(${brands.name}), ' ', '') % ${squeezed}`,
            sql`lower(${brands.nameHe}) % ${q}`,
          ),
        ),
      )
      .orderBy(desc(score), desc(brands.popularity))
      .limit(2);
    const [best, next] = rows;
    if (!best || best.score < BRAND_SIMILARITY_MIN) return null;
    if (next && next.score >= best.score - 0.05) return null;
    return { id: best.id, name: best.name };
  };

  return {
    async match(text, options) {
      const data = await load();
      const exact = data.byKey.get(normaliseBrand(text));
      if (exact) return exact;
      // A tag often says more than the brand ("ZARA BASIC", "Nike Sportswear"). Try the first words alone, longest first.
      // `wholeOnly` skips that: a search for "zara dress" must not turn into "Zara" alone.
      const words = options?.wholeOnly ? [] : text.split(/\s+/).filter(Boolean);
      for (let n = words.length - 1; n >= 1; n--) {
        const key = normaliseBrand(words.slice(0, n).join(" "));
        const found = key.length >= 3 ? data.byKey.get(key) : undefined;
        if (found) return { id: found.id, name: found.name };
      }
      if (!options?.fuzzy) return null;

      const key = normaliseBrand(text);
      if (key.length < 3) return null;
      if (data.fuzzy.has(key)) return data.fuzzy.get(key) ?? null;
      let found: BrandMatch | null = null;
      if (hasHebrew(text)) {
        // No name or alias has this spelling: compare by sound, and only trust a single brand.
        const wanted = skeletonsOf(text)[0];
        const hits = new Map<string, BrandMatch>();
        if (wanted) {
          for (const sound of data.sounds) {
            if (skeletonsMatch(wanted, sound.skeleton)) hits.set(sound.brand.id, sound.brand);
          }
        }
        if (hits.size === 1) found = [...hits.values()][0] ?? null;
      }
      found ??= await byTrigram(text);
      if (data.fuzzy.size > 500) data.fuzzy.clear();
      data.fuzzy.set(key, found);
      return found;
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
 * Turns the photo numbers the model flagged (1 is the first photo sent) back into upload keys. `keys` are the keys
 * of the photos that were really sent, in order, so a photo that could not be read does not shift the numbers. Unknown
 * numbers and unknown issue kinds are dropped, repeats are merged, and the kinds come in the app's order.
 */
export function resolvePhotoTips(raw: RawCheck["photoIssues"], keys: string[]): PhotoTip[] {
  const found = new Map<string, Set<PhotoTipKind>>();
  for (const entry of raw ?? []) {
    const number = entry.photo;
    if (typeof number !== "number" || !Number.isInteger(number) || number < 1) continue;
    const key = keys[number - 1];
    if (!key) continue;
    for (const issue of entry.issues ?? []) {
      const kind = PHOTO_TIP_KINDS.find((k) => k === issue.trim().toLowerCase());
      if (!kind) continue;
      const set = found.get(key) ?? new Set<PhotoTipKind>();
      set.add(kind);
      found.set(key, set);
    }
  }
  const tips: PhotoTip[] = [];
  for (const key of keys) {
    const set = found.get(key);
    if (set) tips.push({ key, kinds: PHOTO_TIP_KINDS.filter((k) => set.has(k)) });
  }
  return tips;
}

/** Colour, category and brand of any answer that uses codes. Shared by the photo and text resolvers. */
async function resolveCommon(
  raw: Pick<RawReading, "categories" | "brandText" | "colours">,
  catalog: CatalogCodes,
  brandMatcher: BrandMatcher,
) {
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
  return { categories, colourIds, brand };
}

/**
 * Turns what the words said into a suggestion the app can trust. Same checks as for photos, plus the condition code.
 * `raw.condition` that is not in our list is dropped.
 */
export async function resolveTextSuggestion(
  raw: RawTextReading,
  catalog: TextCatalogCodes,
  brandMatcher: BrandMatcher,
): Promise<TextSuggestion> {
  const common = await resolveCommon(raw, catalog, brandMatcher);
  const conditionId = raw.condition ? (catalog.conditions.get(code(raw.condition)) ?? null) : null;
  return { ...common, conditionId };
}

/**
 * Turns the model's raw answer into a suggestion the app can trust. Anything that is not in our lists is dropped, and
 * a category guess without a confidence counts as unsure (0).
 */
export async function resolveSuggestion(
  raw: RawReading,
  catalog: CatalogCodes,
  brandMatcher: BrandMatcher,
  /** The upload keys of the photos that were sent, in order, to place the photo tips. */
  sentKeys: string[] = [],
): Promise<PhotoSuggestion> {
  // Up to 3 real leaf categories in the order the model gave them. Made up codes and repeats are dropped.
  const { categories, colourIds, brand } = await resolveCommon(raw, catalog, brandMatcher);

  const suggestion: PhotoSuggestion = {
    categories,
    brand,
    colourIds,
    // Retired guesses, null for older app builds that still expect the keys.
    materialId: null,
    title: null,
    description: null,
    photoTips: resolvePhotoTips(raw.photoIssues, sentKeys),
  };
  return suggestion;
}

/** The API takes images up to 5 MB each. The app already shrinks photos to about 1 MB, so this is a safety net. */
const MAX_IMAGE_BYTES = 5_000_000;
const READ_TIMEOUT_MS = 15_000;
const CHECK_TIMEOUT_MS = 10_000;
const TEXT_TIMEOUT_MS = 10_000;

const MEDIA_TYPES: Record<string, PhotoMediaType> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

/** Reads the photos from storage and keeps each one's key. Photos that are missing or not a known type are skipped. */
export async function loadImages(storage: FastifyInstance["storage"], keys: string[]) {
  const loaded = await Promise.all(
    keys.map(async (key) => {
      const mediaType = MEDIA_TYPES[key.split(".").pop()?.toLowerCase() ?? ""];
      if (!mediaType) return null;
      const data = await storage.read(key, MAX_IMAGE_BYTES);
      return data ? { key, mediaType, data } : null;
    }),
  );
  return loaded.filter((image): image is NonNullable<typeof image> => image !== null);
}

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
      const images = await loadImages(app.storage, keys);
      if (images.length === 0) return EMPTY_PHOTO_SUGGESTION;

      const reference = await app.reference.get();
      if (catalog?.version !== reference.version) {
        catalog = { version: reference.version, value: buildCatalog(reference) };
      }
      const { reading, usage } = await reader.read({
        images: images.map(({ mediaType, data }) => ({ mediaType, data })),
        catalog: catalog.value.text,
        language,
        userId,
        signal: AbortSignal.timeout(READ_TIMEOUT_MS),
      });
      log.info({ photos: images.length, ms: Date.now() - startedAt, ...usage }, "photo helper read");
      // The tips use the keys of the photos that were really sent, because unreadable ones were skipped.
      return await resolveSuggestion(
        reading,
        catalog.value,
        brandMatcher,
        images.map((image) => image.key),
      );
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

/**
 * Looks at photos added after the first read, for tips only (no categories, no catalog). Same promises as the suggester:
 * the caller checks ownership, and it never throws, any failure answers with no tips.
 */
export function createPhotoChecker(app: Pick<FastifyInstance, "storage">, reader: PhotoReader) {
  return async function check(input: {
    keys: string[];
    userId: string;
    log: { info: (o: object, m: string) => void; warn: (o: object, m: string) => void };
  }): Promise<PhotoCheck> {
    const { keys, userId, log } = input;
    const startedAt = Date.now();
    try {
      const images = await loadImages(app.storage, keys);
      if (images.length === 0) return { photoTips: [] };
      const { reading, usage } = await reader.check({
        images: images.map(({ mediaType, data }) => ({ mediaType, data })),
        userId,
        signal: AbortSignal.timeout(CHECK_TIMEOUT_MS),
      });
      log.info({ photos: images.length, ms: Date.now() - startedAt, ...usage }, "photo check read");
      return {
        photoTips: resolvePhotoTips(
          reading.photoIssues,
          images.map((image) => image.key),
        ),
      };
    } catch (error) {
      log.warn(
        { ms: Date.now() - startedAt, error: error instanceof Error ? error.name : "unknown" },
        "photo check failed",
      );
      return { photoTips: [] };
    }
  };
}

/**
 * Reads the title and description the seller typed with a (metered) text reader and turns the answer into a suggestion.
 * Never throws: off, refused by the AI meter, slow (10 seconds) or wrong all answer with the empty suggestion. The
 * seller's words are never logged.
 */
export function createTextSuggester(app: Pick<FastifyInstance, "db" | "reference">, reader: TextReader) {
  const brandMatcher = createBrandMatcher(app.db);
  let catalog: { version: string; value: TextCatalogCodes } | null = null;

  return async function suggest(input: {
    title: string;
    description: string;
    userId: string;
    log: { info: (o: object, m: string) => void; warn: (o: object, m: string) => void };
  }): Promise<TextSuggestion> {
    const { title, description, userId, log } = input;
    const startedAt = Date.now();
    try {
      const reference = await app.reference.get();
      if (catalog?.version !== reference.version) {
        catalog = { version: reference.version, value: buildTextCatalog(reference) };
      }
      const { reading, usage } = await reader.read({
        title,
        description,
        catalog: catalog.value.text,
        userId,
        signal: AbortSignal.timeout(TEXT_TIMEOUT_MS),
      });
      log.info({ ms: Date.now() - startedAt, ...usage }, "text helper read");
      return await resolveTextSuggestion(reading, catalog.value, brandMatcher);
    } catch (error) {
      log.warn(
        { ms: Date.now() - startedAt, error: error instanceof Error ? error.name : "unknown" },
        "text helper failed",
      );
      return EMPTY_TEXT_SUGGESTION;
    }
  };
}

export { EMPTY_PHOTO_SUGGESTION };

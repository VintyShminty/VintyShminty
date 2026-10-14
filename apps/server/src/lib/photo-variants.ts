import { listingPhotos } from "@vinty/db";
import { encode } from "blurhash";
import { and, eq, isNull, sql } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import sharp from "sharp";
import type { Storage } from "./storage.js";

/** Width of the small copy that cards and lists load. Cards are about 180 points wide, 480 stays sharp on 2x and 3x screens. */
export const CARD_WIDTH = 480;
const CARD_QUALITY = 75;
/** The biggest listing photo the server accepts, see MAX_UPLOAD_BYTES.listing_photo. */
const MAX_ORIGINAL_BYTES = 15_000_000;

/** Where the small copy of a photo lives. The same key always gives the same copy, so deleting needs no lookup. */
export function cardKeyFor(key: string): string {
  return `cards/${key.replace(/\.[a-z0-9]+$/i, "")}.webp`;
}

export type PhotoVariants = { card: Buffer; placeholder: string; width: number; height: number };

/**
 * Makes the small WebP copy and the tiny blurred preview (a blurhash string) from the original photo bytes.
 * Throws when the bytes are not an image sharp can read (for example a HEIC file).
 */
export async function makePhotoVariants(original: Buffer): Promise<PhotoVariants> {
  // rotate() applies the camera's orientation tag, so the copy is upright even without the tag.
  const base = sharp(original).rotate();
  const { data, info } = await base
    .clone()
    .resize({ width: CARD_WIDTH, withoutEnlargement: true })
    .webp({ quality: CARD_QUALITY })
    .toBuffer({ resolveWithObject: true });
  const small = await sharp(data)
    .resize(32, 32, { fit: "inside" })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const placeholder = encode(new Uint8ClampedArray(small.data), small.info.width, small.info.height, 4, 3);
  return { card: data, placeholder, width: info.width, height: info.height };
}

export type StoredVariants = { cardObjectKey: string; placeholder: string };

/**
 * Reads the stored original, writes its small copy and returns what to save on the photo row. Returns null when the
 * original could not be read (missing or too big) and "unreadable" when it is there but is not an image sharp can
 * open. Never throws for those, a photo without a copy still works, it just loads slowly.
 */
export async function storePhotoVariants(
  storage: Storage,
  key: string,
  contentType = "image/jpeg",
): Promise<StoredVariants | null | "unreadable"> {
  const original = await storage.read(key, MAX_ORIGINAL_BYTES);
  if (!original) return null;
  let variants: PhotoVariants;
  try {
    variants = await makePhotoVariants(original);
  } catch {
    return "unreadable";
  }
  const cardObjectKey = cardKeyFor(key);
  await storage.put(cardObjectKey, variants.card, "image/webp");
  // Photos uploaded before the cache header existed get it now.
  await storage.markImmutable(key, contentType);
  return { cardObjectKey, placeholder: variants.placeholder };
}

type Backfill = Pick<FastifyInstance, "db" | "storage" | "log">;

export type BackfillResult = { made: number; unreadable: number; skipped: number };

/**
 * Makes small copies and blurred previews for photos that do not have them yet, a few at a time. Stops when the
 * time budget is used, so a daily run stays well inside the host's limit. Safe to run twice.
 */
export async function backfillPhotoVariants(
  app: Backfill,
  { budgetMs = 8000, concurrency = 4, now = () => Date.now() } = {},
): Promise<BackfillResult> {
  const result: BackfillResult = { made: 0, unreadable: 0, skipped: 0 };
  const started = now();
  const tried = new Set<string>();
  while (now() - started < budgetMs) {
    // Random order so a photo that keeps failing cannot hold up the others.
    const rows = (await app.db
      .select({ id: listingPhotos.id, key: listingPhotos.objectKey, contentType: listingPhotos.contentType })
      .from(listingPhotos)
      .where(and(isNull(listingPhotos.cardObjectKey)))
      .orderBy(sql`random()`)
      .limit(concurrency * 2)) as { id: string; key: string; contentType: string }[];
    const batch = rows.filter((r) => !tried.has(r.id)).slice(0, concurrency);
    if (batch.length === 0) break;
    await Promise.all(
      batch.map(async (row) => {
        tried.add(row.id);
        try {
          const stored = await storePhotoVariants(app.storage, row.key, row.contentType);
          if (stored === null) {
            result.skipped++;
          } else if (stored === "unreadable") {
            // Mark it so the job does not try again: the card copy is the original itself.
            await app.db
              .update(listingPhotos)
              .set({ cardObjectKey: row.key })
              .where(eq(listingPhotos.id, row.id));
            result.unreadable++;
          } else {
            await app.db
              .update(listingPhotos)
              .set({ cardObjectKey: stored.cardObjectKey, placeholder: stored.placeholder })
              .where(eq(listingPhotos.id, row.id));
            result.made++;
          }
        } catch (err) {
          app.log.warn({ err, key: row.key }, "could not make a small copy of a photo");
          result.skipped++;
        }
      }),
    );
  }
  return result;
}

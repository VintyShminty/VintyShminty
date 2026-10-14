import { brands, type Database, listingColours, listingPhotos } from "@vinty/db";
import {
  findCategory,
  type ListingDraftInput,
  type ListingFieldErrors,
  type ListingPhotoInput,
  type ReferenceData,
  stripHiddenAttributes,
  validateListing,
} from "@vinty/shared";
import { and, eq, inArray } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { ApiError } from "./errors.js";
import type { ListingRow } from "./listings.js";
import { type StoredVariants, storePhotoVariants } from "./photo-variants.js";
import { keyBelongsToUser, MAX_UPLOAD_BYTES } from "./storage.js";

type Db = NonNullable<Database["db"]>;

/** Columns a listing write can set, after merging the request into what is saved. */
export type Merged = {
  title: string;
  description: string;
  categoryId: string | null;
  brandId: string | null;
  /** The seller's own text, only when there is no brandId. */
  brandName: string | null;
  sizeId: string | null;
  conditionId: string | null;
  materialId: string | null;
  patternId: string | null;
  parcelSizeId: string | null;
  priceMinor: number | null;
  currency: string;
  usedAiPhotos: boolean;
  colourIds: string[];
};

const pick = <T>(next: T | undefined, current: T): T => (next === undefined ? current : next);

/**
 * The one set of checks and writes behind creating and editing a listing. The sell routes (routes/listings.ts) and the
 * admin batch upload (routes/admin-uploads.ts) both use it, so an uploaded item passes exactly the rules a seller's does.
 */
export function createListingWriter({
  db,
  storage,
  log,
}: {
  db: Db;
  storage: FastifyInstance["storage"];
  log: { warn: (o: object, m: string) => void };
}) {
  const invalid = (fields: ListingFieldErrors | Record<string, string>) =>
    ApiError.invalid("Some fields are not valid", fields as Record<string, string>);

  /**
   * A photo list is accepted when every key is one the seller uploaded (their own folder) and the file is really in
   * storage and not too big, or the key is already on this listing. Returns the byte size of each new file.
   */
  async function checkPhotos(
    userId: string,
    photos: ListingPhotoInput[],
    existingKeys: string[],
  ): Promise<{ error?: string; sizes: Map<string, number>; variants: Map<string, StoredVariants> }> {
    const sizes = new Map<string, number>();
    const variants = new Map<string, StoredVariants>();
    const keys = photos.map((p) => p.key);
    if (new Set(keys).size !== keys.length)
      return { error: "validation.listing.photos.invalid", sizes, variants };
    const fresh = photos.filter((p) => !existingKeys.includes(p.key));
    for (const photo of fresh) {
      if (!keyBelongsToUser(photo.key, "listing_photo", userId)) {
        return { error: "validation.listing.photos.invalid", sizes, variants };
      }
    }
    const found = await Promise.all(fresh.map((p) => storage.size(p.key)));
    for (const [index, size] of found.entries()) {
      const photo = fresh[index] as ListingPhotoInput;
      if (size === null) return { error: "validation.listing.photos.invalid", sizes, variants };
      if (size > MAX_UPLOAD_BYTES.listing_photo)
        return { error: "validation.upload.tooBig", sizes, variants };
      sizes.set(photo.key, size);
    }
    if (fresh.length > 0) {
      // A key that already belongs to another listing cannot be reused.
      const [taken] = await db
        .select({ id: listingPhotos.id })
        .from(listingPhotos)
        .where(
          inArray(
            listingPhotos.objectKey,
            fresh.map((p) => p.key),
          ),
        )
        .limit(1);
      if (taken) return { error: "validation.listing.photos.invalid", sizes, variants };
      // The small copy and the blurred preview for each new photo. A photo that cannot be processed is saved
      // anyway, the daily photo job tries again.
      await Promise.all(
        fresh.map(async (photo) => {
          try {
            const stored = await storePhotoVariants(storage, photo.key, photo.contentType);
            if (stored && stored !== "unreadable") variants.set(photo.key, stored);
          } catch (err) {
            log.warn({ err, key: photo.key }, "could not make a small copy of a photo");
          }
        }),
      );
    }
    return { sizes, variants };
  }

  /**
   * Merges a request into the saved listing, drops rows the category hides, and runs the shared rules plus the
   * checks only the server can make (brand exists, photo files exist). Throws 400 with field keys.
   */
  async function prepare(
    userId: string,
    reference: ReferenceData,
    input: ListingDraftInput,
    current: { row: ListingRow; colourIds: string[]; photoKeys: string[] } | null,
    publish: boolean,
  ) {
    const base: Merged = current
      ? {
          title: current.row.title,
          description: current.row.description,
          categoryId: current.row.categoryId,
          brandId: current.row.brandId,
          brandName: current.row.brandId ? null : current.row.brandName,
          sizeId: current.row.sizeId,
          conditionId: current.row.conditionId,
          materialId: current.row.materialId,
          patternId: current.row.patternId,
          parcelSizeId: current.row.parcelSizeId,
          priceMinor: current.row.priceMinor,
          currency: current.row.currency,
          usedAiPhotos: current.row.usedAiPhotos,
          colourIds: current.colourIds,
        }
      : {
          title: "",
          description: "",
          categoryId: null,
          brandId: null,
          brandName: null,
          sizeId: null,
          conditionId: null,
          materialId: null,
          patternId: null,
          parcelSizeId: null,
          priceMinor: null,
          currency: "ILS",
          usedAiPhotos: false,
          colourIds: [],
        };
    let merged: Merged = {
      title: pick(input.title, base.title).trim(),
      description: pick(input.description, base.description).trim(),
      categoryId: pick(input.categoryId, base.categoryId),
      brandId: pick(input.brandId, base.brandId),
      brandName: null,
      sizeId: pick(input.sizeId, base.sizeId),
      conditionId: pick(input.conditionId, base.conditionId),
      materialId: pick(input.materialId, base.materialId),
      patternId: pick(input.patternId, base.patternId),
      parcelSizeId: pick(input.parcelSizeId, base.parcelSizeId),
      priceMinor: pick(input.priceMinor, base.priceMinor),
      currency: pick(input.currency, base.currency),
      usedAiPhotos: pick(input.usedAiPhotos, base.usedAiPhotos),
      colourIds: pick(input.colourIds, base.colourIds),
    };
    // A typed brand only counts when no listed brand is chosen. Changing the brand id alone clears an old typed one.
    if (!merged.brandId) {
      merged.brandName =
        input.brandName !== undefined ? input.brandName : input.brandId !== undefined ? null : base.brandName;
    }
    const category = merged.categoryId ? findCategory(reference.categories, merged.categoryId) : null;
    merged = stripHiddenAttributes(merged, category);

    const photos = input.photos;
    const photoCount = photos ? photos.length : (current?.photoKeys.length ?? 0);
    const fieldErrors: Record<string, string> = {
      ...validateListing({ ...merged, photoCount }, reference, { publish }),
    };
    if (!reference.currencies.some((c) => c.code === merged.currency)) {
      fieldErrors.priceMinor ??= "validation.listing.currency.invalid";
    }

    let brandName: string | null = null;
    if (merged.brandId) {
      const [brand] = await db
        .select({ name: brands.name })
        .from(brands)
        .where(and(eq(brands.id, merged.brandId), eq(brands.isActive, true)))
        .limit(1);
      if (brand) brandName = brand.name;
      else fieldErrors.brandId = "validation.listing.brand.invalid";
    } else if (merged.brandName) {
      brandName = merged.brandName;
    }

    let photoSizes = new Map<string, number>();
    let photoVariants = new Map<string, StoredVariants>();
    if (photos && !fieldErrors.photos) {
      const checked = await checkPhotos(userId, photos, current?.photoKeys ?? []);
      if (checked.error) fieldErrors.photos = checked.error;
      photoSizes = checked.sizes;
      photoVariants = checked.variants;
    }

    if (Object.keys(fieldErrors).length > 0) throw invalid(fieldErrors);
    return { merged, brandName, photos, photoSizes, photoVariants };
  }

  type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

  async function writePhotos(
    tx: Tx,
    listingId: string,
    photos: ListingPhotoInput[],
    sizes: Map<string, number>,
    variants: Map<string, StoredVariants>,
  ) {
    // Photos kept from before keep their small copy and preview.
    const before = new Map(
      (
        await tx
          .select({
            key: listingPhotos.objectKey,
            cardObjectKey: listingPhotos.cardObjectKey,
            placeholder: listingPhotos.placeholder,
          })
          .from(listingPhotos)
          .where(eq(listingPhotos.listingId, listingId))
      ).map((r) => [r.key, r]),
    );
    await tx.delete(listingPhotos).where(eq(listingPhotos.listingId, listingId));
    if (photos.length === 0) return;
    await tx.insert(listingPhotos).values(
      photos.map((p, position) => ({
        listingId,
        objectKey: p.key,
        width: p.width,
        height: p.height,
        contentType: p.contentType,
        byteSize: sizes.get(p.key) ?? p.byteSize ?? null,
        cardObjectKey: variants.get(p.key)?.cardObjectKey ?? before.get(p.key)?.cardObjectKey ?? null,
        placeholder:
          variants.get(p.key)?.placeholder ?? before.get(p.key)?.placeholder ?? p.placeholder ?? null,
        position,
      })),
    );
  }

  async function writeColours(tx: Tx, listingId: string, colourIds: string[]) {
    await tx.delete(listingColours).where(eq(listingColours.listingId, listingId));
    if (colourIds.length === 0) return;
    await tx
      .insert(listingColours)
      .values(colourIds.map((colourId, position) => ({ listingId, colourId, position })));
  }

  const columnsOf = (m: Merged, brandName: string | null) => ({
    title: m.title,
    description: m.description,
    categoryId: m.categoryId,
    brandId: m.brandId,
    brandName,
    sizeId: m.sizeId,
    conditionId: m.conditionId,
    materialId: m.materialId,
    patternId: m.patternId,
    parcelSizeId: m.parcelSizeId,
    priceMinor: m.priceMinor,
    currency: m.currency,
    usedAiPhotos: m.usedAiPhotos,
  });

  return { prepare, checkPhotos, writePhotos, writeColours, columnsOf };
}

import { type Database, listingColours, listingPhotos, listings, orderItems, profiles } from "@vinty/db";
import {
  buyerPriceMinor,
  categoryTrail,
  type ListingDetail,
  type MyListingCard,
  type Photo,
  type ReferenceData,
} from "@vinty/shared";
import { and, asc, eq, sql } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { loadPublicProfile } from "./profiles.js";

type Db = NonNullable<Database["db"]>;
export type ListingRow = typeof listings.$inferSelect;
type PhotoRow = typeof listingPhotos.$inferSelect;

/** The buyer protection rule for a currency, or none (the buyer then pays the item price). */
export function feeRuleFor(reference: Pick<ReferenceData, "feeRules">, currency: string) {
  return reference.feeRules.find((f) => f.currency === currency) ?? null;
}

/** Item price plus the protection fee. Null while a draft has no price yet. */
export function buyerPrice(
  reference: Pick<ReferenceData, "feeRules">,
  priceMinor: number | null,
  currency: string,
): number | null {
  if (priceMinor === null) return null;
  const rule = feeRuleFor(reference, currency);
  return rule ? buyerPriceMinor(priceMinor, rule) : priceMinor;
}

export function toPhoto(
  storage: FastifyInstance["storage"],
  row: Pick<PhotoRow, "objectKey" | "width" | "height" | "placeholder">,
): Photo {
  return {
    key: row.objectKey,
    url: storage.publicUrl(row.objectKey),
    width: row.width,
    height: row.height,
    placeholder: row.placeholder,
  };
}

/** Keeps the numbers on the seller's profile (Listings and Sold) true after any change of state. */
export async function refreshSellerCounts(db: Db, userId: string): Promise<void> {
  await db
    .update(profiles)
    .set({
      activeListingCount: sql`(select count(*)::int from ${listings} where ${listings.sellerId} = ${userId} and ${listings.status} = 'active')`,
      soldCount: sql`(select count(*)::int from ${listings} where ${listings.sellerId} = ${userId} and ${listings.status} = 'sold')`,
    })
    .where(eq(profiles.userId, userId));
}

/** A listing that belongs to this person, or null. Someone else's listing looks exactly like a missing one. */
export async function findOwnListing(db: Db, id: string, userId: string): Promise<ListingRow | null> {
  const [row] = await db
    .select()
    .from(listings)
    .where(and(eq(listings.id, id), eq(listings.sellerId, userId)))
    .limit(1);
  return row ?? null;
}

export async function hasOrders(db: Db, listingId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: orderItems.id })
    .from(orderItems)
    .where(eq(orderItems.listingId, listingId))
    .limit(1);
  return Boolean(row);
}

/** One listing in full, with names resolved from the reference data. */
export async function loadListingDetail(
  { db, storage }: Pick<FastifyInstance, "db" | "storage">,
  reference: ReferenceData,
  row: ListingRow,
  viewerId: string,
): Promise<ListingDetail> {
  const [photoRows, colourRows, seller] = await Promise.all([
    db
      .select()
      .from(listingPhotos)
      .where(eq(listingPhotos.listingId, row.id))
      .orderBy(asc(listingPhotos.position)),
    db
      .select({ colourId: listingColours.colourId })
      .from(listingColours)
      .where(eq(listingColours.listingId, row.id))
      .orderBy(asc(listingColours.position)),
    loadPublicProfile({ db, storage }, row.sellerId, viewerId),
  ]);

  const trail = row.categoryId ? categoryTrail(reference.categories, row.categoryId) : [];
  const leaf = trail.at(-1);
  const condition = reference.conditions.find((c) => c.id === row.conditionId);
  const material = reference.materials.find((m) => m.id === row.materialId);
  const pattern = reference.patterns.find((p) => p.id === row.patternId);
  const parcel = reference.parcelSizes.find((p) => p.id === row.parcelSizeId);
  let sizeRef: { id: string; label: string } | null = null;
  if (row.sizeId) {
    for (const group of reference.sizeGroups) {
      const found = group.sizes.find((s) => s.id === row.sizeId);
      if (found) sizeRef = { id: found.id, label: found.label };
    }
  }
  const colours = colourRows.flatMap((c) => {
    const found = reference.colours.find((x) => x.id === c.colourId);
    return found ? [{ id: found.id, slug: found.slug, name: found.name, swatchHex: found.swatchHex }] : [];
  });
  if (!seller) throw new Error("Seller profile is missing");
  const photos = photoRows.map((p) => toPhoto(storage, p));

  return {
    id: row.id,
    status: row.status,
    title: row.title,
    brandName: row.brandName,
    sizeLabel: sizeRef?.label ?? null,
    conditionSlug: condition?.slug ?? null,
    priceMinor: row.priceMinor,
    buyerPriceMinor: buyerPrice(reference, row.priceMinor, row.currency),
    previousPriceMinor: row.previousPriceMinor,
    currency: row.currency,
    cover: photos[0] ?? null,
    favouriteCount: row.favouriteCount,
    isBumped: Boolean(row.bumpedUntil && row.bumpedUntil > new Date()),
    description: row.description,
    category: leaf
      ? {
          id: leaf.id,
          path: leaf.path,
          name: leaf.name,
          breadcrumb: trail.map((n) => ({ id: n.id, slug: n.slug, name: n.name })),
        }
      : null,
    condition: condition ? { id: condition.id, slug: condition.slug, name: condition.name } : null,
    size: sizeRef,
    brand: row.brandId && row.brandName ? { id: row.brandId, name: row.brandName } : null,
    material: material ? { id: material.id, slug: material.slug, name: material.name } : null,
    pattern: pattern ? { id: pattern.id, slug: pattern.slug, name: pattern.name } : null,
    colours,
    photos,
    parcelSizeId: row.parcelSizeId,
    postageFromMinor: parcel?.priceMinor ?? null,
    usedAiPhotos: row.usedAiPhotos,
    viewCount: row.viewCount,
    publishedAt: row.publishedAt?.toISOString() ?? null,
    updatedAt: row.updatedAt.toISOString(),
    seller: {
      id: seller.id,
      username: seller.username,
      avatarUrl: seller.avatarUrl,
      ratingAverage: seller.ratingAverage,
      reviewCount: seller.reviewCount,
    },
    viewer: {
      isOwner: row.sellerId === viewerId,
      isFavourited: false,
      canBuy: false,
      canOffer: false,
      conversationId: null,
    },
  };
}

/** The card on the owner's own page. */
export function toMyCard(
  storage: FastifyInstance["storage"],
  reference: Pick<ReferenceData, "feeRules">,
  row: ListingRow,
  extra: {
    sizeLabel: string | null;
    conditionSlug: string | null;
    cover: Pick<PhotoRow, "objectKey" | "width" | "height" | "placeholder"> | null;
  },
): MyListingCard {
  return {
    id: row.id,
    status: row.status,
    title: row.title,
    brandName: row.brandName,
    sizeLabel: extra.sizeLabel,
    conditionSlug: extra.conditionSlug,
    priceMinor: row.priceMinor,
    buyerPriceMinor: buyerPrice(reference, row.priceMinor, row.currency),
    previousPriceMinor: row.previousPriceMinor,
    currency: row.currency,
    cover: extra.cover ? toPhoto(storage, extra.cover) : null,
    favouriteCount: row.favouriteCount,
    isBumped: Boolean(row.bumpedUntil && row.bumpedUntil > new Date()),
    viewCount: row.viewCount,
    publishedAt: row.publishedAt?.toISOString() ?? null,
    updatedAt: row.updatedAt.toISOString(),
  };
}

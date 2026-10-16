import {
  bundleDiscountTiers,
  bundleItems,
  bundles,
  listingPhotos,
  listings,
  parcelSizes,
  profiles,
  userSettings,
} from "@vinty/db";
import {
  type Bundle,
  type BundleLadder,
  bundleDiscountPercentFor,
  calculateOrderTotals,
  DEFAULT_BUNDLE_LADDER,
  DEFAULT_CURRENCY,
  nextBundleTier,
  type UpdateBundleLadderInput,
} from "@vinty/shared";
import { and, asc, eq, sql } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { loadSellerSummaries } from "./discovery.js";
import { ApiError } from "./errors.js";
import { isBlockedBetween } from "./messaging.js";

type App = FastifyInstance;
type BundleRecord = typeof bundles.$inferSelect;
type Reader = Pick<App["db"], "select">;

/**
 * A seller's ladder. Sellers who never saved steps get the default ladder, and a seller who switched bundles off
 * has an empty ladder, so the discount is 0 percent everywhere. The seller's own Settings screen passes
 * `keepSteps` to still see the saved steps while the switch is off.
 */
export async function loadBundleLadder(
  db: Reader,
  sellerId: string,
  keepSteps = false,
): Promise<BundleLadder> {
  const [[settings], rows] = await Promise.all([
    db
      .select({ on: userSettings.bundlesOn })
      .from(userSettings)
      .where(eq(userSettings.userId, sellerId))
      .limit(1),
    db
      .select({ minItems: bundleDiscountTiers.minItems, percentOff: bundleDiscountTiers.percentOff })
      .from(bundleDiscountTiers)
      .where(eq(bundleDiscountTiers.sellerId, sellerId))
      .orderBy(asc(bundleDiscountTiers.minItems)),
  ]);
  const on = settings?.on ?? true;
  const tiers = rows.length > 0 ? rows : DEFAULT_BUNDLE_LADDER.map((t) => ({ ...t }));
  return { on, tiers: on || keepSteps ? tiers : [] };
}

/** Replaces the seller's steps and the on switch in one go. */
export async function saveBundleLadder(app: App, sellerId: string, input: UpdateBundleLadderInput) {
  await app.db.transaction(async (tx) => {
    await tx
      .insert(userSettings)
      .values({ userId: sellerId, bundlesOn: input.on })
      .onConflictDoUpdate({
        target: userSettings.userId,
        set: { bundlesOn: input.on, updatedAt: new Date() },
      });
    await tx.delete(bundleDiscountTiers).where(eq(bundleDiscountTiers.sellerId, sellerId));
    await tx.insert(bundleDiscountTiers).values(input.tiers.map((t) => ({ sellerId, ...t })));
  });
  return loadBundleLadder(app.db, sellerId, true);
}

/** What the parcels cost: each item's own parcel added up, and the one parcel a bundle pays (the biggest). */
export async function bundlePostage(db: Reader, parcelSizeIds: (string | null)[]) {
  const ids = [...new Set(parcelSizeIds.flatMap((id) => (id ? [id] : [])))];
  if (ids.length === 0) return { separateMinor: 0, togetherMinor: 0 };
  const parcels = await db
    .select({ id: parcelSizes.id, priceMinor: parcelSizes.priceMinor })
    .from(parcelSizes)
    .where(sql`${parcelSizes.id} in ${ids}`);
  const price = new Map(parcels.map((p) => [p.id, p.priceMinor]));
  const each = parcelSizeIds.map((id) => (id ? (price.get(id) ?? 0) : 0));
  return { separateMinor: each.reduce((a, b) => a + b, 0), togetherMinor: Math.max(0, ...each) };
}

export async function ownBundle(app: App, bundleId: string, buyerId: string): Promise<BundleRecord> {
  const [row] = await app.db
    .select()
    .from(bundles)
    .where(and(eq(bundles.id, bundleId), eq(bundles.buyerId, buyerId)))
    .limit(1);
  if (!row) throw ApiError.notFound();
  return row;
}

/** A bundle with its items, the seller's ladder, the running discount and the prompt for the next step. */
export async function presentBundle(app: App, bundle: BundleRecord): Promise<Bundle> {
  const [rows, tiers, sellers] = await Promise.all([
    app.db
      .select({
        listingId: listings.id,
        title: listings.title,
        status: listings.status,
        priceMinor: listings.priceMinor,
        currency: listings.currency,
        reservedForUserId: listings.reservedForUserId,
        parcelSizeId: listings.parcelSizeId,
        coverKey: sql<
          string | null
        >`(select ${listingPhotos.objectKey} from ${listingPhotos} where ${listingPhotos.listingId} = ${listings.id} order by ${listingPhotos.position} asc limit 1)`,
      })
      .from(bundleItems)
      .innerJoin(listings, eq(listings.id, bundleItems.listingId))
      .where(eq(bundleItems.bundleId, bundle.id))
      .orderBy(asc(bundleItems.addedAt), asc(bundleItems.listingId)),
    loadBundleLadder(app.db, bundle.sellerId).then((l) => l.tiers),
    loadSellerSummaries(app, [bundle.sellerId]),
  ]);
  // Only items the buyer can still buy count towards the total.
  const buyable = rows.filter(
    (r) =>
      r.priceMinor !== null &&
      (r.status === "active" || (r.status === "reserved" && r.reservedForUserId === bundle.buyerId)),
  );
  const percent = bundleDiscountPercentFor(tiers, buyable.length);
  const postage = await bundlePostage(
    app.db,
    buyable.map((r) => r.parcelSizeId),
  );
  const totals = calculateOrderTotals({
    itemPricesMinor: buyable.map((r) => r.priceMinor as number),
    bundleDiscountPercent: percent,
    feeRule: { buyerFeeBasisPoints: 0, buyerFeeFixedMinor: 0 },
  });
  return {
    id: bundle.id,
    seller: sellers.get(bundle.sellerId) ?? {
      id: bundle.sellerId,
      username: null,
      avatarUrl: null,
      ratingAverage: null,
      reviewCount: 0,
    },
    status: bundle.status,
    currency: rows[0]?.currency ?? DEFAULT_CURRENCY,
    items: rows.map((r) => ({
      listingId: r.listingId,
      title: r.title,
      status: r.status,
      priceMinor: r.priceMinor ?? 0,
      photoUrl: r.coverKey ? app.storage.publicUrl(r.coverKey) : null,
    })),
    itemCount: buyable.length,
    subtotalMinor: totals.itemsSubtotalMinor,
    discountPercent: percent,
    discountMinor: totals.bundleDiscountMinor,
    netMinor: totals.itemsNetMinor,
    nextTier: nextBundleTier(tiers, buyable.length),
    tiers,
    postageSeparateMinor: postage.separateMinor,
    postageTogetherMinor: postage.togetherMinor,
  };
}

/** The open bundle this buyer already has with a seller, or null. Makes nothing. */
export async function findOpenBundle(app: App, buyerId: string, sellerId: string) {
  const [row] = await app.db
    .select()
    .from(bundles)
    .where(and(eq(bundles.buyerId, buyerId), eq(bundles.sellerId, sellerId), eq(bundles.status, "open")))
    .limit(1);
  return row ?? null;
}

/** The open bundle this buyer has with a seller, made now when there is none. */
export async function openBundle(
  app: App,
  buyerId: string,
  sellerId: string,
): Promise<{ bundle: BundleRecord; created: boolean }> {
  if (buyerId === sellerId) throw ApiError.forbidden("You cannot bundle your own items");
  const [seller] = await app.db
    .select({ deletedAt: profiles.deletedAt })
    .from(profiles)
    .where(eq(profiles.userId, sellerId))
    .limit(1);
  if (!seller || seller.deletedAt) throw ApiError.notFound();
  if (await isBlockedBetween(app, buyerId, sellerId)) {
    throw new ApiError(403, "blocked", "You cannot buy from this person");
  }
  const find = async () =>
    (
      await app.db
        .select()
        .from(bundles)
        .where(and(eq(bundles.buyerId, buyerId), eq(bundles.sellerId, sellerId), eq(bundles.status, "open")))
        .limit(1)
    )[0];
  const existing = await find();
  if (existing) return { bundle: existing, created: false };
  const [created] = await app.db.insert(bundles).values({ buyerId, sellerId }).returning();
  if (!created) throw new Error("Bundle was not saved");
  return { bundle: created, created: true };
}

export async function addBundleItem(app: App, bundle: BundleRecord, listingId: string): Promise<void> {
  if (bundle.status !== "open") throw new ApiError(409, "invalid_transition", "This bundle is closed");
  const [listing] = await app.db.select().from(listings).where(eq(listings.id, listingId)).limit(1);
  if (!listing || listing.status === "draft" || listing.status === "hidden" || listing.status === "removed") {
    throw ApiError.notFound();
  }
  if (listing.sellerId !== bundle.sellerId) {
    throw ApiError.conflict("A bundle is made of one seller's items");
  }
  const heldForBuyer = listing.status === "reserved" && listing.reservedForUserId === bundle.buyerId;
  if (listing.status !== "active" && !heldForBuyer) {
    throw new ApiError(409, "listing_unavailable", "This item is not available");
  }
  await app.db.insert(bundleItems).values({ bundleId: bundle.id, listingId }).onConflictDoNothing();
  await app.db.update(bundles).set({ updatedAt: new Date() }).where(eq(bundles.id, bundle.id));
}

export async function removeBundleItem(app: App, bundle: BundleRecord, listingId: string): Promise<void> {
  if (bundle.status !== "open") throw new ApiError(409, "invalid_transition", "This bundle is closed");
  await app.db
    .delete(bundleItems)
    .where(and(eq(bundleItems.bundleId, bundle.id), eq(bundleItems.listingId, listingId)));
  await app.db.update(bundles).set({ updatedAt: new Date() }).where(eq(bundles.id, bundle.id));
}

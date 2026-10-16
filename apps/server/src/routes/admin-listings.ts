import { waitUntil } from "@vercel/functions";
import { listingColours, listingPhotos, listingPriceHistory, listings, users } from "@vinty/db";
import {
  adminListingStatusInputSchema,
  adminListingsPageSchema,
  adminListingsQuerySchema,
  adminUploadRequestSchema,
  cropPhotoInputSchema,
  errorResponseSchema,
  idSchema,
  listingDetailSchema,
  listingDraftInputSchema,
  rotatePhotoInputSchema,
  rotatePhotoResponseSchema,
  uploadResponseSchema,
} from "@vinty/shared";
import { and, asc, desc, eq, ne, sql } from "drizzle-orm";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { type Db, likePattern, writeAudit } from "../lib/admin.js";
import { ApiError } from "../lib/errors.js";
import { keysetCursor, olderThan, tsText } from "../lib/keyset.js";
import { createListingWriter } from "../lib/listing-write.js";
import { type ListingRow, loadListingDetail, refreshSellerCounts } from "../lib/listings.js";
import { cropStoredPhoto, rotateStoredPhoto } from "../lib/photo-edit.js";
import { cardKeyFor } from "../lib/photo-variants.js";
import { keyBelongsToUser, presignUploadResponse } from "../lib/storage.js";

const errors = {
  400: errorResponseSchema,
  401: errorResponseSchema,
  403: errorResponseSchema,
  404: errorResponseSchema,
  409: errorResponseSchema,
};
const idParams = z.object({ id: idSchema });

type Deps = {
  db: Db;
  preHandler: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  adminIdOf: (request: { session: { user: { id: string } } | null }) => string;
};

/**
 * Editing any listing from the admin panel (docs/blueprint/api.md, "Admin panel, edit listings"). Called from
 * routes/admin.ts, so it shares the admin guard. The edit runs through the same writer and rules as a seller's own edit
 * (lib/listing-write.ts), with the listing's seller standing in as the owner of its photo folder, and every change writes
 * an `admin_actions` row in the same transaction.
 */
export function registerAdminListingRoutes(app: FastifyInstance, { db, preHandler, adminIdOf }: Deps) {
  const rateLimit = { rateLimit: { max: 120, timeWindow: "1 minute" } };
  const typed = app.withTypeProvider<import("fastify-type-provider-zod").ZodTypeProvider>();
  const { prepare, writePhotos, writeColours, columnsOf } = createListingWriter({
    db,
    storage: app.storage,
    log: app.log,
  });

  async function findListing(id: string): Promise<ListingRow> {
    const [row] = await db.select().from(listings).where(eq(listings.id, id)).limit(1);
    if (!row || row.status === "draft") throw ApiError.notFound();
    return row;
  }

  async function detail(row: ListingRow, adminId: string) {
    const reference = await app.reference.get();
    const [fresh] = await db.select().from(listings).where(eq(listings.id, row.id)).limit(1);
    return loadListingDetail(app, reference, fresh as ListingRow, adminId);
  }

  async function currentOf(id: string) {
    const [colours, photos] = await Promise.all([
      db
        .select({ id: listingColours.colourId })
        .from(listingColours)
        .where(eq(listingColours.listingId, id))
        .orderBy(asc(listingColours.position)),
      db
        .select({ key: listingPhotos.objectKey })
        .from(listingPhotos)
        .where(eq(listingPhotos.listingId, id))
        .orderBy(asc(listingPhotos.position)),
    ]);
    return { colourIds: colours.map((c) => c.id), photoKeys: photos.map((p) => p.key) };
  }

  // ---- Find ----

  typed.get(
    "/v1/admin/listings",
    {
      preHandler,
      config: rateLimit,
      schema: {
        querystring: adminListingsQuerySchema,
        response: { 200: adminListingsPageSchema, ...errors },
      },
    },
    async (request) => {
      const { q, cursor, limit } = request.query;
      const pattern = q ? likePattern(q) : null;
      const rows = await db
        .select({
          id: listings.id,
          title: listings.title,
          status: listings.status,
          statusReason: listings.statusReason,
          sellerId: listings.sellerId,
          sellerUsername: users.username,
          priceMinor: listings.priceMinor,
          currency: listings.currency,
          photoKey: listingPhotos.objectKey,
          cardKey: listingPhotos.cardObjectKey,
          cursorTs: tsText(listings.createdAt),
        })
        .from(listings)
        .innerJoin(users, eq(users.id, listings.sellerId))
        .leftJoin(listingPhotos, and(eq(listingPhotos.listingId, listings.id), eq(listingPhotos.position, 0)))
        .where(
          and(
            ne(listings.status, "draft"),
            olderThan(cursor, listings.createdAt, listings.id),
            pattern
              ? sql`(${listings.title} ilike ${pattern} or ${users.username} ilike ${pattern})`
              : undefined,
          ),
        )
        .orderBy(desc(listings.createdAt), desc(listings.id))
        .limit(limit + 1);
      const page = rows.slice(0, limit);
      const last = page.at(-1);
      return {
        items: page.map(({ photoKey, cardKey, cursorTs, ...r }) => ({
          ...r,
          photoUrl: photoKey ? app.storage.publicUrl(cardKey ?? photoKey) : null,
          createdAt: new Date(cursorTs).toISOString(),
        })),
        nextCursor: rows.length > limit && last ? keysetCursor(last.cursorTs, last.id) : null,
      };
    },
  );

  typed.get(
    "/v1/admin/listings/:id",
    {
      preHandler,
      config: rateLimit,
      schema: { params: idParams, response: { 200: listingDetailSchema, ...errors } },
    },
    async (request) => detail(await findListing(request.params.id), adminIdOf(request)),
  );

  // ---- Photos go into the seller's own folder, so the normal photo rules (own folder, size) still hold ----

  typed.post(
    "/v1/admin/listings/:id/uploads",
    {
      preHandler,
      config: { rateLimit: { max: 600, timeWindow: "1 minute" } },
      schema: {
        params: idParams,
        body: adminUploadRequestSchema,
        response: { 200: uploadResponseSchema, ...errors },
      },
    },
    async (request) => {
      const row = await findListing(request.params.id);
      const { contentType, byteSize } = request.body;
      return presignUploadResponse(app.storage, {
        userId: row.sellerId,
        purpose: "listing_photo",
        contentType,
        byteSize,
      });
    },
  );

  /** The photo must sit in the listing's seller folder, the same rule as the listing's own edit. */
  async function photoOfListing(listingId: string, key: string) {
    const row = await findListing(listingId);
    if (!keyBelongsToUser(key, "listing_photo", row.sellerId)) {
      throw ApiError.invalid("That photo does not belong to this listing's seller", {
        key: "validation.listing.photos.invalid",
      });
    }
    return row;
  }

  typed.post(
    "/v1/admin/listings/:id/photos/rotate",
    {
      preHandler,
      config: rateLimit,
      schema: {
        params: idParams,
        body: rotatePhotoInputSchema,
        response: { 200: rotatePhotoResponseSchema, ...errors },
      },
    },
    async (request) => {
      const row = await photoOfListing(request.params.id, request.body.key);
      const { key, direction } = request.body;
      const turned = await rotateStoredPhoto(app.storage, key, direction);
      await writeAudit(db, adminIdOf(request), "listing_photo_rotated", "listing", row.id, {
        sellerId: row.sellerId,
        from: key,
        to: turned.key,
        direction,
      });
      return turned;
    },
  );

  typed.post(
    "/v1/admin/listings/:id/photos/crop",
    {
      preHandler,
      config: rateLimit,
      schema: {
        params: idParams,
        body: cropPhotoInputSchema,
        response: { 200: rotatePhotoResponseSchema, ...errors },
      },
    },
    async (request) => {
      const { key, x, y, width, height } = request.body;
      const row = await photoOfListing(request.params.id, key);
      const cut = await cropStoredPhoto(app.storage, key, { x, y, width, height });
      await writeAudit(db, adminIdOf(request), "listing_photo_cropped", "listing", row.id, {
        sellerId: row.sellerId,
        from: key,
        to: cut.key,
        rect: { x, y, width, height },
      });
      return cut;
    },
  );

  // ---- Edit ----

  typed.patch(
    "/v1/admin/listings/:id",
    {
      preHandler,
      config: rateLimit,
      schema: {
        params: idParams,
        body: listingDraftInputSchema,
        response: { 200: listingDetailSchema, ...errors },
      },
    },
    async (request) => {
      const adminId = adminIdOf(request);
      const row = await findListing(request.params.id);
      if (row.status === "sold") throw ApiError.conflict("A sold listing cannot be edited");
      const reference = await app.reference.get();
      const { colourIds, photoKeys } = await currentOf(row.id);
      // A listing that is up for sale stays complete, the same as when its seller edits it.
      const { merged, brandName, photos, photoSizes, photoVariants } = await prepare(
        row.sellerId,
        reference,
        request.body,
        { row, colourIds, photoKeys },
        true,
      );

      const next = columnsOf(merged, brandName);
      const changed = (Object.keys(next) as (keyof typeof next)[]).filter((k) => next[k] !== row[k]);
      if (merged.colourIds.join("|") !== colourIds.join("|")) changed.push("colourIds" as never);
      const newKeys = photos?.map((p) => p.key);
      if (newKeys && newKeys.join("|") !== photoKeys.join("|")) changed.push("photos" as never);

      const priceChanged =
        row.priceMinor !== null && merged.priceMinor !== null && merged.priceMinor !== row.priceMinor;
      const lowered = priceChanged && (merged.priceMinor as number) < (row.priceMinor as number);

      await db.transaction(async (tx) => {
        await tx
          .update(listings)
          .set({
            ...next,
            ...(priceChanged ? { previousPriceMinor: lowered ? row.priceMinor : null } : {}),
          })
          .where(eq(listings.id, row.id));
        if (priceChanged) {
          await tx.insert(listingPriceHistory).values({
            listingId: row.id,
            oldPriceMinor: row.priceMinor as number,
            newPriceMinor: merged.priceMinor as number,
          });
        }
        await writeColours(tx, row.id, merged.colourIds);
        if (photos) await writePhotos(tx, row.id, photos, photoSizes, photoVariants);
        await writeAudit(tx, adminId, "listing_edited", "listing", row.id, {
          title: row.title,
          sellerId: row.sellerId,
          changed,
          ...(priceChanged ? { priceFrom: row.priceMinor, priceTo: merged.priceMinor } : {}),
        });
      });

      if (photos) {
        const kept = new Set(photos.map((p) => p.key));
        for (const key of photoKeys.filter((k) => !kept.has(k))) {
          if (!keyBelongsToUser(key, "listing_photo", row.sellerId)) continue;
          waitUntil(
            app.storage.remove(key).catch((err) => app.log.warn({ err }, "could not delete a photo")),
          );
          waitUntil(app.storage.remove(cardKeyFor(key)).catch(() => undefined));
        }
      }
      return detail(row, adminId);
    },
  );

  // ---- Hide, remove, bring back ----

  typed.patch(
    "/v1/admin/listings/:id/status",
    {
      preHandler,
      config: rateLimit,
      schema: {
        params: idParams,
        body: adminListingStatusInputSchema,
        response: { 200: listingDetailSchema, ...errors },
      },
    },
    async (request) => {
      const adminId = adminIdOf(request);
      const row = await findListing(request.params.id);
      const { status, note } = request.body;
      if (row.status === status) return detail(row, adminId);
      if (row.status === "sold" || row.status === "reserved") {
        throw new ApiError(409, "invalid_transition", `A ${row.status} listing cannot be changed here`);
      }
      await db.transaction(async (tx) => {
        await tx
          .update(listings)
          .set({
            status,
            // Only a hidden or removed listing keeps a reason, which also stops the seller from putting it back live.
            statusReason: status === "active" ? null : (note ?? "Changed by our team"),
            reservedForUserId: null,
            reservedUntil: null,
          })
          .where(eq(listings.id, row.id));
        await writeAudit(tx, adminId, "listing_status_changed", "listing", row.id, {
          title: row.title,
          sellerId: row.sellerId,
          from: row.status,
          to: status,
          ...(note ? { note } : {}),
        });
      });
      await refreshSellerCounts(db, row.sellerId);
      return detail(row, adminId);
    },
  );
}

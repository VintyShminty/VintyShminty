import { waitUntil } from "@vercel/functions";
import { listingColours, listingPhotos, listingPriceHistory, listings, profiles } from "@vinty/db";
import {
  createListingInputSchema,
  errorResponseSchema,
  idSchema,
  listingDetailSchema,
  listingDraftInputSchema,
  MY_LISTING_STATUSES,
  type MyListingStatus,
  myListingsPageSchema,
  myListingsQuerySchema,
  replaceListingPhotosInputSchema,
  updateListingStatusInputSchema,
} from "@vinty/shared";
import { and, asc, desc, eq, lt, ne, or, sql } from "drizzle-orm";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import { decodeCursor, encodeCursor } from "../lib/cursor.js";
import { ApiError } from "../lib/errors.js";
import { createListingWriter } from "../lib/listing-write.js";
import {
  findOwnListing,
  hasOrders,
  type ListingRow,
  loadListingDetail,
  refreshSellerCounts,
  toMyCard,
} from "../lib/listings.js";
import { cardKeyFor } from "../lib/photo-variants.js";
import { keyBelongsToUser } from "../lib/storage.js";

const idParams = z.object({ id: idSchema });
const WRITE_LIMIT = { rateLimit: { max: 60, timeWindow: "1 minute" } };
const errors = {
  400: errorResponseSchema,
  401: errorResponseSchema,
  404: errorResponseSchema,
  409: errorResponseSchema,
};

/** Which state changes the seller may make by hand (docs/blueprint/data-model.md, Listing states). */
const MANUAL_TRANSITIONS: Record<string, readonly string[]> = {
  active: ["hidden", "reserved", "sold"],
  hidden: ["active"],
  reserved: ["active", "sold"],
};

/** Selling: create, edit, photos, publish, state changes, delete, and the owner's own list (Milestone 2). */
const listingRoutes: FastifyPluginAsyncZod = async (app) => {
  const { db, storage } = app;
  const preHandler = app.requireUser;

  const userIdOf = (request: { session: { user: { id: string } } | null }) => {
    if (!request.session) throw ApiError.unauthenticated();
    return request.session.user.id;
  };

  const { prepare, writePhotos, writeColours, columnsOf } = createListingWriter({
    db,
    storage,
    log: app.log,
  });

  async function ownOr404(id: string, userId: string): Promise<ListingRow> {
    const row = await findOwnListing(db, id, userId);
    if (!row || row.status === "removed") throw ApiError.notFound();
    return row;
  }

  async function colourIdsOf(listingId: string): Promise<string[]> {
    const rows = await db
      .select({ id: listingColours.colourId })
      .from(listingColours)
      .where(eq(listingColours.listingId, listingId))
      .orderBy(asc(listingColours.position));
    return rows.map((r) => r.id);
  }

  async function photoKeysOf(listingId: string): Promise<string[]> {
    const rows = await db
      .select({ key: listingPhotos.objectKey })
      .from(listingPhotos)
      .where(eq(listingPhotos.listingId, listingId))
      .orderBy(asc(listingPhotos.position));
    return rows.map((r) => r.key);
  }

  /** Files the seller uploaded that are no longer on any listing. Seed photos are never touched. */
  function removeFiles(userId: string, keys: string[], log: { warn: (o: object, m: string) => void }) {
    for (const key of keys) {
      if (!keyBelongsToUser(key, "listing_photo", userId)) continue;
      waitUntil(storage.remove(key).catch((err) => log.warn({ err }, "could not delete a listing photo")));
      waitUntil(storage.remove(cardKeyFor(key)).catch(() => undefined));
    }
  }

  async function respond(id: string, userId: string) {
    const reference = await app.reference.get();
    const row = await ownOr404(id, userId);
    return loadListingDetail(app, reference, row, userId);
  }

  // ---- Create ----

  app.post(
    "/v1/listings",
    {
      preHandler,
      config: WRITE_LIMIT,
      schema: { body: createListingInputSchema, response: { 201: listingDetailSchema, ...errors } },
    },
    async (request, reply) => {
      const userId = userIdOf(request);
      const { publish, ...input } = request.body;
      const reference = await app.reference.get();
      const { merged, brandName, photos, photoSizes, photoVariants } = await prepare(
        userId,
        reference,
        input,
        null,
        publish,
      );
      const [profile] = await db
        .select({ city: profiles.city, countryCode: profiles.countryCode })
        .from(profiles)
        .where(eq(profiles.userId, userId))
        .limit(1);
      const now = new Date();
      const id = await db.transaction(async (tx) => {
        const [row] = await tx
          .insert(listings)
          .values({
            sellerId: userId,
            ...columnsOf(merged, brandName),
            status: publish ? "active" : "draft",
            publishedAt: publish ? now : null,
            bumpedAt: now,
            city: profile?.city ?? null,
            countryCode: profile?.countryCode ?? "IL",
          })
          .returning({ id: listings.id });
        const listingId = (row as { id: string }).id;
        await writeColours(tx, listingId, merged.colourIds);
        if (photos) await writePhotos(tx, listingId, photos, photoSizes, photoVariants);
        return listingId;
      });
      if (publish) await refreshSellerCounts(db, userId);
      reply.code(201);
      return respond(id, userId);
    },
  );

  // ---- Own list and own view ----

  app.get(
    "/v1/me/listings",
    {
      preHandler,
      schema: {
        querystring: myListingsQuerySchema,
        response: { 200: myListingsPageSchema, 401: errorResponseSchema },
      },
    },
    async (request) => {
      const userId = userIdOf(request);
      const { status, limit } = request.query;
      const reference = await app.reference.get();
      const cursor = decodeCursor<{ u: string; i: string }>(request.query.cursor);
      const rows = await db
        .select({
          listing: listings,
          coverKey: listingPhotos.objectKey,
          coverWidth: listingPhotos.width,
          coverHeight: listingPhotos.height,
          coverPlaceholder: listingPhotos.placeholder,
          coverCardKey: listingPhotos.cardObjectKey,
        })
        .from(listings)
        .leftJoin(listingPhotos, and(eq(listingPhotos.listingId, listings.id), eq(listingPhotos.position, 0)))
        .where(
          and(
            eq(listings.sellerId, userId),
            status ? eq(listings.status, status) : ne(listings.status, "removed"),
            cursor
              ? or(
                  lt(listings.updatedAt, new Date(cursor.u)),
                  and(eq(listings.updatedAt, new Date(cursor.u)), lt(listings.id, cursor.i)),
                )
              : undefined,
          ),
        )
        .orderBy(desc(listings.updatedAt), desc(listings.id))
        .limit(limit + 1);

      const countRows = await db
        .select({ status: listings.status, n: sql<number>`count(*)::int` })
        .from(listings)
        .where(eq(listings.sellerId, userId))
        .groupBy(listings.status);
      const counts = Object.fromEntries(MY_LISTING_STATUSES.map((s) => [s, 0])) as Record<
        MyListingStatus,
        number
      >;
      for (const c of countRows) if (c.status in counts) counts[c.status as MyListingStatus] = c.n;

      const sizeLabels = new Map<string, string>();
      for (const g of reference.sizeGroups) for (const s of g.sizes) sizeLabels.set(s.id, s.label);
      const page = rows.slice(0, limit);
      const last = page.at(-1)?.listing;
      return {
        items: page.map((r) =>
          toMyCard(storage, reference, r.listing, {
            sizeLabel: r.listing.sizeId ? (sizeLabels.get(r.listing.sizeId) ?? null) : null,
            conditionSlug: reference.conditions.find((c) => c.id === r.listing.conditionId)?.slug ?? null,
            cover:
              r.coverKey && r.coverWidth && r.coverHeight
                ? {
                    objectKey: r.coverKey,
                    width: r.coverWidth,
                    height: r.coverHeight,
                    placeholder: r.coverPlaceholder,
                    cardObjectKey: r.coverCardKey,
                  }
                : null,
          }),
        ),
        nextCursor:
          rows.length > limit && last ? encodeCursor({ u: last.updatedAt.toISOString(), i: last.id }) : null,
        counts,
      };
    },
  );

  app.get(
    "/v1/me/listings/:id",
    { preHandler, schema: { params: idParams, response: { 200: listingDetailSchema, ...errors } } },
    async (request) => respond(request.params.id, userIdOf(request)),
  );

  // ---- Edit ----

  app.patch(
    "/v1/listings/:id",
    {
      preHandler,
      config: WRITE_LIMIT,
      schema: {
        params: idParams,
        body: listingDraftInputSchema,
        response: { 200: listingDetailSchema, ...errors },
      },
    },
    async (request) => {
      const userId = userIdOf(request);
      const row = await ownOr404(request.params.id, userId);
      if (row.status === "sold") throw ApiError.conflict("A sold listing cannot be edited");
      const reference = await app.reference.get();
      const [colourIds, photoKeys] = await Promise.all([colourIdsOf(row.id), photoKeysOf(row.id)]);
      // A live listing must stay complete. A draft may stay unfinished.
      const publish = row.status !== "draft";
      const { merged, brandName, photos, photoSizes, photoVariants } = await prepare(
        userId,
        reference,
        request.body,
        { row, colourIds, photoKeys },
        publish,
      );

      const priceChanged =
        publish &&
        row.priceMinor !== null &&
        merged.priceMinor !== null &&
        merged.priceMinor !== row.priceMinor;
      const lowered = priceChanged && (merged.priceMinor as number) < (row.priceMinor as number);

      await db.transaction(async (tx) => {
        await tx
          .update(listings)
          .set({
            ...columnsOf(merged, brandName),
            // The "Price drop" badge: set when the price goes down, cleared when it goes back up.
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
      });
      if (photos) {
        const kept = new Set(photos.map((p) => p.key));
        removeFiles(
          userId,
          photoKeys.filter((k) => !kept.has(k)),
          request.log,
        );
      }
      return respond(row.id, userId);
    },
  );

  app.put(
    "/v1/listings/:id/photos",
    {
      preHandler,
      config: WRITE_LIMIT,
      schema: {
        params: idParams,
        body: replaceListingPhotosInputSchema,
        response: { 200: listingDetailSchema, ...errors },
      },
    },
    async (request) => {
      const userId = userIdOf(request);
      const row = await ownOr404(request.params.id, userId);
      if (row.status === "sold") throw ApiError.conflict("A sold listing cannot be edited");
      const reference = await app.reference.get();
      const [colourIds, photoKeys] = await Promise.all([colourIdsOf(row.id), photoKeysOf(row.id)]);
      const { photos, photoSizes, photoVariants } = await prepare(
        userId,
        reference,
        { photos: request.body.photos },
        { row, colourIds, photoKeys },
        row.status !== "draft",
      );
      await db.transaction((tx) => writePhotos(tx, row.id, photos ?? [], photoSizes, photoVariants));
      const kept = new Set((photos ?? []).map((p) => p.key));
      removeFiles(
        userId,
        photoKeys.filter((k) => !kept.has(k)),
        request.log,
      );
      return respond(row.id, userId);
    },
  );

  // ---- Publish and state ----

  app.post(
    "/v1/listings/:id/publish",
    {
      preHandler,
      config: WRITE_LIMIT,
      schema: { params: idParams, response: { 200: listingDetailSchema, ...errors } },
    },
    async (request) => {
      const userId = userIdOf(request);
      const row = await ownOr404(request.params.id, userId);
      if (row.status !== "draft") {
        throw new ApiError(409, "invalid_transition", "Only a draft can be published");
      }
      const reference = await app.reference.get();
      const [colourIds, photoKeys] = await Promise.all([colourIdsOf(row.id), photoKeysOf(row.id)]);
      const { merged, brandName } = await prepare(userId, reference, {}, { row, colourIds, photoKeys }, true);
      const now = new Date();
      await db
        .update(listings)
        .set({ ...columnsOf(merged, brandName), status: "active", publishedAt: now, bumpedAt: now })
        .where(eq(listings.id, row.id));
      await refreshSellerCounts(db, userId);
      return respond(row.id, userId);
    },
  );

  app.patch(
    "/v1/listings/:id/status",
    {
      preHandler,
      config: WRITE_LIMIT,
      schema: {
        params: idParams,
        body: updateListingStatusInputSchema,
        response: { 200: listingDetailSchema, ...errors },
      },
    },
    async (request) => {
      const userId = userIdOf(request);
      const row = await ownOr404(request.params.id, userId);
      const next = request.body.status;
      if (row.status === next) return respond(row.id, userId);
      if (!MANUAL_TRANSITIONS[row.status]?.includes(next)) {
        throw new ApiError(409, "invalid_transition", `A ${row.status} listing cannot become ${next}`);
      }
      await db
        .update(listings)
        .set({
          status: next,
          // Reserved by hand holds the item for nobody in particular. Any other state clears the hold.
          reservedForUserId: null,
          reservedUntil: null,
          ...(next === "sold" ? { soldAt: new Date() } : {}),
        })
        .where(eq(listings.id, row.id));
      await refreshSellerCounts(db, userId);
      return respond(row.id, userId);
    },
  );

  // ---- Delete ----

  app.delete(
    "/v1/listings/:id",
    {
      preHandler,
      config: WRITE_LIMIT,
      schema: { params: idParams, response: { 204: z.null(), ...errors } },
    },
    async (request, reply) => {
      const userId = userIdOf(request);
      const row = await ownOr404(request.params.id, userId);
      // A listing that was part of an order stays, so the order keeps its history. The seller can hide it.
      if (row.status !== "draft" && (await hasOrders(db, row.id))) {
        throw ApiError.conflict("This listing has an order. Hide it instead");
      }
      const keys = await photoKeysOf(row.id);
      await db.delete(listings).where(eq(listings.id, row.id));
      await refreshSellerCounts(db, userId);
      removeFiles(userId, keys, request.log);
      return reply.code(204).send(null);
    },
  );
};

export default listingRoutes;

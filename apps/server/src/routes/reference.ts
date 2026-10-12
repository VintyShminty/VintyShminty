import { brandRequests, brands } from "@vinty/db";
import {
  brandRequestInputSchema,
  brandSchema,
  calculateBuyerProtectionFee,
  errorResponseSchema,
  pageSchema,
  paginationQuerySchema,
  pricePreviewQuerySchema,
  pricePreviewSchema,
  referenceDataSchema,
} from "@vinty/shared";
import { and, asc, desc, eq, ilike, or, sql } from "drizzle-orm";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import { decodeCursor, encodeCursor } from "../lib/cursor.js";
import { ApiError } from "../lib/errors.js";

const brandsQuery = paginationQuerySchema.extend({ q: z.string().trim().max(60).optional() });

/** Escapes the characters that mean something to LIKE, so a search for "100%" finds "100%". */
const likeEscape = (text: string) => text.replace(/[\\%_]/g, (c) => `\\${c}`);

/** Reference data for the sell form, brand search, and the buyer price preview. */
const referenceRoutes: FastifyPluginAsyncZod = async (app) => {
  const { db } = app;

  app.get(
    "/v1/reference",
    { schema: { response: { 200: referenceDataSchema, 304: z.null() } } },
    async (request, reply) => {
      const data = await app.reference.get();
      const etag = `"${data.version}"`;
      reply.header("ETag", etag);
      reply.header("Cache-Control", "public, max-age=3600");
      if (request.headers["if-none-match"] === etag) return reply.code(304).send(null);
      return data;
    },
  );

  app.get(
    "/v1/brands",
    {
      config: { rateLimit: { max: 120, timeWindow: "1 minute" } },
      schema: { querystring: brandsQuery, response: { 200: pageSchema(brandSchema) } },
    },
    async (request) => {
      const { q, limit } = request.query;
      const offset = decodeCursor<{ o: number }>(request.query.cursor)?.o ?? 0;
      const term = q ? likeEscape(q) : null;
      const rows = await db
        .select()
        .from(brands)
        .where(
          and(
            eq(brands.isActive, true),
            // A name that starts with the text, or has a word that starts with it ("Ralph" finds "Polo Ralph Lauren").
            term ? or(ilike(brands.name, `${term}%`), ilike(brands.name, `% ${term}%`)) : undefined,
          ),
        )
        .orderBy(
          // Names that start with the text come before names that only contain a word with it.
          ...(term ? [sql`(${brands.name} ilike ${`${term}%`}) desc`] : []),
          desc(brands.popularity),
          asc(brands.name),
          asc(brands.id),
        )
        .limit(limit + 1)
        .offset(offset);
      const page = rows.slice(0, limit);
      return {
        items: page.map((b) => ({
          id: b.id,
          slug: b.slug,
          name: b.name,
          logoUrl: b.logoKey ? app.storage.publicUrl(b.logoKey) : null,
        })),
        nextCursor: rows.length > limit ? encodeCursor({ o: offset + limit }) : null,
      };
    },
  );

  app.post(
    "/v1/brand-requests",
    {
      preHandler: app.requireUser,
      config: { rateLimit: { max: 10, timeWindow: "1 hour" } },
      schema: {
        body: brandRequestInputSchema,
        response: { 204: z.null(), 401: errorResponseSchema },
      },
    },
    async (request, reply) => {
      const userId = request.session?.user.id;
      if (!userId) throw ApiError.unauthenticated();
      const name = request.body.name;
      const [already] = await db
        .select({ id: brandRequests.id })
        .from(brandRequests)
        .where(and(eq(brandRequests.userId, userId), sql`lower(${brandRequests.name}) = lower(${name})`))
        .limit(1);
      if (!already) await db.insert(brandRequests).values({ userId, name });
      return reply.code(204).send(null);
    },
  );

  app.get(
    "/v1/pricing/preview",
    {
      config: { rateLimit: { max: 120, timeWindow: "1 minute" } },
      schema: { querystring: pricePreviewQuerySchema, response: { 200: pricePreviewSchema } },
    },
    async (request) => {
      const { priceMinor, currency } = request.query;
      const reference = await app.reference.get();
      const rule = reference.feeRules.find((f) => f.currency === currency);
      const fee = rule ? calculateBuyerProtectionFee(priceMinor, rule) : 0;
      return { priceMinor, currency, buyerProtectionFeeMinor: fee, buyerPriceMinor: priceMinor + fee };
    },
  );
};

export default referenceRoutes;

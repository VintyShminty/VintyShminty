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
import { and, asc, desc, eq, type SQL, sql } from "drizzle-orm";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import { brandNameMatches, brandStartsWith, likeEscape } from "../lib/brand-search.js";
import { decodeCursor, encodeCursor } from "../lib/cursor.js";
import { ApiError } from "../lib/errors.js";
import { createBrandMatcher } from "../lib/photo-assist.js";

const brandsQuery = paginationQuerySchema.extend({ q: z.string().trim().max(60).optional() });

/** Reference data for the sell form, brand search, and the buyer price preview. */
const referenceRoutes: FastifyPluginAsyncZod = async (app) => {
  const { db } = app;
  const brandMatcher = createBrandMatcher(db);

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
      const term = q ? likeEscape(q.toLowerCase()) : null;
      const list = (where: SQL | undefined) =>
        db
          .select()
          .from(brands)
          .where(and(eq(brands.isActive, true), where))
          .orderBy(
            // Names that start with the text come before names that only contain a word with it.
            ...(term ? [sql`${brandStartsWith(term)} desc`] : []),
            desc(brands.popularity),
            asc(brands.name),
            asc(brands.id),
          )
          .limit(limit + 1)
          .offset(offset);
      // The English name, the Hebrew name or an alias starts with the text, or has a word that starts with it
      // ("Ralph" finds "Polo Ralph Lauren", "מייקל" finds Michael Kors). Capitals do not matter.
      let rows = await list(term ? brandNameMatches(term) : undefined);
      if (rows.length === 0 && q && offset === 0) {
        // Nothing starts with it: forgive typos and spacing ("michaelkors"), or read a Hebrew spelling by its sound.
        const close = await brandMatcher.match(q, { fuzzy: true, wholeOnly: true });
        if (close) rows = await list(eq(brands.id, close.id));
      }
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

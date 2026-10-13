import { addresses } from "@vinty/db";
import { addressInputSchema, addressSchema, errorResponseSchema, idSchema } from "@vinty/shared";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import { ApiError } from "../lib/errors.js";

const idParams = z.object({ id: idSchema });
const WRITE_LIMIT = { rateLimit: { max: 60, timeWindow: "1 minute" } };
const errors = {
  400: errorResponseSchema,
  401: errorResponseSchema,
  404: errorResponseSchema,
  409: errorResponseSchema,
};
/** Enough for a home, a work place and a few friends. */
const MAX_ADDRESSES = 10;

const present = (row: typeof addresses.$inferSelect) => ({
  id: row.id,
  label: row.label,
  fullName: row.fullName,
  line1: row.line1,
  line2: row.line2,
  city: row.city,
  postcode: row.postcode,
  countryCode: row.countryCode,
  phone: row.phone,
  isDefault: row.isDefault,
});

/** Saved delivery addresses (Milestone 1 contract, needed by checkout in Milestone 5). */
const addressRoutes: FastifyPluginAsyncZod = async (app) => {
  const { db } = app;
  const preHandler = app.requireUser;
  const userIdOf = (request: { session: { user: { id: string } } | null }) => {
    if (!request.session) throw ApiError.unauthenticated();
    return request.session.user.id;
  };

  app.get(
    "/v1/me/addresses",
    { preHandler, schema: { response: { 200: z.array(addressSchema), 401: errorResponseSchema } } },
    async (request) => {
      const rows = await db
        .select()
        .from(addresses)
        .where(eq(addresses.userId, userIdOf(request)))
        .orderBy(desc(addresses.isDefault), asc(addresses.createdAt), asc(addresses.id));
      return rows.map(present);
    },
  );

  app.post(
    "/v1/me/addresses",
    {
      preHandler,
      config: WRITE_LIMIT,
      schema: { body: addressInputSchema, response: { 201: addressSchema, ...errors } },
    },
    async (request, reply) => {
      const userId = userIdOf(request);
      const row = await db.transaction(async (tx) => {
        const [count] = await tx
          .select({ n: sql<number>`count(*)::int` })
          .from(addresses)
          .where(eq(addresses.userId, userId));
        if ((count?.n ?? 0) >= MAX_ADDRESSES)
          throw ApiError.conflict("You have saved the most addresses allowed");
        // The first address becomes the default. Choosing a new default unsets the old one.
        const makeDefault = request.body.isDefault || (count?.n ?? 0) === 0;
        if (makeDefault) {
          await tx
            .update(addresses)
            .set({ isDefault: false })
            .where(and(eq(addresses.userId, userId), eq(addresses.isDefault, true)));
        }
        const [created] = await tx
          .insert(addresses)
          .values({ ...request.body, userId, isDefault: makeDefault })
          .returning();
        if (!created) throw new Error("Address was not saved");
        return created;
      });
      return reply.code(201).send(present(row));
    },
  );

  app.patch(
    "/v1/me/addresses/:id",
    {
      preHandler,
      config: WRITE_LIMIT,
      schema: {
        params: idParams,
        body: addressInputSchema.partial(),
        response: { 200: addressSchema, ...errors },
      },
    },
    async (request) => {
      const userId = userIdOf(request);
      const { isDefault, ...rest } = request.body;
      const row = await db.transaction(async (tx) => {
        const [own] = await tx
          .select()
          .from(addresses)
          .where(and(eq(addresses.id, request.params.id), eq(addresses.userId, userId)))
          .for("update")
          .limit(1);
        if (!own) throw ApiError.notFound();
        if (isDefault === true) {
          await tx
            .update(addresses)
            .set({ isDefault: false })
            .where(and(eq(addresses.userId, userId), eq(addresses.isDefault, true)));
        }
        const [updated] = await tx
          .update(addresses)
          .set({
            ...rest,
            // The only default cannot be switched off: pick another address to change it.
            ...(isDefault === true ? { isDefault: true } : {}),
          })
          .where(eq(addresses.id, own.id))
          .returning();
        if (!updated) throw new Error("Address was not updated");
        return updated;
      });
      return present(row);
    },
  );

  app.delete(
    "/v1/me/addresses/:id",
    {
      preHandler,
      config: WRITE_LIMIT,
      schema: {
        params: idParams,
        response: { 204: z.null(), 401: errorResponseSchema, 404: errorResponseSchema },
      },
    },
    async (request, reply) => {
      const userId = userIdOf(request);
      await db.transaction(async (tx) => {
        const [gone] = await tx
          .delete(addresses)
          .where(and(eq(addresses.id, request.params.id), eq(addresses.userId, userId)))
          .returning();
        if (!gone) throw ApiError.notFound();
        // Deleting the default hands the role to the oldest address left.
        if (gone.isDefault) {
          const [next] = await tx
            .select({ id: addresses.id })
            .from(addresses)
            .where(eq(addresses.userId, userId))
            .orderBy(asc(addresses.createdAt))
            .limit(1);
          if (next) await tx.update(addresses).set({ isDefault: true }).where(eq(addresses.id, next.id));
        }
      });
      return reply.code(204).send(null);
    },
  );
};

export default addressRoutes;

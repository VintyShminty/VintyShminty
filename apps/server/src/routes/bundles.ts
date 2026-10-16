import { profiles } from "@vinty/db";
import {
  bundleLadderSchema,
  bundleSchema,
  createBundleInputSchema,
  errorResponseSchema,
  idSchema,
  openBundleQuerySchema,
  updateBundleLadderInputSchema,
} from "@vinty/shared";
import { eq } from "drizzle-orm";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import {
  addBundleItem,
  findOpenBundle,
  loadBundleLadder,
  openBundle,
  ownBundle,
  presentBundle,
  removeBundleItem,
  saveBundleLadder,
} from "../lib/bundles.js";
import { ApiError } from "../lib/errors.js";

const idParams = z.object({ id: idSchema });
const itemParams = z.object({ id: idSchema, listingId: idSchema });
const WRITE_LIMIT = { rateLimit: { max: 60, timeWindow: "1 minute" } };
const errors = {
  400: errorResponseSchema,
  401: errorResponseSchema,
  403: errorResponseSchema,
  404: errorResponseSchema,
  409: errorResponseSchema,
};

/** Bundles: several items from one seller with the seller's discount ladder (Milestone 5). */
const bundleRoutes: FastifyPluginAsyncZod = async (app) => {
  const preHandler = app.requireUser;
  const userIdOf = (request: { session: { user: { id: string } } | null }) => {
    if (!request.session) throw ApiError.unauthenticated();
    return request.session.user.id;
  };

  app.get(
    "/v1/users/:id/bundle-ladder",
    { schema: { params: idParams, response: { 200: bundleLadderSchema, 404: errorResponseSchema } } },
    async (request) => {
      const [seller] = await app.db
        .select({ deletedAt: profiles.deletedAt })
        .from(profiles)
        .where(eq(profiles.userId, request.params.id))
        .limit(1);
      if (!seller || seller.deletedAt) throw ApiError.notFound();
      return loadBundleLadder(app.db, request.params.id);
    },
  );

  app.get(
    "/v1/me/bundle-ladder",
    { preHandler, schema: { response: { 200: bundleLadderSchema, 401: errorResponseSchema } } },
    async (request) => loadBundleLadder(app.db, userIdOf(request), true),
  );

  app.put(
    "/v1/me/bundle-ladder",
    {
      preHandler,
      config: WRITE_LIMIT,
      schema: {
        body: updateBundleLadderInputSchema,
        response: { 200: bundleLadderSchema, 400: errorResponseSchema, 401: errorResponseSchema },
      },
    },
    async (request) => saveBundleLadder(app, userIdOf(request), request.body),
  );

  app.post(
    "/v1/bundles",
    {
      preHandler,
      config: WRITE_LIMIT,
      schema: {
        body: createBundleInputSchema,
        response: { 200: bundleSchema, 201: bundleSchema, ...errors },
      },
    },
    async (request, reply) => {
      const { bundle, created } = await openBundle(app, userIdOf(request), request.body.sellerId);
      return reply.code(created ? 201 : 200).send(await presentBundle(app, bundle));
    },
  );

  // The buyer's open bundle with one seller, or null. Reading it makes nothing, unlike POST /v1/bundles.
  app.get(
    "/v1/bundles/open",
    {
      preHandler,
      schema: {
        querystring: openBundleQuerySchema,
        response: { 200: bundleSchema.nullable(), ...errors },
      },
    },
    async (request) => {
      const bundle = await findOpenBundle(app, userIdOf(request), request.query.sellerId);
      return bundle ? presentBundle(app, bundle) : null;
    },
  );

  app.get(
    "/v1/bundles/:id",
    { preHandler, schema: { params: idParams, response: { 200: bundleSchema, ...errors } } },
    async (request) => presentBundle(app, await ownBundle(app, request.params.id, userIdOf(request))),
  );

  app.put(
    "/v1/bundles/:id/items/:listingId",
    {
      preHandler,
      config: WRITE_LIMIT,
      schema: { params: itemParams, response: { 200: bundleSchema, ...errors } },
    },
    async (request) => {
      const bundle = await ownBundle(app, request.params.id, userIdOf(request));
      await addBundleItem(app, bundle, request.params.listingId);
      return presentBundle(app, bundle);
    },
  );

  app.delete(
    "/v1/bundles/:id/items/:listingId",
    {
      preHandler,
      config: WRITE_LIMIT,
      schema: { params: itemParams, response: { 200: bundleSchema, ...errors } },
    },
    async (request) => {
      const bundle = await ownBundle(app, request.params.id, userIdOf(request));
      await removeBundleItem(app, bundle, request.params.listingId);
      return presentBundle(app, bundle);
    },
  );
};

export default bundleRoutes;

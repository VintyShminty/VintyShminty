import {
  bumpPlansSchema,
  bumpSchema,
  createBumpInputSchema,
  errorResponseSchema,
  idSchema,
  myBumpsPageSchema,
  myBumpsQuerySchema,
} from "@vinty/shared";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import { giveBuzz, listActivePlans, listMyBumps } from "../lib/bumps.js";
import { ApiError } from "../lib/errors.js";

const idParams = z.object({ id: idSchema });
const errors = {
  400: errorResponseSchema,
  401: errorResponseSchema,
  404: errorResponseSchema,
  409: errorResponseSchema,
};

/** Buzz, the free boost for an item (Milestone 9). Version 1 is free, the answer says `payment: "free"`. */
const bumpRoutes: FastifyPluginAsyncZod = async (app) => {
  const preHandler = app.requireUser;
  const userIdOf = (request: { session: { user: { id: string } } | null }) => {
    if (!request.session) throw ApiError.unauthenticated();
    return request.session.user.id;
  };

  app.get(
    "/v1/bump-plans",
    { preHandler, schema: { response: { 200: bumpPlansSchema, 401: errorResponseSchema } } },
    async () => ({ items: await listActivePlans(app) }),
  );

  app.post(
    "/v1/listings/:id/bump",
    {
      preHandler,
      config: { rateLimit: { max: 30, timeWindow: "1 minute" } },
      schema: { params: idParams, body: createBumpInputSchema, response: { 201: bumpSchema, ...errors } },
    },
    async (request, reply) => {
      const bump = await giveBuzz(app, userIdOf(request), request.params.id, request.body.planId);
      return reply.code(201).send(bump);
    },
  );

  app.get(
    "/v1/me/bumps",
    {
      preHandler,
      schema: {
        querystring: myBumpsQuerySchema,
        response: { 200: myBumpsPageSchema, 401: errorResponseSchema },
      },
    },
    async (request) => listMyBumps(app, userIdOf(request), request.query.limit, request.query.cursor),
  );
};

export default bumpRoutes;

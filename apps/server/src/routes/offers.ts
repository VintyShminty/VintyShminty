import { errorResponseSchema, idSchema, offerInputSchema, offerQuotaSchema, offerSchema } from "@vinty/shared";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import { ApiError } from "../lib/errors.js";
import { answerOffer, createOffer, offerQuota } from "../lib/offers.js";

const idParams = z.object({ id: idSchema });
const WRITE_LIMIT = { rateLimit: { max: 60, timeWindow: "1 minute" } };
const errors = {
  400: errorResponseSchema,
  401: errorResponseSchema,
  403: errorResponseSchema,
  404: errorResponseSchema,
  409: errorResponseSchema,
};

/** Offers (Milestone 5). The offer bubbles live in the thread, see lib/offers.ts. */
const offerRoutes: FastifyPluginAsyncZod = async (app) => {
  const preHandler = app.requireUser;
  const userIdOf = (request: { session: { user: { id: string } } | null }) => {
    if (!request.session) throw ApiError.unauthenticated();
    return request.session.user.id;
  };

  app.get(
    "/v1/offers/quota",
    { preHandler, schema: { response: { 200: offerQuotaSchema, 401: errorResponseSchema } } },
    async (request) => offerQuota(app, userIdOf(request)),
  );

  app.post(
    "/v1/conversations/:id/offers",
    {
      preHandler,
      config: WRITE_LIMIT,
      schema: {
        params: idParams,
        body: offerInputSchema,
        response: { 201: offerSchema, ...errors, 429: errorResponseSchema },
      },
    },
    async (request, reply) => {
      const offer = await createOffer(app, userIdOf(request), request.params.id, request.body.amountMinor);
      return reply.code(201).send(offer);
    },
  );

  app.post(
    "/v1/offers/:id/accept",
    {
      preHandler,
      config: WRITE_LIMIT,
      schema: { params: idParams, response: { 200: offerSchema, ...errors } },
    },
    async (request) =>
      (await answerOffer(app, userIdOf(request), request.params.id, { event: "accept" })).offer,
  );

  app.post(
    "/v1/offers/:id/decline",
    {
      preHandler,
      config: WRITE_LIMIT,
      schema: { params: idParams, response: { 200: offerSchema, ...errors } },
    },
    async (request) =>
      (await answerOffer(app, userIdOf(request), request.params.id, { event: "decline" })).offer,
  );

  app.post(
    "/v1/offers/:id/counter",
    {
      preHandler,
      config: WRITE_LIMIT,
      schema: {
        params: idParams,
        body: offerInputSchema,
        response: { 201: offerSchema, ...errors, 429: errorResponseSchema },
      },
    },
    async (request, reply) => {
      const { counter } = await answerOffer(app, userIdOf(request), request.params.id, {
        event: "counter",
        amountMinor: request.body.amountMinor,
      });
      // The response is the new offer, the one that now waits for an answer.
      if (!counter) throw new Error("Counter offer was not created");
      return reply.code(201).send(counter);
    },
  );

  app.post(
    "/v1/offers/:id/withdraw",
    {
      preHandler,
      config: WRITE_LIMIT,
      schema: { params: idParams, response: { 200: offerSchema, ...errors } },
    },
    async (request) =>
      (await answerOffer(app, userIdOf(request), request.params.id, { event: "withdraw" })).offer,
  );
};

export default offerRoutes;

import {
  balanceEntryPageSchema,
  balanceEntrySchema,
  balanceSchema,
  createReviewInputSchema,
  errorResponseSchema,
  idempotencyHeadersSchema,
  idSchema,
  paginationQuerySchema,
  replyInputSchema,
  reviewItemSchema,
  withdrawalInputSchema,
} from "@vinty/shared";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import { ApiError } from "../lib/errors.js";
import { replyToReview, submitReview } from "../lib/reviews.js";
import { listEntries, loadBalance, withdraw } from "../lib/wallet.js";

const idParams = z.object({ id: idSchema });
const WRITE_LIMIT = { rateLimit: { max: 60, timeWindow: "1 minute" } };
const errors = {
  400: errorResponseSchema,
  401: errorResponseSchema,
  403: errorResponseSchema,
  404: errorResponseSchema,
  409: errorResponseSchema,
};

/** Feedback and the seller's pretend balance (Milestone 5). */
const reviewRoutes: FastifyPluginAsyncZod = async (app) => {
  const preHandler = app.requireUser;
  const userIdOf = (request: { session: { user: { id: string } } | null }) => {
    if (!request.session) throw ApiError.unauthenticated();
    return request.session.user.id;
  };

  app.post(
    "/v1/orders/:id/reviews",
    {
      preHandler,
      config: WRITE_LIMIT,
      schema: {
        params: idParams,
        body: createReviewInputSchema,
        response: { 201: reviewItemSchema, ...errors },
      },
    },
    async (request, reply) =>
      reply.code(201).send(await submitReview(app, userIdOf(request), request.params.id, request.body)),
  );

  app.put(
    "/v1/reviews/:id/reply",
    {
      preHandler,
      config: WRITE_LIMIT,
      schema: { params: idParams, body: replyInputSchema, response: { 200: reviewItemSchema, ...errors } },
    },
    async (request) => replyToReview(app, userIdOf(request), request.params.id, request.body.body),
  );

  app.get(
    "/v1/me/balance",
    { preHandler, schema: { response: { 200: balanceSchema, 401: errorResponseSchema } } },
    async (request) => loadBalance(app.db, userIdOf(request)),
  );

  app.get(
    "/v1/me/balance/entries",
    {
      preHandler,
      schema: {
        querystring: paginationQuerySchema,
        response: { 200: balanceEntryPageSchema, 401: errorResponseSchema },
      },
    },
    async (request) => listEntries(app.db, userIdOf(request), request.query.cursor, request.query.limit),
  );

  app.post(
    "/v1/me/balance/withdrawals",
    {
      preHandler,
      config: WRITE_LIMIT,
      schema: {
        body: withdrawalInputSchema,
        headers: idempotencyHeadersSchema,
        response: { 200: balanceEntrySchema, 201: balanceEntrySchema, ...errors },
      },
    },
    async (request, reply) => {
      const { entry, created } = await withdraw(
        app.db,
        userIdOf(request),
        request.body.amountMinor,
        request.headers["idempotency-key"],
      );
      return reply.code(created ? 201 : 200).send(entry);
    },
  );
};

export default reviewRoutes;

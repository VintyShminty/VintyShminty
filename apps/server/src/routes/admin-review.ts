import {
  adminReviewActionInputSchema,
  adminReviewItemSchema,
  adminReviewPageSchema,
  adminReviewQuerySchema,
  errorResponseSchema,
  idSchema,
} from "@vinty/shared";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import type { Db } from "../lib/admin.js";
import { applyReviewAction, listReview, loadReviewItem } from "../lib/admin-review.js";
import { transitionOrder } from "../lib/orders.js";

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
 * The admin Review list (D-038, docs/blueprint/api.md, "Admin panel"): member reports and the AI listing check's flags
 * together. Called from routes/admin.ts, so it shares the admin guard. The AI never acts, only these admin routes
 * change a listing.
 */
export function registerAdminReviewRoutes(app: FastifyInstance, { db, preHandler, adminIdOf }: Deps) {
  const rateLimit = { rateLimit: { max: 120, timeWindow: "1 minute" } };
  const typed = app.withTypeProvider<import("fastify-type-provider-zod").ZodTypeProvider>();

  typed.get(
    "/v1/admin/review",
    {
      preHandler,
      config: rateLimit,
      schema: { querystring: adminReviewQuerySchema, response: { 200: adminReviewPageSchema, ...errors } },
    },
    async (request) => listReview(db, app.storage, request.query),
  );

  typed.post(
    "/v1/admin/review/:id/action",
    {
      preHandler,
      config: rateLimit,
      schema: {
        params: idParams,
        body: adminReviewActionInputSchema,
        response: { 200: adminReviewItemSchema, ...errors },
      },
    },
    async (request) => {
      const { id } = request.params;
      await applyReviewAction(
        db,
        adminIdOf(request),
        id,
        request.body.action,
        request.body.note || undefined,
        async (orderId, event, note) => {
          await transitionOrder(
            app,
            orderId,
            event,
            { role: "admin", userId: adminIdOf(request) },
            note ? { note } : {},
          );
        },
      );
      return loadReviewItem(db, app.storage, id);
    },
  );
}

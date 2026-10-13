import {
  errorResponseSchema,
  redeemReferralInputSchema,
  referralSummarySchema,
  vouchersSchema,
} from "@vinty/shared";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import type { Env } from "../env.js";
import { AUTH_ERROR_CSP } from "../lib/auth-error-page.js";
import { ApiError } from "../lib/errors.js";
import { invitePage } from "../lib/invite-page.js";
import { loadReferralSummary, loadVouchers, redeemReferral } from "../lib/referrals.js";

const errors = { 400: errorResponseSchema, 401: errorResponseSchema, 403: errorResponseSchema };

/** Invite friends (Milestone 9): your code, who joined, your vouchers, entering a friend's code, and the link page. */
const referralRoutes: FastifyPluginAsyncZod<{ env: Env }> = async (app, { env }) => {
  const preHandler = app.requireUser;
  const userIdOf = (request: { session: { user: { id: string } } | null }) => {
    if (!request.session) throw ApiError.unauthenticated();
    return request.session.user.id;
  };

  app.get(
    "/v1/me/referral",
    { preHandler, schema: { response: { 200: referralSummarySchema, 401: errorResponseSchema } } },
    async (request) => loadReferralSummary(app, userIdOf(request), env.BETTER_AUTH_URL),
  );

  app.get(
    "/v1/me/vouchers",
    { preHandler, schema: { response: { 200: vouchersSchema, 401: errorResponseSchema } } },
    async (request) => loadVouchers(app.db, userIdOf(request)),
  );

  app.post(
    "/v1/referrals/redeem",
    {
      preHandler,
      config: { rateLimit: { max: 10, timeWindow: "1 minute" } },
      schema: {
        body: redeemReferralInputSchema,
        response: { 204: z.null(), 404: errorResponseSchema, 409: errorResponseSchema, ...errors },
      },
    },
    async (request, reply) => {
      await redeemReferral(app.db, userIdOf(request), request.body.code);
      return reply.code(204).send(null);
    },
  );

  // The page behind the link. Public, nothing personal on it.
  app.get("/invite/:code", async (req, reply) => {
    const { code } = (req.params ?? {}) as { code?: unknown };
    return reply
      .header("Content-Security-Policy", AUTH_ERROR_CSP)
      .header("Cache-Control", "no-store")
      .header("Referrer-Policy", "no-referrer")
      .type("text/html; charset=utf-8")
      .send(invitePage(code, env.APP_SCHEME));
  });
};

export default referralRoutes;

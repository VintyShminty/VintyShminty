import { timingSafeEqual } from "node:crypto";
import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
import { endFinishedBuzzes } from "../lib/bumps.js";
import { cleanupFeedData, refreshPopularity } from "../lib/feed-jobs.js";
import { runOrderJobs } from "../lib/order-jobs.js";

/**
 * Entry points for a scheduler (Vercel Cron calls with GET, anything else may use POST). They do the same work as the
 * timers in plugins/jobs.ts, so a host that does not keep a server running can still run the chores.
 * Every call needs `Authorization: Bearer <CRON_SECRET>` (Vercel Cron adds it by itself when the project has a
 * CRON_SECRET variable). Without CRON_SECRET in the environment they answer 404. Every job is safe to run twice.
 */
const jobRoutes: FastifyPluginAsync = async (app) => {
  const secret = app.env.CRON_SECRET;

  const allowed = (request: FastifyRequest) => {
    const header = request.headers.authorization ?? "";
    const given = Buffer.from(header.startsWith("Bearer ") ? header.slice(7) : "");
    const expected = Buffer.from(secret ?? "");
    return secret !== undefined && given.length === expected.length && timingSafeEqual(given, expected);
  };

  const guard = async (request: FastifyRequest, reply: FastifyReply) => {
    if (!secret) return reply.code(404).send({ error: { code: "not_found", message: "Not found" } });
    if (!allowed(request)) {
      return reply.code(401).send({ error: { code: "unauthenticated", message: "Wrong or missing secret" } });
    }
  };

  app.route({
    method: ["GET", "POST"],
    url: "/v1/jobs/orders",
    config: { rateLimit: { max: 30, timeWindow: "1 minute" } },
    preHandler: guard,
    handler: async () => ({ ok: true, ...(await runOrderJobs(app)) }),
  });

  app.route({
    method: ["GET", "POST"],
    url: "/v1/jobs/feed-popularity",
    config: { rateLimit: { max: 30, timeWindow: "1 minute" } },
    preHandler: guard,
    handler: async () => {
      await refreshPopularity(app);
      return { ok: true };
    },
  });

  app.route({
    method: ["GET", "POST"],
    url: "/v1/jobs/feed-cleanup",
    config: { rateLimit: { max: 30, timeWindow: "1 minute" } },
    preHandler: guard,
    handler: async () => ({ ok: true, ...(await cleanupFeedData(app)) }),
  });

  app.route({
    method: ["GET", "POST"],
    url: "/v1/jobs/buzz-end",
    config: { rateLimit: { max: 30, timeWindow: "1 minute" } },
    preHandler: guard,
    handler: async () => ({ ok: true, ...(await endFinishedBuzzes(app)) }),
  });

  // Everything in one call, for a scheduler that may only run once a day (Vercel Hobby).
  app.route({
    method: ["GET", "POST"],
    url: "/v1/jobs/all",
    config: { rateLimit: { max: 10, timeWindow: "1 minute" } },
    preHandler: guard,
    handler: async () => {
      const orders = await runOrderJobs(app);
      await refreshPopularity(app);
      const cleanup = await cleanupFeedData(app);
      const buzz = await endFinishedBuzzes(app);
      return { ok: true, orders, cleanup, buzz };
    },
  });
};

export default jobRoutes;

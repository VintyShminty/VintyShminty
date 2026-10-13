import { timingSafeEqual } from "node:crypto";
import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
import { cleanupFeedData, refreshPopularity } from "../lib/feed-jobs.js";

/**
 * Entry points for a scheduler (Vercel Cron calls with GET, anything else may use POST). They do the same work as the
 * timers in plugins/jobs.ts, so a host that does not keep a server running can still run the chores.
 * Every call needs `Authorization: Bearer <CRON_SECRET>`. Without CRON_SECRET in the environment they answer 404.
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
};

export default jobRoutes;

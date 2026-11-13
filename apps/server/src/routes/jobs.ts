import { timingSafeEqual } from "node:crypto";
import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
import { endFinishedBuzzes } from "../lib/bumps.js";
import { cleanupFeedData, refreshPopularity } from "../lib/feed-jobs.js";
import { type ListingChecker, tagUntaggedListings } from "../lib/listing-check.js";
import { runOrderJobs } from "../lib/order-jobs.js";
import { backfillPhotoVariants } from "../lib/photo-variants.js";

/**
 * Entry points for a scheduler (Vercel Cron calls with GET, anything else may use POST). They do the same work as the
 * timers in plugins/jobs.ts, so a host that does not keep a server running can still run the chores.
 * Every call needs `Authorization: Bearer <CRON_SECRET>` (Vercel Cron adds it by itself when the project has a
 * CRON_SECRET variable). Without CRON_SECRET in the environment they answer 404. Every job is safe to run twice.
 */
const jobRoutes: FastifyPluginAsync<{ listingChecker: ListingChecker }> = async (app, { listingChecker }) => {
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

  app.route({
    method: ["GET", "POST"],
    url: "/v1/jobs/photos",
    config: { rateLimit: { max: 30, timeWindow: "1 minute" } },
    preHandler: guard,
    handler: async () => ({ ok: true, ...(await backfillPhotoVariants(app)) }),
  });

  // Everything in one call, for a scheduler that may only run once a day (Vercel Hobby).
  app.route({
    method: ["GET", "POST"],
    url: "/v1/jobs/all",
    config: { rateLimit: { max: 10, timeWindow: "1 minute" } },
    preHandler: guard,
    handler: async (_request, reply) => {
      // One chore failing must not cancel the ones after it: each is tried, a failure is logged and reported.
      const failed: string[] = [];
      const attempt = async <T>(name: string, work: () => Promise<T>): Promise<T | null> => {
        try {
          return await work();
        } catch (err) {
          app.log.error({ err, job: name }, "nightly job failed");
          failed.push(name);
          return null;
        }
      };
      const orders = await attempt("orders", () => runOrderJobs(app));
      await attempt("popularity", () => refreshPopularity(app));
      const cleanup = await attempt("cleanup", () => cleanupFeedData(app));
      const buzz = await attempt("buzz", () => endFinishedBuzzes(app));
      const photos = await attempt("photos", () => backfillPhotoVariants(app, { budgetMs: 6000 }));
      // Style tags for listings that were never tagged (D-042): up to 100 a night, stops when the AI is refused.
      const styles = await attempt("styles", () => tagUntaggedListings(app, listingChecker, app.log));
      // A 500 so the scheduler's own log shows the night as failed, with what did run in the answer.
      if (failed.length > 0) {
        return reply.code(500).send({ ok: false, failed, orders, cleanup, buzz, photos, styles });
      }
      return { ok: true, orders, cleanup, buzz, photos, styles };
    },
  });
};

export default jobRoutes;

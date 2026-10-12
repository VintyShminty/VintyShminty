import { healthDbResponseSchema, healthResponseSchema } from "@vinty/shared";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";

const healthRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get("/health", { schema: { response: { 200: healthResponseSchema } } }, async () => ({ ok: true }));

  app.get(
    "/health/db",
    { schema: { response: { 200: healthDbResponseSchema, 503: healthDbResponseSchema } } },
    async (request, reply) => {
      try {
        await app.database.ping();
        return { ok: true, database: "up" as const };
      } catch (err) {
        request.log.error({ err }, "database health check failed");
        return reply.code(503).send({ ok: false, database: "down" as const });
      }
    },
  );
};

export default healthRoutes;

import type { FastifyInstance } from "fastify";
import type { HealthResponse } from "@vinty/shared";

export default async function healthRoutes(app: FastifyInstance) {
  app.get("/health", async (): Promise<HealthResponse> => ({ ok: true }));
}

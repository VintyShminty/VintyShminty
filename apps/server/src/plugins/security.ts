import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import sensible from "@fastify/sensible";
import fp from "fastify-plugin";
import type { Env } from "../env.js";

export default fp<{ env: Env }>(
  async (app, { env }) => {
    const origin = env.CORS_ORIGIN === "*" ? true : env.CORS_ORIGIN.split(",").map((o) => o.trim());
    await app.register(cors, { origin });
    await app.register(helmet);
    await app.register(rateLimit, { max: 120, timeWindow: "1 minute" });
    await app.register(sensible);
  },
  { name: "security" },
);

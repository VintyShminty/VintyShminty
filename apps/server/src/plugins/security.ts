import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import sensible from "@fastify/sensible";
import fp from "fastify-plugin";
import type { Env } from "../env.js";

export default fp<{ env: Env }>(
  async (app, { env }) => {
    const origin = env.CORS_ORIGIN === "*" ? true : env.CORS_ORIGIN.split(",").map((o) => o.trim());
    await app.register(cors, {
      origin,
      methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      exposedHeaders: [
        "Retry-After",
        "RateLimit-Limit",
        "RateLimit-Remaining",
        "RateLimit-Reset",
        "set-auth-token",
      ],
    });
    await app.register(helmet);
    // 300 a minute for everything. Sign in and friends get a stricter limit on their own route (plugins/auth.ts).
    await app.register(rateLimit, { max: 300, timeWindow: "1 minute" });
    await app.register(sensible);
  },
  { name: "security" },
);

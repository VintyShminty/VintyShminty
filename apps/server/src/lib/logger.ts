import type { FastifyServerOptions } from "fastify";
import type { Env } from "../env.js";

/** Pino options (Fastify's built-in logger). Structured JSON in production, readable lines elsewhere. */
export function loggerOptions(env: Env): FastifyServerOptions["logger"] {
  return {
    level: env.LOG_LEVEL,
    redact: ["req.headers.authorization", "req.headers.cookie"],
  };
}

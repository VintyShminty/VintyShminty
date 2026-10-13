import type { ErrorCode } from "@vinty/shared";
import fp from "fastify-plugin";
import { hasZodFastifySchemaValidationErrors } from "fastify-type-provider-zod";
import { ApiError } from "../lib/errors.js";

type ErrorBody = { error: { code: ErrorCode; message: string; fields?: Record<string, string>; resetsAt?: string } };

/** One error shape for every failure (docs/blueprint/api.md, Errors). */
export default fp(
  async (app) => {
    app.setErrorHandler((err, request, reply) => {
      const send = (status: number, body: ErrorBody) => reply.code(status).send(body);

      if (err instanceof ApiError) {
        if (err.retryAfterSeconds !== undefined) reply.header("Retry-After", String(err.retryAfterSeconds));
        return send(err.statusCode, {
          error: {
            code: err.code,
            message: err.message,
            ...(err.fields ? { fields: err.fields } : {}),
            ...(err.extra ?? {}),
          },
        });
      }
      if (hasZodFastifySchemaValidationErrors(err)) {
        const fields: Record<string, string> = {};
        for (const issue of err.validation) {
          const path = issue.instancePath.replace(/^\//, "").replaceAll("/", ".") || "(body)";
          fields[path] ??= issue.message ?? "Invalid";
        }
        return send(400, {
          error: { code: "validation_failed", message: "Some fields are not valid", fields },
        });
      }
      const status = (err as { statusCode?: number }).statusCode ?? 500;
      if (status === 429) {
        return send(429, { error: { code: "rate_limited", message: "Too many requests, try again soon" } });
      }
      if (status >= 400 && status < 500) {
        return send(status, {
          error: {
            code: status === 401 ? "unauthenticated" : status === 404 ? "not_found" : "validation_failed",
            message: (err as Error).message,
          },
        });
      }
      request.log.error({ err }, "request failed");
      return send(500, {
        error: { code: "internal_error", message: `Something went wrong (request ${request.id})` },
      });
    });

    app.setNotFoundHandler((_request, reply) =>
      reply.code(404).send({ error: { code: "not_found", message: "Not found" } } satisfies ErrorBody),
    );
  },
  { name: "errors" },
);

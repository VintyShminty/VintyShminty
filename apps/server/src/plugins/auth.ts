import type { Database } from "@vinty/db";
import { fromNodeHeaders } from "better-auth/node";
import type { FastifyReply, FastifyRequest } from "fastify";
import fp from "fastify-plugin";
import type { Env } from "../env.js";
import { type Auth, createAuth } from "../lib/auth.js";
import { ApiError } from "../lib/errors.js";
import { WindowLimiter } from "../lib/limiter.js";
import type { Mailer } from "../lib/mail.js";
import type { Storage } from "../lib/storage.js";

type Db = NonNullable<Database["db"]>;
type SessionResult = NonNullable<Awaited<ReturnType<Auth["api"]["getSession"]>>>;

export type AuthPluginOptions = { env: Env; db: Db; mailer: Mailer; storage: Storage };

declare module "fastify" {
  interface FastifyInstance {
    auth: Auth;
    db: Db;
    mailer: Mailer;
    storage: Storage;
    env: Env;
    /** preHandler: 401 unless there is a valid session. Sets request.session. */
    requireUser: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
  interface FastifyRequest {
    session: SessionResult | null;
  }
}

/** Routes whose job is to create or check a credential. They get the strict per IP limit. */
const SENSITIVE =
  /^\/api\/auth\/(sign-in|sign-up|email-otp|change-password|change-email|reset-password|request-password-reset|send-verification-email)(\/|$)/;
const pathOf = (url: string) => url.split("?")[0] ?? url;
export const isSensitiveAuthPath = (url: string) => SENSITIVE.test(pathOf(url));

/** Routes that email a code. At most 5 per hour for one email address. */
const CODE_REQUEST =
  /^\/api\/auth\/email-otp\/(send-verification-otp|request-password-reset|request-email-change)$/;

export default fp<AuthPluginOptions>(
  async (app, { env, db, mailer, storage }) => {
    const auth = createAuth({ env, db, mailer });
    app.decorate("auth", auth);
    app.decorate("db", db);
    app.decorate("mailer", mailer);
    app.decorate("storage", storage);
    app.decorate("env", env);
    app.decorateRequest("session", null);
    app.addHook("onClose", async () => {
      await mailer.close?.();
    });

    app.decorate("requireUser", async (request: FastifyRequest) => {
      const session = await auth.api.getSession({ headers: fromNodeHeaders(request.headers) });
      if (!session) throw ApiError.unauthenticated();
      request.session = session;
    });

    const codeLimiter = new WindowLimiter(5, 60 * 60 * 1000);

    // Better Auth gets its own scope so the lenient JSON parser below does not touch our own routes.
    await app.register(async (scope) => {
      // Some auth calls (sign out) send an empty body with a JSON content type. Treat it as {}.
      scope.addContentTypeParser("application/json", { parseAs: "string" }, (_req, body, done) => {
        try {
          done(null, body === "" ? {} : JSON.parse(body as string));
        } catch (err) {
          (err as Error & { statusCode?: number }).statusCode = 400;
          done(err as Error);
        }
      });

      scope.route({
        method: ["GET", "POST"],
        url: "/api/auth/*",
        config: {
          rateLimit: {
            max: (req: FastifyRequest) => (isSensitiveAuthPath(req.url) ? env.AUTH_RATE_LIMIT_MAX : 300),
            timeWindow: "1 minute",
            keyGenerator: (req: FastifyRequest) =>
              `${isSensitiveAuthPath(req.url) ? "strict" : "open"}:${req.ip}`,
          },
        },
        async handler(request, reply) {
          const path = pathOf(request.url);
          const body = request.body as { email?: unknown } | undefined;
          if (request.method === "POST" && CODE_REQUEST.test(path) && typeof body?.email === "string") {
            const key = body.email.trim().toLowerCase();
            if (!codeLimiter.take(key)) {
              reply.header("Retry-After", String(codeLimiter.retryAfterSeconds(key)));
              throw new ApiError(429, "rate_limited", "Too many codes requested for this email");
            }
          }

          const url = new URL(request.url, env.BETTER_AUTH_URL);
          const headers = fromNodeHeaders(request.headers);
          // The real address of the caller, never a value the caller made up.
          headers.set("x-forwarded-for", request.ip);
          const hasBody = request.method !== "GET" && request.method !== "HEAD" && request.body !== undefined;
          const response = await auth.handler(
            new Request(url, {
              method: request.method,
              headers,
              ...(hasBody ? { body: JSON.stringify(request.body) } : {}),
            }),
          );

          reply.status(response.status);
          const setCookies = response.headers.getSetCookie();
          response.headers.forEach((value, key) => {
            if (key.toLowerCase() !== "set-cookie") reply.header(key, value);
          });
          if (setCookies.length > 0) reply.header("set-cookie", setCookies);
          return reply.send(response.body ? await response.text() : null);
        },
      });
    });
  },
  { name: "auth" },
);

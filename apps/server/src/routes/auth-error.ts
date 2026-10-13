import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import type { Env } from "../env.js";
import { AUTH_ERROR_CSP, authErrorPage } from "../lib/auth-error-page.js";

/**
 * Where Better Auth sends the browser sheet when Google or Apple sign in is refused (onAPIError.errorURL).
 * A small page in English and Hebrew with a button back to the app. Public, nothing personal on it.
 */
const authErrorRoutes: FastifyPluginAsyncZod<{ env: Env }> = async (app, { env }) => {
  app.get("/v1/auth/error", async (req, reply) => {
    const { error } = (req.query ?? {}) as { error?: unknown };
    return reply
      .header("Content-Security-Policy", AUTH_ERROR_CSP)
      .header("Cache-Control", "no-store")
      .header("Referrer-Policy", "no-referrer")
      .type("text/html; charset=utf-8")
      .send(authErrorPage(error, env.APP_SCHEME));
  });
};

export default authErrorRoutes;

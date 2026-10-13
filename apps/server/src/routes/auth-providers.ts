import { authProvidersSchema } from "@vinty/shared";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import type { Env } from "../env.js";
import { socialProvidersOn } from "../lib/social.js";

/** Tells the app which "Continue with ..." buttons to show, so keys can be switched on without a new app build. */
const authProvidersRoutes: FastifyPluginAsyncZod<{ env: Env }> = async (app, { env }) => {
  app.get(
    "/v1/auth/providers",
    { schema: { response: { 200: authProvidersSchema } } },
    async (_req, reply) => {
      reply.header("Cache-Control", "public, max-age=60");
      return socialProvidersOn(env);
    },
  );
};

export default authProvidersRoutes;

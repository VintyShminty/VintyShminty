import Fastify from "fastify";
import { serializerCompiler, validatorCompiler, type ZodTypeProvider } from "fastify-type-provider-zod";
import type { Env } from "./env.js";
import { loggerOptions } from "./lib/logger.js";
import dbPlugin, { type DatabaseHandle } from "./plugins/db.js";
import securityPlugin from "./plugins/security.js";
import healthRoutes from "./routes/health.js";

export type BuildAppOptions = {
  env: Env;
  database: DatabaseHandle;
};

export async function buildApp({ env, database }: BuildAppOptions) {
  const app = Fastify({
    logger: env.NODE_ENV === "test" ? false : loggerOptions(env),
  }).withTypeProvider<ZodTypeProvider>();

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  await app.register(securityPlugin, { env });
  await app.register(dbPlugin, { database });
  await app.register(healthRoutes);

  return app;
}

import Fastify from "fastify";
import { serializerCompiler, validatorCompiler, type ZodTypeProvider } from "fastify-type-provider-zod";
import type { Env } from "./env.js";
import { loggerOptions } from "./lib/logger.js";
import { createMailer, type Mailer } from "./lib/mail.js";
import type { Pusher } from "./lib/push.js";
import { createStorage, type Storage } from "./lib/storage.js";
import authPlugin from "./plugins/auth.js";
import dbPlugin, { type DatabaseHandle } from "./plugins/db.js";
import errorsPlugin from "./plugins/errors.js";
import messagingPlugin from "./plugins/messaging.js";
import referencePlugin from "./plugins/reference.js";
import securityPlugin from "./plugins/security.js";
import discoveryRoutes from "./routes/discovery.js";
import engagementRoutes from "./routes/engagement.js";
import healthRoutes from "./routes/health.js";
import listingRoutes from "./routes/listings.js";
import meRoutes from "./routes/me.js";
import messageRoutes from "./routes/messages.js";
import notificationRoutes from "./routes/notifications.js";
import referenceRoutes from "./routes/reference.js";
import uploadRoutes from "./routes/uploads.js";
import userRoutes from "./routes/users.js";

export type BuildAppOptions = {
  env: Env;
  database: DatabaseHandle;
  /** Defaults to SMTP (Mailpit in development). Tests pass a memory mailer. */
  mailer?: Mailer;
  /** Defaults to the S3 compatible bucket from the environment. */
  storage?: Storage;
  /** Defaults to the log transport (see PUSH_TRANSPORT). Tests pass a memory pusher. */
  pusher?: Pusher;
};

export async function buildApp({ env, database, mailer, storage, pusher }: BuildAppOptions) {
  const app = Fastify({
    logger: env.NODE_ENV === "test" ? false : loggerOptions(env),
  }).withTypeProvider<ZodTypeProvider>();

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  await app.register(errorsPlugin);
  await app.register(securityPlugin, { env });
  await app.register(dbPlugin, { database });
  await app.register(healthRoutes);

  // Accounts need the query builder. The health tests build the app with a database that only answers ping.
  if (database.db) {
    await app.register(authPlugin, {
      env,
      db: database.db,
      mailer: mailer ?? createMailer(env),
      storage: storage ?? createStorage(env),
    });
    await app.register(messagingPlugin, { env, ...(pusher ? { pusher } : {}) });
    await app.register(referencePlugin);
    await app.register(meRoutes);
    await app.register(referenceRoutes);
    await app.register(listingRoutes);
    await app.register(uploadRoutes);
    await app.register(userRoutes);
    await app.register(discoveryRoutes);
    await app.register(engagementRoutes);
    await app.register(messageRoutes);
    await app.register(notificationRoutes);
  }

  return app;
}

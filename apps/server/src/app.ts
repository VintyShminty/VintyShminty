import Fastify from "fastify";
import { serializerCompiler, validatorCompiler, type ZodTypeProvider } from "fastify-type-provider-zod";
import type { Env } from "./env.js";
import { AiMeter } from "./lib/ai-cost.js";
import { loggerOptions } from "./lib/logger.js";
import { createMailer, type Mailer } from "./lib/mail.js";
import { createPhotoReader, meteredPhotoReader, type PhotoReader } from "./lib/photo-reader.js";
import type { Pusher } from "./lib/push.js";
import { createStorage, type Storage } from "./lib/storage.js";
import authPlugin from "./plugins/auth.js";
import dbPlugin, { type DatabaseHandle } from "./plugins/db.js";
import errorsPlugin from "./plugins/errors.js";
import jobsPlugin from "./plugins/jobs.js";
import messagingPlugin from "./plugins/messaging.js";
import referencePlugin from "./plugins/reference.js";
import securityPlugin from "./plugins/security.js";
import addressRoutes from "./routes/addresses.js";
import adminRoutes from "./routes/admin.js";
import authErrorRoutes from "./routes/auth-error.js";
import authProvidersRoutes from "./routes/auth-providers.js";
import bumpRoutes from "./routes/bumps.js";
import bundleRoutes from "./routes/bundles.js";
import discoveryRoutes from "./routes/discovery.js";
import engagementRoutes from "./routes/engagement.js";
import eventRoutes from "./routes/events.js";
import healthRoutes from "./routes/health.js";
import jobRoutes from "./routes/jobs.js";
import listingRoutes from "./routes/listings.js";
import meRoutes from "./routes/me.js";
import messageRoutes from "./routes/messages.js";
import notificationRoutes from "./routes/notifications.js";
import offerRoutes from "./routes/offers.js";
import orderRoutes from "./routes/orders.js";
import photoAssistRoutes from "./routes/photo-assist.js";
import referenceRoutes from "./routes/reference.js";
import referralRoutes from "./routes/referrals.js";
import reviewRoutes from "./routes/reviews.js";
import uploadRoutes from "./routes/uploads.js";
import userRoutes from "./routes/users.js";

export type BuildAppOptions = {
  env: Env;
  database: DatabaseHandle;
  /** Defaults to SMTP (Mailpit in development). Tests pass a memory mailer. */
  mailer?: Mailer;
  /** Defaults to the S3 compatible bucket from the environment. */
  storage?: Storage;
  /** Defaults to Claude Haiku when ANTHROPIC_API_KEY is set, otherwise the photo helper is off. Tests pass a fake. */
  photoReader?: PhotoReader;
  /** Defaults to the log transport (see PUSH_TRANSPORT). Tests pass a memory pusher. */
  pusher?: Pusher;
};

export async function buildApp({ env, database, mailer, storage, pusher, photoReader }: BuildAppOptions) {
  const app = Fastify({
    logger: env.NODE_ENV === "test" ? false : loggerOptions(env),
  }).withTypeProvider<ZodTypeProvider>();

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  await app.register(errorsPlugin);
  await app.register(securityPlugin, { env });
  await app.register(dbPlugin, { database });
  await app.register(healthRoutes);
  await app.register(authProvidersRoutes, { env });
  await app.register(authErrorRoutes, { env });

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
    // Every AI call goes through this meter: the spend caps, the master switch and the cost log (lib/ai-cost.ts).
    const aiMeter = new AiMeter(database.db, { logger: app.log });
    await app.register(photoAssistRoutes, {
      reader: meteredPhotoReader(photoReader ?? createPhotoReader(env), aiMeter, env.PHOTO_READER_MODEL),
    });
    await app.register(userRoutes);
    await app.register(discoveryRoutes);
    await app.register(engagementRoutes);
    await app.register(eventRoutes);
    await app.register(messageRoutes);
    await app.register(notificationRoutes);
    await app.register(addressRoutes);
    await app.register(offerRoutes);
    await app.register(bundleRoutes);
    await app.register(bumpRoutes);
    await app.register(orderRoutes);
    await app.register(reviewRoutes);
    await app.register(referralRoutes, { env });
    await app.register(adminRoutes, { meter: aiMeter });
    await app.register(jobsPlugin);
    await app.register(jobRoutes);
  }

  return app;
}

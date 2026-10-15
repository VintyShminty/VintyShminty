import { ADMIN_UPLOAD_AI_ACTION } from "@vinty/shared";
import Fastify from "fastify";
import { serializerCompiler, validatorCompiler, type ZodTypeProvider } from "fastify-type-provider-zod";
import type { Env } from "./env.js";
import { AiMeter } from "./lib/ai-cost.js";
import {
  type ChatCheckReader,
  createChatChecker,
  createChatCheckReader,
  meteredChatCheckReader,
} from "./lib/chat-check.js";
import { createHelpReader, type HelpReader, meteredHelpReader } from "./lib/help-answer.js";
import {
  createListingChecker,
  createListingCheckReader,
  type ListingCheckReader,
  meteredListingCheckReader,
} from "./lib/listing-check.js";
import { loggerOptions } from "./lib/logger.js";
import { createMailer, type Mailer } from "./lib/mail.js";
import {
  createOrderSummarizer,
  createOrderSummaryReader,
  meteredOrderSummaryReader,
  type OrderSummaryReader,
} from "./lib/order-summary.js";
import { createPhotoReader, meteredPhotoReader, type PhotoReader } from "./lib/photo-reader.js";
import type { Pusher } from "./lib/push.js";
import {
  createReportSorter,
  createReportSortReader,
  meteredReportSortReader,
  type ReportSortReader,
} from "./lib/report-sort.js";
import { createSearchReader, meteredSearchReader, type SearchReader } from "./lib/search-reader.js";
import { createStorage, type Storage } from "./lib/storage.js";
import { createTextReader, meteredTextReader, type TextReader } from "./lib/text-reader.js";
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
import helpAssistRoutes from "./routes/help-assist.js";
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
import searchAssistRoutes from "./routes/search-assist.js";
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
  /** Same for the text helper (D-036): Claude Haiku when ANTHROPIC_API_KEY is set, otherwise off. Tests pass a fake. */
  textReader?: TextReader;
  /** Same for search in plain words (D-037). Tests pass a fake. */
  searchReader?: SearchReader;
  /** Help answers from our own articles (D-043). Tests pass a fake. */
  helpReader?: HelpReader;
  /** The AI listing check after a listing goes live (D-038). Tests pass a fake. */
  listingCheckReader?: ListingCheckReader;
  /** Sorting of member reports by urgency (D-038). Tests pass a fake. */
  reportSortReader?: ReportSortReader;
  /** The order problem summary for the admin Review list (D-044). Tests pass a fake. */
  orderSummaryReader?: OrderSummaryReader;
  /** The background chat check that adds warnings to messages (D-041). Tests pass a fake. */
  chatCheckReader?: ChatCheckReader;
  /** Suggested replies in a chat (D-041). Tests pass a fake. */
  /** Defaults to the log transport (see PUSH_TRANSPORT). Tests pass a memory pusher. */
  pusher?: Pusher;
};

export async function buildApp({
  env,
  database,
  mailer,
  storage,
  pusher,
  photoReader,
  textReader,
  searchReader,
  helpReader,
  listingCheckReader,
  reportSortReader,
  orderSummaryReader,
  chatCheckReader,
}: BuildAppOptions) {
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
    // Every AI call goes through this meter: the spend caps, the master switch and the cost log (lib/ai-cost.ts).
    const aiMeter = new AiMeter(database.db, { logger: app.log });
    const listingChecker = createListingChecker(
      app,
      meteredListingCheckReader(
        listingCheckReader ?? createListingCheckReader(env),
        aiMeter,
        env.PHOTO_READER_MODEL,
      ),
    );
    const reportSorter = createReportSorter(
      app,
      meteredReportSortReader(
        reportSortReader ?? createReportSortReader(env),
        aiMeter,
        env.PHOTO_READER_MODEL,
      ),
    );
    // D-044: the order dispute route starts this after an order becomes disputed.
    app.decorate(
      "orderSummarizer",
      createOrderSummarizer(
        app,
        meteredOrderSummaryReader(
          orderSummaryReader ?? createOrderSummaryReader(env),
          aiMeter,
          env.PHOTO_READER_MODEL,
        ),
      ),
    );
    // D-041: sendMessage starts this after a new text message is stored.
    app.decorate(
      "chatChecker",
      createChatChecker(
        app,
        meteredChatCheckReader(
          chatCheckReader ?? createChatCheckReader(env),
          aiMeter,
          env.PHOTO_READER_MODEL,
        ),
      ),
    );
    await app.register(listingRoutes, { listingChecker });
    await app.register(uploadRoutes);
    const baseReader = photoReader ?? createPhotoReader(env);
    const meteredSearch = meteredSearchReader(
      searchReader ?? createSearchReader(env),
      aiMeter,
      env.PHOTO_READER_MODEL,
    );
    const meteredHelp = meteredHelpReader(
      helpReader ?? createHelpReader(env),
      aiMeter,
      env.PHOTO_READER_MODEL,
    );
    await app.register(photoAssistRoutes, {
      reader: meteredPhotoReader(baseReader, aiMeter, env.PHOTO_READER_MODEL),
      textReader: meteredTextReader(textReader ?? createTextReader(env), aiMeter, env.PHOTO_READER_MODEL),
      searchReader: meteredSearch,
      helpReader: meteredHelp,
      meter: aiMeter,
    });
    await app.register(searchAssistRoutes, { searchReader: meteredSearch });
    await app.register(helpAssistRoutes, { helpReader: meteredHelp });
    await app.register(userRoutes);
    await app.register(discoveryRoutes);
    await app.register(engagementRoutes, { reportSorter });
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
    await app.register(adminRoutes, {
      meter: aiMeter,
      listingChecker,
      // The listing upload page reads photos too, counted as its own line in the cost log.
      reader: meteredPhotoReader(baseReader, aiMeter, env.PHOTO_READER_MODEL, ADMIN_UPLOAD_AI_ACTION),
    });
    await app.register(jobsPlugin);
    await app.register(jobRoutes, { listingChecker });
  }

  return app;
}

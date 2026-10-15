import {
  EMPTY_PHOTO_SUGGESTION,
  EMPTY_TEXT_SUGGESTION,
  errorResponseSchema,
  photoAssistStatusSchema,
  photoCheckRequestSchema,
  photoCheckSchema,
  photoSuggestionSchema,
  suggestRequestSchema,
  textSuggestionSchema,
  textSuggestRequestSchema,
} from "@vinty/shared";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import type { AiMeter } from "../lib/ai-cost.js";
import { ApiError } from "../lib/errors.js";
import { WindowLimiter } from "../lib/limiter.js";
import { createPhotoChecker, createPhotoSuggester, createTextSuggester } from "../lib/photo-assist.js";
import type { PhotoReader } from "../lib/photo-reader.js";
import type { SearchReader } from "../lib/search-reader.js";
import { keyBelongsToUser } from "../lib/storage.js";
import type { TextReader } from "../lib/text-reader.js";

const SUGGESTIONS_PER_HOUR = 20;
const PHOTO_CHECKS_PER_HOUR = 20;
const TEXT_SUGGESTIONS_PER_HOUR = 40;

/**
 * The AI photo helper (D-028): looks at the photos a seller already uploaded and suggests up to 3 categories, the
 * brand and colours. It never fills anything: the app shows the guesses first inside
 * its pickers. Always answers 200: when it is off, slow or unsure the suggestion is simply empty and the sell form
 * carries on as before.
 */
const photoAssistRoutes: FastifyPluginAsyncZod<{
  reader: PhotoReader;
  textReader: TextReader;
  searchReader: SearchReader;
  /** The AI cost meter, asked whether the master switch is on for the status answer. */
  meter: Pick<AiMeter, "switchState">;
}> = async (app, { reader, textReader, searchReader, meter }) => {
  const limiter = new WindowLimiter(SUGGESTIONS_PER_HOUR, 3_600_000);
  const checkLimiter = new WindowLimiter(PHOTO_CHECKS_PER_HOUR, 3_600_000);
  const textLimiter = new WindowLimiter(TEXT_SUGGESTIONS_PER_HOUR, 3_600_000);
  const suggest = createPhotoSuggester(app, reader);
  const check = createPhotoChecker(app, reader);
  const suggestText = createTextSuggester(app, textReader);

  const tooMany = (limiterUsed: WindowLimiter, userId: string, what: string) =>
    new ApiError(
      429,
      "rate_limited",
      `Too many ${what}, try again later`,
      undefined,
      limiterUsed.retryAfterSeconds(userId),
    );

  /**
   * Tells the app whether the helpers are on: a key is set and the AI switch is on. This lets them be switched on and
   * off without a new app build. A switch lookup that fails answers off.
   */
  app.get(
    "/v1/sell/assist",
    { schema: { response: { 200: photoAssistStatusSchema } } },
    async (_request, reply) => {
      reply.header("Cache-Control", "public, max-age=60");
      let switchOn = false;
      try {
        switchOn = (await meter.switchState()).enabled;
      } catch {
        // Cannot tell, so say off. The form works without help.
      }
      return {
        photoAssist: reader.enabled && switchOn,
        textAssist: textReader.enabled && switchOn,
        searchAssist: searchReader.enabled && switchOn,
      };
    },
  );

  app.post(
    "/v1/listings/suggest",
    {
      preHandler: app.requireUser,
      // Per person limit is counted below. This only guards the request count from one address.
      config: { rateLimit: { max: 30, timeWindow: "1 minute" } },
      schema: {
        body: suggestRequestSchema,
        response: { 200: photoSuggestionSchema, 401: errorResponseSchema, 429: errorResponseSchema },
      },
    },
    async (request) => {
      const userId = request.session?.user.id;
      if (!userId) throw ApiError.unauthenticated();
      const { photoKeys, language } = request.body;

      // Only the seller's own listing photos. Anything else is a mistake or an attempt to read someone's files.
      const keys = [...new Set(photoKeys)];
      if (!keys.every((key) => keyBelongsToUser(key, "listing_photo", userId))) {
        throw ApiError.invalid("Those photos are not yours");
      }
      if (!reader.enabled) return EMPTY_PHOTO_SUGGESTION;

      if (!limiter.take(userId)) {
        throw tooMany(limiter, userId, "photo reads");
      }

      return suggest({ keys, language, userId, log: request.log });
    },
  );

  /** Photos added after the first read: tips only (dark, cut off, contact details), no guesses. */
  app.post(
    "/v1/listings/photo-check",
    {
      preHandler: app.requireUser,
      config: { rateLimit: { max: 30, timeWindow: "1 minute" } },
      schema: {
        body: photoCheckRequestSchema,
        response: { 200: photoCheckSchema, 401: errorResponseSchema, 429: errorResponseSchema },
      },
    },
    async (request) => {
      const userId = request.session?.user.id;
      if (!userId) throw ApiError.unauthenticated();
      const keys = [...new Set(request.body.photoKeys)];
      if (!keys.every((key) => keyBelongsToUser(key, "listing_photo", userId))) {
        throw ApiError.invalid("Those photos are not yours");
      }
      if (!reader.enabled) return { photoTips: [] };
      if (!checkLimiter.take(userId)) throw tooMany(checkLimiter, userId, "photo checks");
      return check({ keys, userId, log: request.log });
    },
  );

  /** Guesses from the title and description the seller typed. Always 200, empty when off, refused or failed. */
  app.post(
    "/v1/listings/suggest-text",
    {
      preHandler: app.requireUser,
      config: { rateLimit: { max: 30, timeWindow: "1 minute" } },
      schema: {
        body: textSuggestRequestSchema,
        response: { 200: textSuggestionSchema, 401: errorResponseSchema, 429: errorResponseSchema },
      },
    },
    async (request) => {
      const userId = request.session?.user.id;
      if (!userId) throw ApiError.unauthenticated();
      if (!textReader.enabled) return EMPTY_TEXT_SUGGESTION;
      if (!textLimiter.take(userId)) throw tooMany(textLimiter, userId, "text reads");
      const { title, description } = request.body;
      return suggestText({ title, description, userId, log: request.log });
    },
  );
};

export default photoAssistRoutes;

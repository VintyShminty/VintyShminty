import {
  EMPTY_PHOTO_SUGGESTION,
  errorResponseSchema,
  photoAssistStatusSchema,
  photoSuggestionSchema,
  suggestRequestSchema,
} from "@vinty/shared";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { ApiError } from "../lib/errors.js";
import { WindowLimiter } from "../lib/limiter.js";
import { createPhotoSuggester } from "../lib/photo-assist.js";
import type { PhotoReader } from "../lib/photo-reader.js";
import { keyBelongsToUser } from "../lib/storage.js";

const SUGGESTIONS_PER_HOUR = 20;

/**
 * The AI photo helper (D-028): looks at the photos a seller already uploaded and suggests up to 3 categories, the
 * brand and colours. It never fills anything: the app shows the guesses first inside
 * its pickers. Always answers 200: when it is off, slow or unsure the suggestion is simply empty and the sell form
 * carries on as before.
 */
const photoAssistRoutes: FastifyPluginAsyncZod<{ reader: PhotoReader }> = async (app, { reader }) => {
  const limiter = new WindowLimiter(SUGGESTIONS_PER_HOUR, 3_600_000);
  const suggest = createPhotoSuggester(app, reader);

  /** Tells the app whether to read photos at all, so the key can be switched on without a new app build. */
  app.get(
    "/v1/sell/assist",
    { schema: { response: { 200: photoAssistStatusSchema } } },
    async (_request, reply) => {
      reply.header("Cache-Control", "public, max-age=60");
      return { photoAssist: reader.enabled };
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
        throw new ApiError(
          429,
          "rate_limited",
          "Too many photo reads, try again later",
          undefined,
          limiter.retryAfterSeconds(userId),
        );
      }

      return suggest({ keys, language, userId, log: request.log });
    },
  );
};

export default photoAssistRoutes;

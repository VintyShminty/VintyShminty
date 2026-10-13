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
import { buildCatalog, createBrandMatcher, resolveSuggestion } from "../lib/photo-assist.js";
import type { PhotoMediaType, PhotoReader } from "../lib/photo-reader.js";
import { keyBelongsToUser } from "../lib/storage.js";

/** The API takes images up to 5 MB each. The app already shrinks photos to about 1 MB, so this is a safety net. */
const MAX_IMAGE_BYTES = 5_000_000;
const SUGGESTIONS_PER_HOUR = 20;
const READ_TIMEOUT_MS = 15_000;

const MEDIA_TYPES: Record<string, PhotoMediaType> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

/**
 * The AI photo helper (D-028): looks at the photos a seller already uploaded and suggests the category, brand,
 * colours, material, title and description. Always answers 200: when it is off, slow or unsure the suggestion is
 * simply empty and the sell form carries on as before.
 */
const photoAssistRoutes: FastifyPluginAsyncZod<{ reader: PhotoReader }> = async (app, { reader }) => {
  const limiter = new WindowLimiter(SUGGESTIONS_PER_HOUR, 3_600_000);
  const brandMatcher = createBrandMatcher(app.db);
  let catalog: { version: string; value: ReturnType<typeof buildCatalog> } | null = null;

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

      const startedAt = Date.now();
      try {
        const images = (
          await Promise.all(
            keys.map(async (key) => {
              const mediaType = MEDIA_TYPES[key.split(".").pop()?.toLowerCase() ?? ""];
              if (!mediaType) return null;
              const data = await app.storage.read(key, MAX_IMAGE_BYTES);
              return data ? { mediaType, data } : null;
            }),
          )
        ).filter((image): image is NonNullable<typeof image> => image !== null);
        if (images.length === 0) return EMPTY_PHOTO_SUGGESTION;

        const reference = await app.reference.get();
        if (catalog?.version !== reference.version) {
          catalog = { version: reference.version, value: buildCatalog(reference) };
        }
        const { reading, usage } = await reader.read({
          images,
          catalog: catalog.value.text,
          language,
          signal: AbortSignal.timeout(READ_TIMEOUT_MS),
        });
        request.log.info(
          { photos: images.length, ms: Date.now() - startedAt, ...usage },
          "photo helper read",
        );
        return await resolveSuggestion(reading, catalog.value, brandMatcher);
      } catch (error) {
        // Never a 500: the form works without help. The error text can name the model, never the key or the photos.
        request.log.warn(
          { ms: Date.now() - startedAt, error: error instanceof Error ? error.name : "unknown" },
          "photo helper failed",
        );
        return EMPTY_PHOTO_SUGGESTION;
      }
    },
  );
};

export default photoAssistRoutes;

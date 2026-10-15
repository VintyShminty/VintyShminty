import {
  EMPTY_PLACE_DETAILS,
  errorResponseSchema,
  placeDetailsSchema,
  placeSuggestionsSchema,
  placeSuggestQuerySchema,
} from "@vinty/shared";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import { ApiError } from "../lib/errors.js";
import { WindowLimiter } from "../lib/limiter.js";
import type { PlacesClient } from "../lib/places.js";

const LOOKUPS_PER_HOUR = 300;

/**
 * City and address suggestions for the profile and delivery address forms. Signed in people only (every call costs a
 * little) and limited per person. Always 200: empty when off, too short, rate limited by Google or failed.
 */
const placesRoutes: FastifyPluginAsyncZod<{ places: PlacesClient }> = async (app, { places }) => {
  const limiter = new WindowLimiter(LOOKUPS_PER_HOUR, 3_600_000);
  const guard = (userId: string) => {
    if (!limiter.take(userId)) {
      throw new ApiError(
        429,
        "rate_limited",
        "Too many lookups, try again later",
        undefined,
        limiter.retryAfterSeconds(userId),
      );
    }
  };

  app.get(
    "/v1/places/suggest",
    {
      preHandler: app.requireUser,
      config: { rateLimit: { max: 60, timeWindow: "1 minute" } },
      schema: {
        querystring: placeSuggestQuerySchema,
        response: { 200: placeSuggestionsSchema, 401: errorResponseSchema, 429: errorResponseSchema },
      },
    },
    async (request) => {
      const userId = request.session?.user.id;
      if (!userId) throw ApiError.unauthenticated();
      if (!places.enabled) return { suggestions: [] };
      guard(userId);
      const { q, kind, language } = request.query;
      try {
        return { suggestions: await places.suggest({ q, kind, language: language ?? "en" }) };
      } catch (error) {
        request.log.warn({ err: error }, "places suggest failed");
        return { suggestions: [] };
      }
    },
  );

  app.get(
    "/v1/places/:id",
    {
      preHandler: app.requireUser,
      config: { rateLimit: { max: 60, timeWindow: "1 minute" } },
      schema: {
        params: z.object({ id: z.string().min(1).max(300) }),
        querystring: z.object({ language: z.enum(["en", "he"]).optional() }),
        response: { 200: placeDetailsSchema, 401: errorResponseSchema, 429: errorResponseSchema },
      },
    },
    async (request) => {
      const userId = request.session?.user.id;
      if (!userId) throw ApiError.unauthenticated();
      if (!places.enabled) return EMPTY_PLACE_DETAILS;
      guard(userId);
      try {
        return await places.details({ id: request.params.id, language: request.query.language ?? "en" });
      } catch (error) {
        request.log.warn({ err: error }, "places details failed");
        return EMPTY_PLACE_DETAILS;
      }
    },
  );
};

export default placesRoutes;

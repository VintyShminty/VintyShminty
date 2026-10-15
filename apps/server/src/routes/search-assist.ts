import {
  EMPTY_SEARCH_UNDERSTANDING,
  searchNeedsUnderstanding,
  searchUnderstandingSchema,
  searchUnderstandRequestSchema,
} from "@vinty/shared";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { WindowLimiter } from "../lib/limiter.js";
import { createBrandMatcher } from "../lib/photo-assist.js";
import { createSearchUnderstander, normaliseSearchText, UnderstandingCache } from "../lib/search-assist.js";
import type { SearchReader } from "../lib/search-reader.js";
import { searchRulesIndex, understandByRules } from "../lib/search-rules.js";
import { optionalViewerId } from "../lib/viewer.js";

const UNDERSTANDINGS_PER_HOUR = 20;

/**
 * Search in plain words (D-037): turns "red summer dress under 100" into filters. Fixed rules answer simple searches
 * first, the AI reads the rest. Open to signed out visitors. Always
 * answers 200: when it is off, refused, slow, over its limit or the words are too short the answer is the empty
 * understanding and the search simply uses the exact words.
 */
const searchAssistRoutes: FastifyPluginAsyncZod<{ searchReader: SearchReader }> = async (
  app,
  { searchReader },
) => {
  const limiter = new WindowLimiter(UNDERSTANDINGS_PER_HOUR, 3_600_000);
  const cache = new UnderstandingCache();
  const brandMatcher = createBrandMatcher(app.db);
  const understand = createSearchUnderstander(app, searchReader, brandMatcher);

  app.post(
    "/v1/search/understand",
    {
      config: { rateLimit: { max: 30, timeWindow: "1 minute" } },
      schema: { body: searchUnderstandRequestSchema, response: { 200: searchUnderstandingSchema } },
    },
    async (request) => {
      const { text } = request.body;
      if (!searchReader.enabled || !searchNeedsUnderstanding(text)) return EMPTY_SEARCH_UNDERSTANDING;

      const reference = await app.reference.get();

      // Simple searches are answered by fixed rules: instant, free, no limit used, no AI call. The text is never logged.
      const startedAt = Date.now();
      const byRules = await understandByRules(text, searchRulesIndex(reference), brandMatcher).catch(
        () => null,
      );
      if (byRules) {
        request.log.info({ ms: Date.now() - startedAt, source: "rules" }, "search helper read");
        return byRules;
      }

      const cacheKey = `${reference.version}|${normaliseSearchText(text)}`;
      const remembered = cache.get(cacheKey);
      if (remembered) return remembered;

      const userId = await optionalViewerId(app, request);
      // Counted per person when signed in, otherwise per address. Only calls that reach the AI count.
      if (!limiter.take(userId ?? request.ip)) return EMPTY_SEARCH_UNDERSTANDING;

      const { understanding, ok } = await understand({
        text,
        ...(userId ? { userId } : {}),
        log: request.log,
      });
      if (ok) cache.set(cacheKey, understanding);
      return understanding;
    },
  );
};

export default searchAssistRoutes;

import { EMPTY_HELP_ANSWER, helpAnswerSchema, helpAskRequestSchema } from "@vinty/shared";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import {
  createHelpAnswerer,
  HelpAnswerCache,
  type HelpReader,
  normaliseQuestion,
} from "../lib/help-answer.js";
import { WindowLimiter } from "../lib/limiter.js";
import { optionalViewerId } from "../lib/viewer.js";

const ANSWERS_PER_HOUR = 20;

/**
 * Help answers (D-043): a question in plain words, answered from our help articles only. Open to signed out visitors.
 * Always answers 200: when it is off, refused, slow, over its limit or failed the answer is the empty one and the
 * page offers "Write to us".
 */
const helpAssistRoutes: FastifyPluginAsyncZod<{ helpReader: HelpReader }> = async (app, { helpReader }) => {
  const limiter = new WindowLimiter(ANSWERS_PER_HOUR, 3_600_000);
  const cache = new HelpAnswerCache();
  const answerQuestion = createHelpAnswerer(helpReader);

  app.post(
    "/v1/help/ask",
    {
      config: { rateLimit: { max: 30, timeWindow: "1 minute" } },
      schema: { body: helpAskRequestSchema, response: { 200: helpAnswerSchema } },
    },
    async (request) => {
      const { question, language } = request.body;
      if (!helpReader.enabled) return EMPTY_HELP_ANSWER;

      const cacheKey = `${language}|${normaliseQuestion(question)}`;
      const remembered = cache.get(cacheKey);
      if (remembered) return remembered;

      const userId = await optionalViewerId(app, request);
      // Counted per person when signed in, otherwise per address. Only calls that reach the AI count.
      if (!limiter.take(userId ?? request.ip)) return EMPTY_HELP_ANSWER;

      const { answer, ok } = await answerQuestion({
        question,
        language,
        ...(userId ? { userId } : {}),
        log: request.log,
      });
      if (ok) cache.set(cacheKey, answer);
      return answer;
    },
  );
};

export default helpAssistRoutes;

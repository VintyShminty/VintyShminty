import { errorResponseSchema, idSchema, quickRepliesRequestSchema, quickRepliesSchema } from "@vinty/shared";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import { ApiError } from "../lib/errors.js";
import type { QuickReplier } from "../lib/quick-replies.js";

/**
 * Chat quick replies (D-039): up to 3 suggested replies for the newest message. Always 200 for a person in the chat,
 * empty when the AI is off, refused, slow, or there is nothing to answer. A stranger gets 404 like every other chat route.
 */
const quickReplyRoutes: FastifyPluginAsyncZod<{ replier: QuickReplier }> = async (app, { replier }) => {
  app.post(
    "/v1/conversations/:id/quick-replies",
    {
      preHandler: app.requireUser,
      // The per person hourly limit is counted inside. This only guards the request count from one address.
      config: { rateLimit: { max: 60, timeWindow: "1 minute" } },
      schema: {
        params: z.object({ id: idSchema }),
        body: quickRepliesRequestSchema,
        response: {
          200: quickRepliesSchema,
          401: errorResponseSchema,
          403: errorResponseSchema,
          404: errorResponseSchema,
        },
      },
    },
    async (request) => {
      const userId = request.session?.user.id;
      if (!userId) throw ApiError.unauthenticated();
      return replier({
        conversationId: request.params.id,
        userId,
        language: request.body.language,
        log: request.log,
      });
    },
  );
};

export default quickReplyRoutes;

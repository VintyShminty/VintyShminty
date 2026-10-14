import { errorResponseSchema, uploadRequestSchema, uploadResponseSchema } from "@vinty/shared";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { ApiError } from "../lib/errors.js";
import { presignUploadResponse } from "../lib/storage.js";

const uploadRoutes: FastifyPluginAsyncZod = async (app) => {
  /** The app never sends a file through the API. It gets a signed address and uploads straight to storage. */
  app.post(
    "/v1/uploads",
    {
      preHandler: app.requireUser,
      config: { rateLimit: { max: 30, timeWindow: "1 minute" } },
      schema: {
        body: uploadRequestSchema,
        response: { 200: uploadResponseSchema, 401: errorResponseSchema },
      },
    },
    async (request) => {
      const userId = request.session?.user.id;
      if (!userId) throw ApiError.unauthenticated();
      const { purpose, contentType, byteSize } = request.body;
      return presignUploadResponse(app.storage, { userId, purpose, contentType, byteSize });
    },
  );
};

export default uploadRoutes;

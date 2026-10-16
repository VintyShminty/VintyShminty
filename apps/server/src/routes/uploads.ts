import {
  cropPhotoInputSchema,
  errorResponseSchema,
  rotatePhotoInputSchema,
  rotatePhotoResponseSchema,
  uploadRequestSchema,
  uploadResponseSchema,
} from "@vinty/shared";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { ApiError } from "../lib/errors.js";
import { cropStoredPhoto, rotateStoredPhoto } from "../lib/photo-edit.js";
import { keyBelongsToUser, presignUploadResponse } from "../lib/storage.js";

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

  /**
   * Turns an uploaded listing photo a quarter turn (for a photo the phone saved sideways). The turned picture is saved
   * under a new key, because a stored file never changes (phones keep it for a year). The caller saves the listing
   * with the new key, which also clears out the old file.
   */
  app.post(
    "/v1/uploads/rotate",
    {
      preHandler: app.requireUser,
      config: { rateLimit: { max: 30, timeWindow: "1 minute" } },
      schema: {
        body: rotatePhotoInputSchema,
        response: {
          200: rotatePhotoResponseSchema,
          400: errorResponseSchema,
          401: errorResponseSchema,
        },
      },
    },
    async (request) => {
      const userId = request.session?.user.id;
      if (!userId) throw ApiError.unauthenticated();
      const { key, direction } = request.body;
      if (!keyBelongsToUser(key, "listing_photo", userId)) {
        throw ApiError.invalid("That photo is not yours", { key: "validation.listing.photos.invalid" });
      }
      return rotateStoredPhoto(app.storage, key, direction);
    },
  );

  /** Crops an uploaded listing photo to a rectangle given in fractions of the photo. Saved under a new key, like a turn. */
  app.post(
    "/v1/uploads/crop",
    {
      preHandler: app.requireUser,
      config: { rateLimit: { max: 30, timeWindow: "1 minute" } },
      schema: {
        body: cropPhotoInputSchema,
        response: {
          200: rotatePhotoResponseSchema,
          400: errorResponseSchema,
          401: errorResponseSchema,
        },
      },
    },
    async (request) => {
      const userId = request.session?.user.id;
      if (!userId) throw ApiError.unauthenticated();
      const { key, x, y, width, height } = request.body;
      if (!keyBelongsToUser(key, "listing_photo", userId)) {
        throw ApiError.invalid("That photo is not yours", { key: "validation.listing.photos.invalid" });
      }
      return cropStoredPhoto(app.storage, key, { x, y, width, height });
    },
  );
};

export default uploadRoutes;

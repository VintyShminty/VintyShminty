import { randomUUID } from "node:crypto";
import {
  errorResponseSchema,
  rotatePhotoInputSchema,
  rotatePhotoResponseSchema,
  uploadRequestSchema,
  uploadResponseSchema,
} from "@vinty/shared";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import sharp from "sharp";
import { ApiError } from "../lib/errors.js";
import { keyBelongsToUser, MAX_UPLOAD_BYTES, presignUploadResponse } from "../lib/storage.js";

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
      const original = await app.storage.read(key, MAX_UPLOAD_BYTES.listing_photo);
      if (!original)
        throw ApiError.invalid("That photo could not be read", { key: "validation.listing.photos.invalid" });
      let turned: Buffer;
      try {
        // The first rotate() applies the camera's own orientation tag, the second is the quarter turn.
        turned = await sharp(original)
          .rotate()
          .rotate(direction === "cw" ? 90 : 270)
          .jpeg({ quality: 85 })
          .toBuffer();
      } catch {
        throw ApiError.invalid("That photo could not be read", { key: "validation.listing.photos.invalid" });
      }
      const newKey = `${key.slice(0, key.lastIndexOf("/") + 1)}${randomUUID()}.jpg`;
      await app.storage.put(newKey, turned, "image/jpeg");
      return { key: newKey, publicUrl: app.storage.publicUrl(newKey) };
    },
  );
};

export default uploadRoutes;

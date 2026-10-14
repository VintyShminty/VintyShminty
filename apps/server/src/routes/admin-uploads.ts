import {
  adminPublishInputSchema,
  adminPublishResultSchema,
  adminSuggestInputSchema,
  adminUploadRequestSchema,
  adminUploadsFilterSchema,
  adminUploadsPageSchema,
  adminUploadsQuerySchema,
  createStandInInputSchema,
  EMPTY_PHOTO_SUGGESTION,
  errorResponseSchema,
  idSchema,
  photoSuggestionSchema,
  standInSchema,
  standInsSchema,
  uploadResponseSchema,
} from "@vinty/shared";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { webOrigins } from "../env.js";
import { type Db, writeAudit } from "../lib/admin.js";
import {
  allUploads,
  buildUploadsWorkbook,
  createStandIn,
  exportFileName,
  findStandIn,
  listStandIns,
  listUploads,
  publishBatch,
} from "../lib/admin-uploads.js";
import { ApiError } from "../lib/errors.js";
import { createListingWriter } from "../lib/listing-write.js";
import { createPhotoSuggester } from "../lib/photo-assist.js";
import type { PhotoReader } from "../lib/photo-reader.js";
import { keyBelongsToUser, presignUploadResponse } from "../lib/storage.js";

const errors = {
  400: errorResponseSchema,
  401: errorResponseSchema,
  403: errorResponseSchema,
  404: errorResponseSchema,
  409: errorResponseSchema,
};
const idParams = z.object({ id: idSchema });

type Deps = {
  db: Db;
  preHandler: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  adminIdOf: (request: { session: { user: { id: string } } | null }) => string;
  /** The photo reader behind the AI meter, counted under the action "admin_upload_photo_check". */
  reader: PhotoReader;
};

/**
 * The listing upload API of the admin panel (docs/blueprint/api.md, "Admin panel, listing upload"). Called from
 * routes/admin.ts, so it shares the admin guard. Every answer here can contain the private owner full name or lets an
 * admin create public listings, so nothing in this file is reachable without the admin check.
 */
export function registerAdminUploadRoutes(app: FastifyInstance, { db, preHandler, adminIdOf, reader }: Deps) {
  const rateLimit = { rateLimit: { max: 120, timeWindow: "1 minute" } };
  // A pile of 50 photos starts 50 upload requests and as many photo reads within a minute.
  const busyLimit = { rateLimit: { max: 600, timeWindow: "1 minute" } };
  const writer = createListingWriter({ db, storage: app.storage, log: app.log });
  const suggest = createPhotoSuggester(app, reader);
  // The server of this website forwards /v1 to us, so the address in a link is the website's own.
  const siteBase = () =>
    webOrigins(app.env).find((o) => o.startsWith("https://")) ?? webOrigins(app.env)[0] ?? "";
  const typed = app.withTypeProvider<import("fastify-type-provider-zod").ZodTypeProvider>();

  typed.get(
    "/v1/admin/stand-ins",
    { preHandler, config: rateLimit, schema: { response: { 200: standInsSchema, ...errors } } },
    async () => ({ items: await listStandIns(db) }),
  );

  typed.post(
    "/v1/admin/stand-ins",
    {
      preHandler,
      config: rateLimit,
      schema: { body: createStandInInputSchema, response: { 201: standInSchema, ...errors } },
    },
    async (request, reply) => {
      const created = await createStandIn(db, adminIdOf(request), request.body);
      return reply.code(201).send(created);
    },
  );

  typed.post(
    "/v1/admin/stand-ins/:id/uploads",
    {
      preHandler,
      config: busyLimit,
      schema: {
        params: idParams,
        body: adminUploadRequestSchema,
        response: { 200: uploadResponseSchema, ...errors },
      },
    },
    async (request) => {
      const standIn = await findStandIn(db, request.params.id);
      const { contentType, byteSize } = request.body;
      return presignUploadResponse(app.storage, {
        userId: standIn.id,
        purpose: "listing_photo",
        contentType,
        byteSize,
      });
    },
  );

  typed.post(
    "/v1/admin/stand-ins/:id/suggest",
    {
      preHandler,
      config: busyLimit,
      schema: {
        params: idParams,
        body: adminSuggestInputSchema,
        response: { 200: photoSuggestionSchema, ...errors },
      },
    },
    async (request) => {
      const standIn = await findStandIn(db, request.params.id);
      const keys = [...new Set(request.body.photoKeys)];
      if (!keys.every((key) => keyBelongsToUser(key, "listing_photo", standIn.id))) {
        throw ApiError.invalid("Those photos are not in this username's folder");
      }
      if (!reader.enabled) return EMPTY_PHOTO_SUGGESTION;
      // The AI meter refuses when the switch is off or a cap is reached: the suggestion is then simply empty.
      return suggest({ keys, language: request.body.language, userId: adminIdOf(request), log: request.log });
    },
  );

  typed.post(
    "/v1/admin/stand-ins/:id/listings",
    {
      preHandler,
      config: rateLimit,
      schema: {
        params: idParams,
        body: adminPublishInputSchema,
        response: { 200: adminPublishResultSchema, ...errors },
      },
    },
    async (request) => {
      const standIn = await findStandIn(db, request.params.id);
      return publishBatch({
        db,
        writer,
        reference: await app.reference.get(),
        adminId: adminIdOf(request),
        standIn,
        ownerFullName: request.body.ownerFullName,
        items: request.body.items,
        log: request.log,
      });
    },
  );

  typed.get(
    "/v1/admin/uploads",
    {
      preHandler,
      config: rateLimit,
      schema: { querystring: adminUploadsQuerySchema, response: { 200: adminUploadsPageSchema, ...errors } },
    },
    async (request) => listUploads(db, await app.reference.get(), request.query),
  );

  typed.get(
    "/v1/admin/uploads/export.xlsx",
    {
      preHandler,
      config: { rateLimit: { max: 20, timeWindow: "1 minute" } },
      schema: { querystring: adminUploadsFilterSchema },
    },
    async (request, reply) => {
      const adminId = adminIdOf(request);
      const rows = await allUploads(db, await app.reference.get(), request.query);
      const file = await buildUploadsWorkbook(rows, siteBase());
      await writeAudit(db, adminId, "uploads_exported", "uploads", null, {
        rows: rows.length,
        standInId: request.query.standInId ?? null,
        owner: request.query.owner ?? null,
        status: request.query.status,
      });
      return reply
        .header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
        .header("Content-Disposition", `attachment; filename="${exportFileName()}"`)
        .header("Cache-Control", "no-store")
        .send(file);
    },
  );
}

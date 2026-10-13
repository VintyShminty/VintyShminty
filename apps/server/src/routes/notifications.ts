import { notifications, pushTokens } from "@vinty/db";
import {
  errorResponseSchema,
  markNotificationsReadInputSchema,
  notificationPageSchema,
  paginationQuerySchema,
  pushTokenInputSchema,
  unreadCountsSchema,
} from "@vinty/shared";
import { and, desc, eq, inArray, isNull, notInArray, sql } from "drizzle-orm";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import { ApiError } from "../lib/errors.js";
import { keysetCursor, olderThan, tsText } from "../lib/keyset.js";
import { broadcastUnread, unreadCounts } from "../lib/messaging.js";
import { INBOX_HIDDEN_TYPES, presentNotifications } from "../lib/notify.js";

const WRITE_LIMIT = { rateLimit: { max: 60, timeWindow: "1 minute" } };

/** The red dots, the Notifications tab and the phone's push registration (Milestones 1 and 4). */
const notificationRoutes: FastifyPluginAsyncZod = async (app) => {
  const { db } = app;
  const preHandler = app.requireUser;

  const userIdOf = (request: { session: { user: { id: string } } | null }) => {
    if (!request.session) throw ApiError.unauthenticated();
    return request.session.user.id;
  };

  app.get(
    "/v1/me/unread",
    { preHandler, schema: { response: { 200: unreadCountsSchema, 401: errorResponseSchema } } },
    async (request) => unreadCounts(app, userIdOf(request)),
  );

  app.get(
    "/v1/me/notifications",
    {
      preHandler,
      schema: {
        querystring: paginationQuerySchema,
        response: { 200: notificationPageSchema, 401: errorResponseSchema },
      },
    },
    async (request) => {
      const userId = userIdOf(request);
      const { cursor, limit } = request.query;
      const rows = await db
        .select({ n: notifications, cursorTs: tsText(notifications.createdAt) })
        .from(notifications)
        .where(
          and(
            eq(notifications.userId, userId),
            notInArray(notifications.type, [...INBOX_HIDDEN_TYPES]),
            olderThan(cursor, notifications.createdAt, notifications.id),
          ),
        )
        .orderBy(desc(notifications.createdAt), desc(notifications.id))
        .limit(limit + 1);
      const page = rows.slice(0, limit);
      const last = page.at(-1);
      return {
        items: await presentNotifications(
          app,
          page.map((r) => r.n),
        ),
        nextCursor: rows.length > limit && last ? keysetCursor(last.cursorTs, last.n.id) : null,
      };
    },
  );

  app.post(
    "/v1/me/notifications/read",
    {
      preHandler,
      config: WRITE_LIMIT,
      schema: {
        body: markNotificationsReadInputSchema,
        response: { 204: z.null(), 401: errorResponseSchema },
      },
    },
    async (request, reply) => {
      const userId = userIdOf(request);
      const { ids } = request.body;
      await db
        .update(notifications)
        .set({ readAt: new Date() })
        .where(
          and(
            eq(notifications.userId, userId),
            isNull(notifications.readAt),
            ...(ids ? [inArray(notifications.id, ids)] : []),
          ),
        );
      await broadcastUnread(app, userId);
      return reply.code(204).send(null);
    },
  );

  app.post(
    "/v1/me/push-tokens",
    {
      preHandler,
      config: WRITE_LIMIT,
      schema: { body: pushTokenInputSchema, response: { 204: z.null(), 401: errorResponseSchema } },
    },
    async (request, reply) => {
      const userId = userIdOf(request);
      const { token, platform, deviceId, locale } = request.body;
      // The same phone may be handed to another person, so the token follows whoever registered it last.
      await db
        .insert(pushTokens)
        .values({ userId, token, platform, deviceId: deviceId ?? null, locale: locale ?? null })
        .onConflictDoUpdate({
          target: pushTokens.token,
          set: {
            userId,
            platform,
            deviceId: deviceId ?? null,
            locale: locale ?? null,
            lastSeenAt: sql`now()`,
            revokedAt: null,
          },
        });
      return reply.code(204).send(null);
    },
  );

  app.delete(
    "/v1/me/push-tokens/:token",
    {
      preHandler,
      schema: {
        params: z.object({ token: z.string().min(1).max(500) }),
        response: { 204: z.null(), 401: errorResponseSchema },
      },
    },
    async (request, reply) => {
      // Idempotent: a token that is unknown, already revoked or someone else's changes nothing.
      await db
        .update(pushTokens)
        .set({ revokedAt: new Date() })
        .where(
          and(
            eq(pushTokens.userId, userIdOf(request)),
            eq(pushTokens.token, request.params.token),
            isNull(pushTokens.revokedAt),
          ),
        );
      return reply.code(204).send(null);
    },
  );
};

export default notificationRoutes;

import { conversations, listings, messages, profiles } from "@vinty/db";
import {
  archiveInputSchema,
  conversationDetailSchema,
  conversationPageSchema,
  conversationsQuerySchema,
  createConversationInputSchema,
  errorResponseSchema,
  idSchema,
  type Message,
  messagePageSchema,
  messageSchema,
  messagesQuerySchema,
  muteInputSchema,
  sendMessageInputSchema,
} from "@vinty/shared";
import { and, desc, eq, isNotNull, isNull, or, sql } from "drizzle-orm";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import { ApiError } from "../lib/errors.js";
import { keysetCursor, olderThan, tsText } from "../lib/keyset.js";
import {
  conversationFields,
  isBlockedBetween,
  loadConversationDetail,
  markRead,
  presentConversationRows,
  presentMessages,
  requireParty,
  sendMessage,
  setArchived,
  setMuted,
} from "../lib/messaging.js";

const idParams = z.object({ id: idSchema });
const WRITE_LIMIT = { rateLimit: { max: 60, timeWindow: "1 minute" } };
const errors = { 401: errorResponseSchema, 403: errorResponseSchema, 404: errorResponseSchema };

/** Inbox, conversations, messages (Milestone 4). The socket (plugins/messaging.ts) calls the same functions. */
const messageRoutes: FastifyPluginAsyncZod = async (app) => {
  const { db } = app;
  const preHandler = app.requireUser;

  const userIdOf = (request: { session: { user: { id: string } } | null }) => {
    if (!request.session) throw ApiError.unauthenticated();
    return request.session.user.id;
  };

  app.get(
    "/v1/conversations",
    {
      preHandler,
      schema: {
        querystring: conversationsQuerySchema,
        response: { 200: conversationPageSchema, 401: errorResponseSchema },
      },
    },
    async (request) => {
      const userId = userIdOf(request);
      const { archived, cursor, limit } = request.query;
      const mine = archived
        ? or(
            and(eq(conversations.buyerId, userId), isNotNull(conversations.buyerArchivedAt)),
            and(eq(conversations.sellerId, userId), isNotNull(conversations.sellerArchivedAt)),
          )
        : or(
            and(eq(conversations.buyerId, userId), isNull(conversations.buyerArchivedAt)),
            and(eq(conversations.sellerId, userId), isNull(conversations.sellerArchivedAt)),
          );
      // A chat only shows up once something was said, so tapping Ask seller and leaving leaves no empty row.
      const hasMessage = sql`exists (select 1 from ${messages} where ${messages.conversationId} = ${conversations.id} and ${messages.deletedAt} is null)`;
      const rows = await db
        .select(conversationFields(userId))
        .from(conversations)
        .innerJoin(listings, eq(listings.id, conversations.listingId))
        .where(and(mine, hasMessage, olderThan(cursor, conversations.lastMessageAt, conversations.id)))
        .orderBy(desc(conversations.lastMessageAt), desc(conversations.id))
        .limit(limit + 1);
      const page = rows.slice(0, limit);
      const last = page.at(-1);
      return {
        items: await presentConversationRows(app, userId, page),
        nextCursor: rows.length > limit && last ? keysetCursor(last.cursorTs, last.c.id) : null,
      };
    },
  );

  app.post(
    "/v1/conversations",
    {
      preHandler,
      config: WRITE_LIMIT,
      schema: {
        body: createConversationInputSchema,
        response: {
          200: conversationDetailSchema,
          201: conversationDetailSchema,
          ...errors,
          409: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const userId = userIdOf(request);
      const { listingId, body, clientMessageId } = request.body;
      const [listing] = await db.select().from(listings).where(eq(listings.id, listingId)).limit(1);
      if (
        !listing ||
        listing.status === "draft" ||
        listing.status === "hidden" ||
        listing.status === "removed"
      ) {
        throw ApiError.notFound();
      }
      if (listing.sellerId === userId) throw ApiError.forbidden("You cannot message yourself");
      const [seller] = await db
        .select({ deletedAt: profiles.deletedAt })
        .from(profiles)
        .where(eq(profiles.userId, listing.sellerId))
        .limit(1);
      if (!seller || seller.deletedAt) throw ApiError.notFound();
      if (await isBlockedBetween(app, userId, listing.sellerId)) {
        throw new ApiError(403, "blocked", "You cannot message this person");
      }

      const [found] = await db
        .select({ id: conversations.id })
        .from(conversations)
        .where(and(eq(conversations.listingId, listingId), eq(conversations.buyerId, userId)))
        .limit(1);
      let conversationId = found?.id;
      let created = false;
      if (!conversationId) {
        // Sold items keep their old chats but take no new ones.
        if (listing.status === "sold") {
          throw new ApiError(409, "listing_unavailable", "This item has been sold");
        }
        const inserted = await db
          .insert(conversations)
          .values({ listingId, buyerId: userId, sellerId: listing.sellerId })
          .onConflictDoNothing()
          .returning({ id: conversations.id });
        created = inserted.length > 0;
        conversationId =
          inserted[0]?.id ??
          (
            await db
              .select({ id: conversations.id })
              .from(conversations)
              .where(and(eq(conversations.listingId, listingId), eq(conversations.buyerId, userId)))
              .limit(1)
          )[0]?.id;
      }
      if (!conversationId) throw new Error("Conversation was not created");

      if (body) {
        await sendMessage(app, userId, conversationId, {
          kind: "text",
          body,
          clientMessageId: clientMessageId ?? crypto.randomUUID(),
        });
      }
      return reply.code(created ? 201 : 200).send(await loadConversationDetail(app, userId, conversationId));
    },
  );

  app.get(
    "/v1/conversations/:id",
    {
      preHandler,
      schema: { params: idParams, response: { 200: conversationDetailSchema, ...errors } },
    },
    async (request) => loadConversationDetail(app, userIdOf(request), request.params.id),
  );

  app.get(
    "/v1/conversations/:id/messages",
    {
      preHandler,
      schema: {
        params: idParams,
        querystring: messagesQuerySchema,
        response: { 200: messagePageSchema, ...errors },
      },
    },
    async (request) => {
      const userId = userIdOf(request);
      await requireParty(app, request.params.id, userId);
      const { cursor, limit } = request.query;
      const rows = await db
        .select({ m: messages, cursorTs: tsText(messages.createdAt) })
        .from(messages)
        .where(
          and(
            eq(messages.conversationId, request.params.id),
            isNull(messages.deletedAt),
            olderThan(cursor, messages.createdAt, messages.id),
          ),
        )
        .orderBy(desc(messages.createdAt), desc(messages.id))
        .limit(limit + 1);
      const page = rows.slice(0, limit);
      const last = page.at(-1);
      return {
        items: await presentMessages(
          app,
          page.map((r) => r.m),
        ),
        nextCursor: rows.length > limit && last ? keysetCursor(last.cursorTs, last.m.id) : null,
      };
    },
  );

  app.post(
    "/v1/conversations/:id/messages",
    {
      preHandler,
      config: WRITE_LIMIT,
      schema: {
        params: idParams,
        body: sendMessageInputSchema,
        response: {
          200: messageSchema,
          201: messageSchema,
          ...errors,
          429: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { message, created } = await sendMessage(app, userIdOf(request), request.params.id, request.body);
      return reply.code(created ? 201 : 200).send(message satisfies Message);
    },
  );

  app.post(
    "/v1/conversations/:id/read",
    { preHandler, schema: { params: idParams, response: { 204: z.null(), ...errors } } },
    async (request, reply) => {
      await markRead(app, userIdOf(request), request.params.id);
      return reply.code(204).send(null);
    },
  );

  app.put(
    "/v1/conversations/:id/archive",
    {
      preHandler,
      schema: { params: idParams, body: archiveInputSchema, response: { 204: z.null(), ...errors } },
    },
    async (request, reply) => {
      await setArchived(app, userIdOf(request), request.params.id, request.body.archived);
      return reply.code(204).send(null);
    },
  );

  app.put(
    "/v1/conversations/:id/mute",
    {
      preHandler,
      schema: { params: idParams, body: muteInputSchema, response: { 204: z.null(), ...errors } },
    },
    async (request, reply) => {
      await setMuted(app, userIdOf(request), request.params.id, request.body.muted);
      return reply.code(204).send(null);
    },
  );
};

export default messageRoutes;

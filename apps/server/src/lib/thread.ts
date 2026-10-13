import {
  conversations,
  type Database,
  favourites,
  listings,
  messages,
  type offers,
  type orders,
} from "@vinty/db";
import type { MessageKind, SystemMessageEvent } from "@vinty/shared";
import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { broadcastUnread, presentMessages } from "./messaging.js";

type Db = NonNullable<Database["db"]>;
type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
type App = FastifyInstance;
export type ConversationRecord = typeof conversations.$inferSelect;
export type MessageRecord = typeof messages.$inferSelect;
export type OfferRecord = typeof offers.$inferSelect;
export type OrderRecord = typeof orders.$inferSelect;

/**
 * Writes a divider into the thread ("Order shipped", "Offer accepted"). It runs inside the same transaction as
 * the change it describes, and moves the chat to the top of both inboxes.
 */
export async function insertSystemMessage(
  tx: Tx,
  input: {
    conversationId: string;
    event: SystemMessageEvent;
    orderId?: string | null;
    payload?: Record<string, unknown>;
    at: Date;
  },
): Promise<MessageRecord> {
  const [row] = await tx
    .insert(messages)
    .values({
      conversationId: input.conversationId,
      senderId: null,
      kind: "system",
      systemEvent: input.event,
      orderId: input.orderId ?? null,
      payload: input.payload ?? null,
      createdAt: input.at,
    })
    .returning();
  if (!row) throw new Error("System message was not saved");
  await touchConversation(tx, input.conversationId, input.at);
  return row;
}

/** An offer bubble. The sender counts as having read the thread. */
export async function insertOfferMessage(
  tx: Tx,
  input: { conversationId: string; senderId: string; offerId: string; at: Date },
): Promise<MessageRecord> {
  const [row] = await tx
    .insert(messages)
    .values({
      conversationId: input.conversationId,
      senderId: input.senderId,
      kind: "offer",
      offerId: input.offerId,
      createdAt: input.at,
    })
    .returning();
  if (!row) throw new Error("Offer message was not saved");
  await touchConversation(tx, input.conversationId, input.at);
  return row;
}

/** Moves the chat to the top of both inboxes and out of the archive. A divider has no text preview. */
async function touchConversation(tx: Tx, conversationId: string, at: Date) {
  await tx
    .update(conversations)
    .set({ lastMessageAt: at, lastMessagePreview: null, buyerArchivedAt: null, sellerArchivedAt: null })
    .where(eq(conversations.id, conversationId));
}

/** Both people's personal rooms and the thread room: every event about an offer or order goes to these and no one else. */
export const partyRooms = (c: Pick<ConversationRecord, "id" | "buyerId" | "sellerId">) => [
  `user:${c.buyerId}`,
  `user:${c.sellerId}`,
  `conversation:${c.id}`,
];

/** After the commit: tell both people's open apps about new bubbles and dividers, and refresh the red dots. */
export async function broadcastNewMessages(
  app: App,
  conversation: Pick<ConversationRecord, "id" | "buyerId" | "sellerId">,
  rows: MessageRecord[],
): Promise<void> {
  if (rows.length === 0) return;
  const presented = await presentMessages(app, rows);
  const rooms = app.realtime.toRooms(partyRooms(conversation));
  for (const message of presented) rooms.emit("message:new", { conversationId: conversation.id, message });
  const last = rows.reduce((a, b) => (a.createdAt >= b.createdAt ? a : b));
  const lastKind = last.kind as MessageKind;
  for (const userId of [conversation.buyerId, conversation.sellerId]) {
    app.realtime.toUser(userId).emit("conversation:updated", {
      conversationId: conversation.id,
      lastMessagePreview: null,
      lastMessageKind: lastKind,
      lastMessageAt: last.createdAt.toISOString(),
      // A divider or someone else's bubble is unread for the person who did not write it.
      unread: last.senderId !== userId,
    });
    await broadcastUnread(app, userId);
  }
}

/** An offer bubble changed status: redraw it in both people's apps. */
export async function broadcastOfferUpdated(
  app: App,
  conversation: Pick<ConversationRecord, "id" | "buyerId" | "sellerId">,
  offerId: string,
): Promise<void> {
  const rows = await app.db.select().from(messages).where(eq(messages.offerId, offerId));
  const presented = await presentMessages(app, rows);
  const rooms = app.realtime.toRooms(partyRooms(conversation));
  for (const message of presented) {
    if (message.offer) {
      rooms.emit("message:updated", {
        conversationId: conversation.id,
        messageId: message.id,
        offer: message.offer,
      });
    }
  }
}

/** The people who care when a listing's state changes: the seller, whoever hearted it, and whoever chats about it. */
export async function listingAudience(db: Db, listingId: string, extra: string[] = []): Promise<string[]> {
  const [[row], hearted, chatting] = await Promise.all([
    db.select({ sellerId: listings.sellerId }).from(listings).where(eq(listings.id, listingId)).limit(1),
    db
      .select({ id: favourites.userId })
      .from(favourites)
      .where(eq(favourites.listingId, listingId))
      .limit(1000),
    db
      .select({ id: conversations.buyerId })
      .from(conversations)
      .where(eq(conversations.listingId, listingId))
      .limit(1000),
  ]);
  return [
    ...new Set([...(row ? [row.sellerId] : []), ...hearted.map((h) => h.id), ...chatting.map((c) => c.id), ...extra]),
  ];
}

/** Tells the right people's apps that a listing was reserved, sold or put back on sale. */
export async function broadcastListingUpdated(
  app: App,
  listingIds: string[],
  extraAudience: string[] = [],
): Promise<void> {
  for (const listingId of listingIds) {
    const [row] = await app.db
      .select({ status: listings.status, priceMinor: listings.priceMinor })
      .from(listings)
      .where(eq(listings.id, listingId))
      .limit(1);
    if (!row) continue;
    const audience = await listingAudience(app.db, listingId, extraAudience);
    if (audience.length === 0) continue;
    app.realtime
      .toRooms(audience.map((id) => `user:${id}`))
      .emit("listing:updated", { listingId, status: row.status, priceMinor: row.priceMinor });
  }
}

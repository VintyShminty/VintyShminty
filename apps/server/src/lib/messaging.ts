import {
  blocks,
  conversations,
  listingPhotos,
  listings,
  messages,
  notifications,
  offers,
  orders,
  profiles,
  userSettings,
  users,
} from "@vinty/db";
import {
  type ConversationDetail,
  type ConversationRow,
  MESSAGE_PREVIEW_MAX,
  type Message,
  type MessageKind,
  type SendMessageInput,
  type UnreadCounts,
  type UserSummary,
} from "@vinty/shared";
import { and, desc, eq, inArray, isNull, or, sql } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { loadSellerSummaries } from "./discovery.js";
import { ApiError } from "./errors.js";
import { tsText } from "./keyset.js";
import { buyerPrice } from "./listings.js";
import { INBOX_HIDDEN_TYPES, notifyUser } from "./notify.js";
import { keyBelongsToUser, MAX_UPLOAD_BYTES } from "./storage.js";

type App = Pick<
  FastifyInstance,
  "db" | "storage" | "realtime" | "pusher" | "messageLimits" | "log" | "reference"
>;
type ConversationRecord = typeof conversations.$inferSelect;
type MessageRecord = typeof messages.$inferSelect;

export type Side = "buyer" | "seller";

export const sideOf = (conversation: Pick<ConversationRecord, "buyerId">, userId: string): Side =>
  conversation.buyerId === userId ? "buyer" : "seller";

export const otherPersonId = (
  conversation: Pick<ConversationRecord, "buyerId" | "sellerId">,
  userId: string,
) => (conversation.buyerId === userId ? conversation.sellerId : conversation.buyerId);

/** The conversation, if this person is the buyer or the seller. A stranger gets 404, we do not reveal it exists. */
export async function requireParty(
  { db }: Pick<App, "db">,
  conversationId: string,
  userId: string,
): Promise<ConversationRecord> {
  const [row] = await db
    .select()
    .from(conversations)
    .where(
      and(
        eq(conversations.id, conversationId),
        or(eq(conversations.buyerId, userId), eq(conversations.sellerId, userId)),
      ),
    )
    .limit(1);
  if (!row) throw ApiError.notFound();
  return row;
}

export async function isBlockedBetween({ db }: Pick<App, "db">, a: string, b: string): Promise<boolean> {
  const [row] = await db
    .select({ one: sql<number>`1` })
    .from(blocks)
    .where(
      or(
        and(eq(blocks.blockerId, a), eq(blocks.blockedId, b)),
        and(eq(blocks.blockerId, b), eq(blocks.blockedId, a)),
      ),
    )
    .limit(1);
  return Boolean(row);
}

// ---- Unread ----

/** True when the person has something unread: messages from the other side or the system after the read marker. */
const unreadSql = (userId: string) => {
  const marker = sql`case when ${conversations.buyerId} = ${userId} then ${conversations.buyerLastReadAt} else ${conversations.sellerLastReadAt} end`;
  return sql<boolean>`exists (select 1 from ${messages} where ${messages.conversationId} = ${conversations.id} and ${messages.deletedAt} is null and ${messages.senderId} is distinct from ${userId} and ${messages.createdAt} > coalesce(${marker}, '-infinity'::timestamptz))`;
};

/** The red dots. Messages counts chats with something unread, leaving out muted and archived chats. */
export async function unreadCounts({ db }: Pick<App, "db">, userId: string): Promise<UnreadCounts> {
  const [chats] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(conversations)
    .where(
      and(
        or(
          and(
            eq(conversations.buyerId, userId),
            isNull(conversations.buyerArchivedAt),
            isNull(conversations.buyerMutedAt),
          ),
          and(
            eq(conversations.sellerId, userId),
            isNull(conversations.sellerArchivedAt),
            isNull(conversations.sellerMutedAt),
          ),
        ),
        unreadSql(userId),
      ),
    );
  const [alerts] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(notifications)
    .where(
      and(
        eq(notifications.userId, userId),
        isNull(notifications.readAt),
        sql`${notifications.type} not in ${INBOX_HIDDEN_TYPES}`,
      ),
    );
  return { messages: chats?.n ?? 0, notifications: alerts?.n ?? 0 };
}

/** Tells the person's devices their red dots changed. */
export async function broadcastUnread(app: App, userId: string): Promise<void> {
  app.realtime.toUser(userId).emit("unread:count", await unreadCounts(app, userId));
}

// ---- Presenting ----

export const previewOf = (text: string) => {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > MESSAGE_PREVIEW_MAX ? `${flat.slice(0, MESSAGE_PREVIEW_MAX - 1)}…` : flat;
};

/** Messages as the app draws them, with the current status of any offer behind a bubble. */
export async function presentMessages(
  app: Pick<App, "db" | "storage">,
  rows: MessageRecord[],
): Promise<Message[]> {
  const offerIds = [...new Set(rows.flatMap((r) => (r.offerId ? [r.offerId] : [])))];
  const offerRows =
    offerIds.length > 0 ? await app.db.select().from(offers).where(inArray(offers.id, offerIds)) : [];
  const offerById = new Map(offerRows.map((o) => [o.id, o]));
  return rows.map((row) => {
    const offer = row.offerId ? offerById.get(row.offerId) : undefined;
    return {
      id: row.id,
      conversationId: row.conversationId,
      senderId: row.senderId,
      kind: row.kind,
      body: row.body,
      attachment: row.attachmentKey
        ? {
            key: row.attachmentKey,
            url: app.storage.publicUrl(row.attachmentKey),
            width: row.attachmentWidth,
            height: row.attachmentHeight,
          }
        : null,
      offer: offer
        ? {
            id: offer.id,
            amountMinor: offer.amountMinor,
            currency: offer.currency,
            listingPriceMinor: offer.listingPriceMinor,
            status: offer.status,
            offeredById: offer.offeredById,
            expiresAt: offer.expiresAt.toISOString(),
          }
        : null,
      systemEvent: row.systemEvent,
      orderId: row.orderId,
      payload: row.payload ?? null,
      clientMessageId: row.clientMessageId,
      createdAt: row.createdAt.toISOString(),
    };
  });
}

/** The columns every inbox row and the thread header need, as one query shape. */
export function conversationFields(userId: string) {
  return {
    c: conversations,
    listingTitle: listings.title,
    listingStatus: listings.status,
    listingPriceMinor: listings.priceMinor,
    listingCurrency: listings.currency,
    coverKey: sql<
      string | null
    >`(select ${listingPhotos.objectKey} from ${listingPhotos} where ${listingPhotos.listingId} = ${listings.id} order by ${listingPhotos.position} asc limit 1)`,
    lastKind: sql<MessageKind | null>`(select ${messages.kind} from ${messages} where ${messages.conversationId} = ${conversations.id} and ${messages.deletedAt} is null order by ${messages.createdAt} desc, ${messages.id} desc limit 1)`,
    unread: unreadSql(userId),
    cursorTs: tsText(conversations.lastMessageAt),
  };
}

type ConversationQueryRow = {
  c: ConversationRecord;
  listingTitle: string;
  listingStatus: ConversationRow["listing"]["status"];
  listingPriceMinor: number | null;
  listingCurrency: string;
  coverKey: string | null;
  lastKind: MessageKind | null;
  unread: boolean;
};

const emptyUser = (id: string): UserSummary => ({
  id,
  username: null,
  avatarUrl: null,
  ratingAverage: null,
  reviewCount: 0,
});

export async function presentConversationRows(
  app: Pick<App, "db" | "storage">,
  userId: string,
  rows: ConversationQueryRow[],
): Promise<ConversationRow[]> {
  const others = await loadSellerSummaries(
    app,
    rows.map((r) => otherPersonId(r.c, userId)),
  );
  return rows.map((r) => {
    const side = sideOf(r.c, userId);
    const otherId = otherPersonId(r.c, userId);
    return {
      id: r.c.id,
      role: side,
      listing: {
        id: r.c.listingId,
        title: r.listingTitle,
        status: r.listingStatus,
        photoUrl: r.coverKey ? app.storage.publicUrl(r.coverKey) : null,
        priceMinor: r.listingPriceMinor ?? 0,
        currency: r.listingCurrency,
      },
      otherUser: others.get(otherId) ?? emptyUser(otherId),
      // Only text has a preview. A photo, an offer or a divider is drawn by the app from lastMessageKind.
      lastMessagePreview: r.lastKind === "text" ? r.c.lastMessagePreview : null,
      lastMessageKind: r.lastKind,
      lastMessageAt: r.c.lastMessageAt.toISOString(),
      unread: r.unread,
      archived: (side === "buyer" ? r.c.buyerArchivedAt : r.c.sellerArchivedAt) !== null,
      muted: (side === "buyer" ? r.c.buyerMutedAt : r.c.sellerMutedAt) !== null,
    };
  });
}

/** One conversation in full for the thread header. */
export async function loadConversationDetail(
  app: App,
  userId: string,
  conversationId: string,
): Promise<ConversationDetail> {
  const [row] = await app.db
    .select(conversationFields(userId))
    .from(conversations)
    .innerJoin(listings, eq(listings.id, conversations.listingId))
    .where(
      and(
        eq(conversations.id, conversationId),
        or(eq(conversations.buyerId, userId), eq(conversations.sellerId, userId)),
      ),
    )
    .limit(1);
  if (!row) throw ApiError.notFound();
  const [base] = await presentConversationRows(app, userId, [row]);
  if (!base) throw ApiError.notFound();
  const otherId = otherPersonId(row.c, userId);
  const reference = await app.reference.get();
  const [[person], [order], blocked] = await Promise.all([
    app.db
      .select({
        city: profiles.city,
        countryCode: profiles.countryCode,
        lastSeenAt: profiles.lastSeenAt,
        showLastSeen: userSettings.showLastSeen,
      })
      .from(profiles)
      .leftJoin(userSettings, eq(userSettings.userId, profiles.userId))
      .where(eq(profiles.userId, otherId))
      .limit(1),
    app.db
      .select({
        id: orders.id,
        status: orders.status,
        totalMinor: orders.totalMinor,
        currency: orders.currency,
      })
      .from(orders)
      .where(eq(orders.conversationId, conversationId))
      .orderBy(desc(orders.createdAt))
      .limit(1),
    isBlockedBetween(app, userId, otherId),
  ]);
  return {
    ...base,
    listing: {
      ...base.listing,
      buyerPriceMinor: buyerPrice(reference, row.listingPriceMinor, row.listingCurrency) ?? 0,
    },
    otherUser: {
      ...base.otherUser,
      city: person?.city ?? null,
      countryCode: person?.countryCode ?? null,
      lastSeenAt: person && person.showLastSeen !== false ? (person.lastSeenAt?.toISOString() ?? null) : null,
    },
    order: order ?? null,
    blocked,
  };
}

// ---- Sending ----

/** Names of the people in a thread, for push titles. */
async function displayNameOf(app: Pick<App, "db">, userId: string): Promise<string> {
  const [row] = await app.db
    .select({ displayUsername: users.displayUsername, username: users.username, name: users.name })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return row?.displayUsername ?? row?.username ?? row?.name ?? "Vinty";
}

export type SentMessage = { message: Message; created: boolean };

/**
 * The one way a person's message gets written. The REST route and the socket both call it, so the rules cannot
 * drift apart. The message is committed first, then broadcast, then (when the other person is not looking) pushed.
 */
export async function sendMessage(
  app: App,
  userId: string,
  conversationId: string,
  input: SendMessageInput,
): Promise<SentMessage> {
  const conversation = await requireParty(app, conversationId, userId);

  // A retry of something already stored returns the first result, before any limit or block check.
  const findExisting = async () => {
    const [row] = await app.db
      .select()
      .from(messages)
      .where(
        and(
          eq(messages.conversationId, conversationId),
          eq(messages.senderId, userId),
          eq(messages.clientMessageId, input.clientMessageId),
        ),
      )
      .limit(1);
    return row;
  };
  const existing = await findExisting();
  if (existing) return { message: (await presentMessages(app, [existing]))[0] as Message, created: false };

  const otherId = otherPersonId(conversation, userId);
  if (await isBlockedBetween(app, userId, otherId)) {
    throw new ApiError(403, "blocked", "You cannot message this person");
  }

  if (!app.messageLimits.user.take(userId)) {
    throw new ApiError(429, "rate_limited", "You are sending messages too fast");
  }
  if (!app.messageLimits.conversation.take(`${conversationId}:${userId}`)) {
    throw new ApiError(429, "rate_limited", "You are sending messages too fast");
  }

  if (input.kind === "photo") {
    if (!keyBelongsToUser(input.attachmentKey, "message_photo", userId)) {
      throw ApiError.invalid("That photo is not yours", { attachmentKey: "validation.upload.notYours" });
    }
    const size = await app.storage.size(input.attachmentKey);
    if (size === null) {
      throw ApiError.invalid("The photo was not uploaded", { attachmentKey: "validation.upload.missing" });
    }
    if (size > MAX_UPLOAD_BYTES.message_photo) {
      throw ApiError.invalid("That file is too big", { attachmentKey: "validation.upload.tooBig" });
    }
  }

  const now = new Date();
  const preview = input.kind === "text" ? previewOf(input.body) : null;
  const sideRead = sideOf(conversation, userId) === "buyer" ? "buyerLastReadAt" : "sellerLastReadAt";
  const record = await app.db.transaction(async (tx) => {
    const inserted = await tx
      .insert(messages)
      .values({
        conversationId,
        senderId: userId,
        kind: input.kind,
        body: input.kind === "text" ? input.body : null,
        attachmentKey: input.kind === "photo" ? input.attachmentKey : null,
        attachmentWidth: input.kind === "photo" ? (input.width ?? null) : null,
        attachmentHeight: input.kind === "photo" ? (input.height ?? null) : null,
        clientMessageId: input.clientMessageId,
        createdAt: now,
      })
      .onConflictDoNothing()
      .returning();
    const row = inserted[0];
    if (!row) return null;
    await tx
      .update(conversations)
      .set({
        lastMessageAt: now,
        lastMessagePreview: preview,
        // Sending counts as reading, and a new message brings an archived chat back to the inbox for both sides.
        [sideRead]: now,
        buyerArchivedAt: null,
        sellerArchivedAt: null,
      })
      .where(eq(conversations.id, conversationId));
    return row;
  });
  if (!record) {
    // Lost a race with the same retry arriving twice.
    const again = await findExisting();
    if (!again) throw new Error("Message vanished after insert conflict");
    return { message: (await presentMessages(app, [again]))[0] as Message, created: false };
  }

  const [message] = await presentMessages(app, [record]);
  if (!message) throw new Error("Message could not be presented");
  await afterMessageCommitted(app, conversation, userId, otherId, message, preview);
  return { message, created: true };
}

/** Broadcast, unread dots and push. Runs after the commit, and a failure here never undoes the message. */
async function afterMessageCommitted(
  app: App,
  conversation: ConversationRecord,
  senderId: string,
  recipientId: string,
  message: Message,
  preview: string | null,
): Promise<void> {
  try {
    const lastMessageAt = message.createdAt;
    const conversationRoom = `conversation:${conversation.id}`;
    app.realtime
      .toRooms([`user:${recipientId}`, `user:${senderId}`, conversationRoom])
      .emit("message:new", { conversationId: conversation.id, message });
    app.realtime.toUser(recipientId).emit("conversation:updated", {
      conversationId: conversation.id,
      lastMessagePreview: preview,
      lastMessageKind: message.kind,
      lastMessageAt,
      unread: true,
    });
    app.realtime.toUser(senderId).emit("conversation:updated", {
      conversationId: conversation.id,
      lastMessagePreview: preview,
      lastMessageKind: message.kind,
      lastMessageAt,
      unread: false,
    });

    const recipientMuted =
      sideOf(conversation, recipientId) === "buyer" ? conversation.buyerMutedAt : conversation.sellerMutedAt;
    const viewing = await app.realtime.isViewing(recipientId, conversation.id);
    if (!recipientMuted && !viewing) {
      const senderName = await displayNameOf(app, senderId);
      await notifyUser(app, {
        userId: recipientId,
        type: "new_message",
        actorId: senderId,
        listingId: conversation.listingId,
        conversationId: conversation.id,
        data: { preview, kind: message.kind },
        groupByConversation: true,
        push: (locale) => ({
          title: senderName,
          body:
            message.kind === "photo"
              ? locale === "he"
                ? "שלח/ה תמונה"
                : "Sent you a photo"
              : (preview ?? ""),
        }),
        pushData: { userId: senderId },
      });
    }
    await broadcastUnread(app, recipientId);
  } catch (err) {
    app.log.error({ err }, "could not broadcast a message that was saved");
  }
}

// ---- Read, archive, mute ----

export async function markRead(app: App, userId: string, conversationId: string): Promise<Date> {
  const conversation = await requireParty(app, conversationId, userId);
  const side = sideOf(conversation, userId);
  const now = new Date();
  await app.db
    .update(conversations)
    .set(side === "buyer" ? { buyerLastReadAt: now } : { sellerLastReadAt: now })
    .where(eq(conversations.id, conversationId));
  // Anything pushed for this chat is now seen, so its ledger row stops counting as unread.
  await app.db
    .update(notifications)
    .set({ readAt: now })
    .where(
      and(
        eq(notifications.userId, userId),
        eq(notifications.conversationId, conversationId),
        eq(notifications.type, "new_message"),
        isNull(notifications.readAt),
      ),
    );
  const room = `conversation:${conversationId}`;
  app.realtime
    .toRooms([room])
    .emit("conversation:read", { conversationId, userId, readAt: now.toISOString() });
  app.realtime.toUser(userId).emit("conversation:updated", {
    conversationId,
    lastMessagePreview: conversation.lastMessagePreview,
    lastMessageKind: null,
    lastMessageAt: conversation.lastMessageAt.toISOString(),
    unread: false,
  });
  await broadcastUnread(app, userId);
  return now;
}

export async function setArchived(app: App, userId: string, conversationId: string, archived: boolean) {
  const conversation = await requireParty(app, conversationId, userId);
  const side = sideOf(conversation, userId);
  const value = archived ? new Date() : null;
  await app.db
    .update(conversations)
    .set(side === "buyer" ? { buyerArchivedAt: value } : { sellerArchivedAt: value })
    .where(eq(conversations.id, conversationId));
  await broadcastUnread(app, userId);
}

export async function setMuted(app: App, userId: string, conversationId: string, muted: boolean) {
  const conversation = await requireParty(app, conversationId, userId);
  const side = sideOf(conversation, userId);
  const value = muted ? new Date() : null;
  await app.db
    .update(conversations)
    .set(side === "buyer" ? { buyerMutedAt: value } : { sellerMutedAt: value })
    .where(eq(conversations.id, conversationId));
  await broadcastUnread(app, userId);
}

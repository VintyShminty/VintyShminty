import { z } from "zod";
import { idSchema, isoDateTimeSchema, pageSchema, paginationQuerySchema } from "./common.js";
import {
  LISTING_STATUSES,
  type ListingStatus,
  MESSAGE_KINDS,
  type MessageKind,
  NOTIFICATION_TYPES,
  OFFER_STATUSES,
  ORDER_STATUSES,
  type OrderStatus,
  SYSTEM_MESSAGE_EVENTS,
} from "./enums.js";
import { userSummarySchema } from "./users.js";

/** Longest text message, in characters. The database enforces the same number. */
export const MESSAGE_BODY_MAX = 4000;

/** Preview text in the inbox row is cut at this many characters. */
export const MESSAGE_PREVIEW_MAX = 80;

// ---- Sending ----

const messageBodySchema = z
  .string()
  .trim()
  .min(1, "Write a message")
  .max(MESSAGE_BODY_MAX, `Use at most ${MESSAGE_BODY_MAX} characters`);

/**
 * What the app sends. `clientMessageId` is a UUID the app makes before sending, so a retry after a bad network
 * never sends twice. Offers and system messages are written by the server, not sent by a person.
 */
export const sendMessageInputSchema = z.discriminatedUnion("kind", [
  z.object({
    clientMessageId: idSchema,
    kind: z.literal("text"),
    body: messageBodySchema,
  }),
  z.object({
    clientMessageId: idSchema,
    kind: z.literal("photo"),
    /** Key from `POST /v1/uploads` with purpose `message_photo`. Must be in the sender's own folder. */
    attachmentKey: z.string().min(1).max(300),
    width: z.number().int().positive().max(20000).optional(),
    height: z.number().int().positive().max(20000).optional(),
  }),
]);
export type SendMessageInput = z.infer<typeof sendMessageInputSchema>;

// ---- Messages ----

export const messageAttachmentSchema = z.object({
  key: z.string(),
  url: z.string().url(),
  width: z.number().int().positive().nullable(),
  height: z.number().int().positive().nullable(),
});

/** The offer behind an offer bubble, with its current status. Offers are built in Milestone 5. */
export const messageOfferSchema = z.object({
  id: idSchema,
  amountMinor: z.number().int(),
  currency: z.string().length(3),
  listingPriceMinor: z.number().int(),
  status: z.enum(OFFER_STATUSES),
  offeredById: idSchema,
  expiresAt: isoDateTimeSchema,
});

export type MessageOffer = z.infer<typeof messageOfferSchema>;

export const messageSchema = z.object({
  id: idSchema,
  conversationId: idSchema,
  /** Null for system messages. */
  senderId: idSchema.nullable(),
  kind: z.enum(MESSAGE_KINDS),
  body: z.string().nullable(),
  attachment: messageAttachmentSchema.nullable(),
  offer: messageOfferSchema.nullable(),
  systemEvent: z.enum(SYSTEM_MESSAGE_EVENTS).nullable(),
  orderId: idSchema.nullable(),
  /** Extra values a divider needs, such as the item title or the agreed price. */
  payload: z.unknown().nullable(),
  /** Echoed back so the app can match its pending bubble. Null on messages written by the server. */
  clientMessageId: idSchema.nullable(),
  createdAt: isoDateTimeSchema,
});
export type Message = z.infer<typeof messageSchema>;

export const messagePageSchema = pageSchema(messageSchema);
export const messagesQuerySchema = paginationQuerySchema.extend({
  limit: z.coerce.number().int().min(1).max(50).default(30),
});

// ---- Conversations ----

export const conversationListingSchema = z.object({
  id: idSchema,
  title: z.string(),
  status: z.enum(LISTING_STATUSES),
  /** First photo, or null when the listing has none. */
  photoUrl: z.string().url().nullable(),
  priceMinor: z.number().int(),
  currency: z.string().length(3),
});

/** One row of the inbox. */
export const conversationRowSchema = z.object({
  id: idSchema,
  /** Which side the signed in person is on. */
  role: z.enum(["buyer", "seller"]),
  listing: conversationListingSchema,
  otherUser: userSummarySchema,
  /** Text of the latest message. Null when the latest one is a photo, an offer or a divider: draw it from the kind. */
  lastMessagePreview: z.string().nullable(),
  lastMessageKind: z.enum(MESSAGE_KINDS).nullable(),
  lastMessageAt: isoDateTimeSchema,
  /** True when there are messages from the other side (or the system) after the person's read marker. */
  unread: z.boolean(),
  archived: z.boolean(),
  muted: z.boolean(),
});
export type ConversationRow = z.infer<typeof conversationRowSchema>;

export const conversationsQuerySchema = paginationQuerySchema.extend({
  /** `archived=true` lists the archive, otherwise the inbox. */
  archived: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),
});
export const conversationPageSchema = pageSchema(conversationRowSchema);

/** The pinned item strip at the top of a thread. */
export const conversationDetailListingSchema = conversationListingSchema.extend({
  /** What the buyer pays for the item (price plus protection fee). */
  buyerPriceMinor: z.number().int(),
});

/** The intro card of the other person. */
export const conversationOtherUserSchema = userSummarySchema.extend({
  city: z.string().nullable(),
  countryCode: z.string().length(2).nullable(),
  /** Null when the person hides it, or never opened the app. */
  lastSeenAt: isoDateTimeSchema.nullable(),
});

export const conversationOrderSchema = z.object({
  id: idSchema,
  status: z.enum(ORDER_STATUSES),
  totalMinor: z.number().int(),
  currency: z.string().length(3),
});

export const conversationDetailSchema = conversationRowSchema.extend({
  listing: conversationDetailListingSchema,
  otherUser: conversationOtherUserSchema,
  /** The newest order that came out of this chat, if any. */
  order: conversationOrderSchema.nullable(),
  /** The other person blocked you or you blocked them: the thread opens but sending is refused. */
  blocked: z.boolean(),
  /** When the other person last opened the thread. The app shows "Seen" on your last message if it is later. */
  otherLastReadAt: isoDateTimeSchema.nullable(),
});
export type ConversationDetail = z.infer<typeof conversationDetailSchema>;

export const createConversationInputSchema = z.object({
  listingId: idSchema,
  /** Optional first message. */
  body: messageBodySchema.optional(),
  /** Makes the first message safe to retry. Optional, the server makes one if missing. */
  clientMessageId: idSchema.optional(),
});

export const archiveInputSchema = z.object({ archived: z.boolean() });
export const muteInputSchema = z.object({ muted: z.boolean() });

// ---- Unread and notifications ----

/** The red dots. `messages` counts conversations with something unread (muted and archived ones are left out). */
export const unreadCountsSchema = z.object({
  messages: z.number().int().min(0),
  notifications: z.number().int().min(0),
});
export type UnreadCounts = z.infer<typeof unreadCountsSchema>;

export const notificationSchema = z.object({
  id: idSchema,
  type: z.enum(NOTIFICATION_TYPES),
  /** Values for the sentence, such as the item title or an amount. The app writes the sentence. */
  data: z.record(z.string(), z.unknown()),
  listingId: idSchema.nullable(),
  orderId: idSchema.nullable(),
  conversationId: idSchema.nullable(),
  actor: userSummarySchema.nullable(),
  readAt: isoDateTimeSchema.nullable(),
  createdAt: isoDateTimeSchema,
});
export type AppNotification = z.infer<typeof notificationSchema>;
export const notificationPageSchema = pageSchema(notificationSchema);

export const markNotificationsReadInputSchema = z.object({
  /** None means all of them. */
  ids: z.array(idSchema).min(1).max(200).optional(),
});

// ---- Socket.IO ----

/** Client to server. Each has an acknowledgement. */
export const socketJoinInputSchema = z.object({ conversationId: idSchema });
export const socketSendInputSchema = z.intersection(
  z.object({ conversationId: idSchema }),
  sendMessageInputSchema,
);
export const socketTypingInputSchema = z.object({ conversationId: idSchema, isTyping: z.boolean() });

export type SocketAck<T = Record<string, never>> =
  | ({ ok: true } & T)
  | { ok: false; code: string; message: string };

/** Server to client events and their payloads. */
export type ServerToClientEvents = {
  "message:new": (payload: { conversationId: string; message: Message }) => void;
  /** An offer bubble changed status. Also goes to both people's rooms, so a closed thread stays right. */
  "message:updated": (payload: { conversationId: string; messageId: string; offer?: MessageOffer }) => void;
  /** An order moved. Goes to the buyer and the seller only. The app refetches the order. */
  "order:updated": (payload: {
    orderId: string;
    status: OrderStatus;
    conversationId: string | null;
  }) => void;
  /** A listing was reserved, sold, released or repriced. Goes to people who favourited it or chat about it. */
  "listing:updated": (payload: {
    listingId: string;
    status: ListingStatus;
    priceMinor: number | null;
  }) => void;
  "conversation:updated": (payload: {
    conversationId: string;
    lastMessagePreview: string | null;
    lastMessageKind: MessageKind | null;
    lastMessageAt: string;
    unread: boolean;
  }) => void;
  "conversation:read": (payload: { conversationId: string; userId: string; readAt: string }) => void;
  "notification:new": (payload: { notification: AppNotification }) => void;
  "unread:count": (payload: UnreadCounts) => void;
  typing: (payload: { conversationId: string; userId: string; isTyping: boolean }) => void;
};

export type ClientToServerEvents = {
  "conversation:join": (payload: { conversationId: string }, ack: (result: SocketAck) => void) => void;
  "conversation:leave": (payload: { conversationId: string }, ack: (result: SocketAck) => void) => void;
  "message:send": (
    payload: { conversationId: string } & SendMessageInput,
    ack: (result: SocketAck<{ message: Message }>) => void,
  ) => void;
  "conversation:read": (payload: { conversationId: string }, ack: (result: SocketAck) => void) => void;
  typing: (payload: { conversationId: string; isTyping: boolean }) => void;
};

import { CHAT_WARNING_KINDS, MESSAGE_KINDS, SYSTEM_MESSAGE_EVENTS } from "@vinty/shared";
import { sql } from "drizzle-orm";
import { check, index, integer, jsonb, pgEnum, pgTable, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { createdAt, pk, ts } from "./_helpers.js";
import { users } from "./auth.js";
import { conversations, offers } from "./conversations.js";
import { orders } from "./orders.js";

export const messageKindEnum = pgEnum("message_kind", MESSAGE_KINDS);
export const chatWarningEnum = pgEnum("chat_warning", CHAT_WARNING_KINDS);
export const systemMessageEventEnum = pgEnum("system_message_event", SYSTEM_MESSAGE_EVENTS);

/**
 * Everything in a thread: text, photos, offer bubbles and system messages (order and offer events).
 * System messages have no sender. They are written by the server in the same transaction as the change they describe.
 */
export const messages = pgTable(
  "messages",
  {
    id: pk(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    /** Null for system messages. */
    senderId: uuid("sender_id").references(() => users.id, { onDelete: "set null" }),
    kind: messageKindEnum("kind").notNull(),
    /** Text as written by the person. Never rewritten, never translated in place. */
    body: text("body"),
    /** Photo attachment: object key and size. */
    attachmentKey: text("attachment_key"),
    attachmentWidth: integer("attachment_width"),
    attachmentHeight: integer("attachment_height"),
    /** For kind = offer. */
    offerId: uuid("offer_id").references(() => offers.id, { onDelete: "set null" }),
    /** For kind = system. */
    systemEvent: systemMessageEventEnum("system_event"),
    orderId: uuid("order_id").references(() => orders.id, { onDelete: "set null" }),
    /** Extra data the divider needs, such as the new price. */
    payload: jsonb("payload"),
    /** Set by the app so a retry after a bad network does not send twice. */
    clientMessageId: uuid("client_message_id"),
    /** D-039: what the AI chat check warned about. Shown quietly to the recipient only. Null when nothing was found. */
    warning: chatWarningEnum("warning"),
    deletedAt: ts("deleted_at"),
    createdAt: createdAt(),
  },
  (t) => [
    // Opening a thread and paging back through it.
    index("messages_thread_idx").on(t.conversationId, t.createdAt.desc(), t.id.desc()),
    uniqueIndex("messages_client_id_unique")
      .on(t.conversationId, t.senderId, t.clientMessageId)
      .where(sql`${t.clientMessageId} is not null`),
    index("messages_order_idx").on(t.orderId).where(sql`${t.orderId} is not null`),
    check("messages_text_has_body", sql`${t.kind} <> 'text' or ${t.body} is not null`),
    check("messages_photo_has_key", sql`${t.kind} <> 'photo' or ${t.attachmentKey} is not null`),
    check("messages_offer_has_offer", sql`${t.kind} <> 'offer' or ${t.offerId} is not null`),
    check("messages_system_has_event", sql`${t.kind} <> 'system' or ${t.systemEvent} is not null`),
    check("messages_body_length", sql`${t.body} is null or char_length(${t.body}) <= 4000`),
  ],
);

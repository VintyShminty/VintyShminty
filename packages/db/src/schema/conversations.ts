import { OFFER_STATUSES } from "@vinty/shared";
import { sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  check,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { createdAt, currencyCol, pk, ts, updatedAt } from "./_helpers.js";
import { users } from "./auth.js";
import { listings } from "./listings.js";
import { currencies } from "./reference.js";

export const offerStatusEnum = pgEnum("offer_status", OFFER_STATUSES);

/**
 * One chat between one buyer and one seller about one listing. Always tied to an item (see the spec).
 * Per person state (read marker, archive, mute) lives in columns, one set per side.
 */
export const conversations = pgTable(
  "conversations",
  {
    id: pk(),
    listingId: uuid("listing_id")
      .notNull()
      .references(() => listings.id, { onDelete: "cascade" }),
    buyerId: uuid("buyer_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    sellerId: uuid("seller_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    lastMessageAt: ts("last_message_at").notNull().defaultNow(),
    /** Short text of the latest message for the inbox row. */
    lastMessagePreview: text("last_message_preview"),
    buyerLastReadAt: ts("buyer_last_read_at"),
    sellerLastReadAt: ts("seller_last_read_at"),
    buyerArchivedAt: ts("buyer_archived_at"),
    sellerArchivedAt: ts("seller_archived_at"),
    buyerMutedAt: ts("buyer_muted_at"),
    sellerMutedAt: ts("seller_muted_at"),
    createdAt: createdAt(),
  },
  (t) => [
    unique("conversations_listing_buyer_unique").on(t.listingId, t.buyerId),
    // Inbox for each side, newest first.
    index("conversations_buyer_inbox_idx").on(t.buyerId, t.lastMessageAt.desc()),
    index("conversations_seller_inbox_idx").on(t.sellerId, t.lastMessageAt.desc()),
    check("conversations_not_self", sql`${t.buyerId} <> ${t.sellerId}`),
  ],
);

/**
 * An offer or a counter offer. A counter offer is a new row whose parent_offer_id points at the one it answers,
 * and the parent becomes "countered". The accepted amount is what checkout charges.
 */
export const offers = pgTable(
  "offers",
  {
    id: pk(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    listingId: uuid("listing_id")
      .notNull()
      .references(() => listings.id, { onDelete: "cascade" }),
    buyerId: uuid("buyer_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    sellerId: uuid("seller_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** Who made this offer. The other person answers it. */
    offeredById: uuid("offered_by_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    parentOfferId: uuid("parent_offer_id").references((): AnyPgColumn => offers.id, { onDelete: "set null" }),
    amountMinor: integer("amount_minor").notNull(),
    currency: currencyCol().references(() => currencies.code),
    /** Listing price when the offer was made, to show "was" in the bubble and compute the discount. */
    listingPriceMinor: integer("listing_price_minor").notNull(),
    status: offerStatusEnum("status").notNull().default("pending"),
    expiresAt: ts("expires_at").notNull(),
    respondedAt: ts("responded_at"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    check("offers_amount_positive", sql`${t.amountMinor} > 0`),
    check("offers_offerer_is_party", sql`${t.offeredById} in (${t.buyerId}, ${t.sellerId})`),
    index("offers_conversation_idx").on(t.conversationId, t.createdAt.desc()),
    // Daily offer limit counts a buyer's offers over the last 24 hours.
    index("offers_buyer_day_idx").on(t.buyerId, t.createdAt.desc()),
    index("offers_pending_expiry_idx").on(t.expiresAt).where(sql`${t.status} = 'pending'`),
    // One open offer per conversation at a time.
    uniqueIndex("offers_one_pending_per_conversation")
      .on(t.conversationId)
      .where(sql`${t.status} = 'pending'`),
  ],
);

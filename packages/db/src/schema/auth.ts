import { LOCALES, USER_ROLES } from "@vinty/shared";
import { sql } from "drizzle-orm";
import { boolean, index, pgEnum, pgTable, text, uuid } from "drizzle-orm/pg-core";
import { createdAt, pk, ts, updatedAt } from "./_helpers.js";

export const localeEnum = pgEnum("locale", LOCALES);
export const userRoleEnum = pgEnum("user_role", USER_ROLES);

/**
 * Better Auth tables. Names and columns follow Better Auth 1.7 (user, session, account, verification)
 * with plural table names, so the auth config needs `usePlural: true` and
 * `advanced.database.generateId: "uuid"`.
 * Extra columns on users come from two Better Auth plugins (username, admin).
 * Everything else about a person lives in `profiles` and `user_settings` (language included).
 */
export const users = pgTable(
  "users",
  {
    id: pk(),
    name: text("name").notNull(),
    email: text("email").notNull().unique(),
    emailVerified: boolean("email_verified").notNull().default(false),
    image: text("image"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    // username plugin
    username: text("username").unique(),
    displayUsername: text("display_username"),
    // admin plugin
    role: userRoleEnum("role").notNull().default("user"),
    banned: boolean("banned").notNull().default(false),
    banReason: text("ban_reason"),
    banExpires: ts("ban_expires"),
  },
  (t) => [
    // Member search by username prefix (Items / Members tab).
    index("users_username_prefix_idx").on(sql`lower(${t.username}) text_pattern_ops`),
  ],
);

export const sessions = pgTable(
  "sessions",
  {
    id: pk(),
    expiresAt: ts("expires_at").notNull(),
    token: text("token").notNull().unique(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    // admin plugin
    impersonatedBy: text("impersonated_by"),
  },
  (t) => [index("sessions_user_id_idx").on(t.userId)],
);

export const accounts = pgTable(
  "accounts",
  {
    id: pk(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: ts("access_token_expires_at"),
    refreshTokenExpiresAt: ts("refresh_token_expires_at"),
    scope: text("scope"),
    password: text("password"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("accounts_user_id_idx").on(t.userId),
    index("accounts_provider_idx").on(t.providerId, t.accountId),
  ],
);

export const verifications = pgTable(
  "verifications",
  {
    id: pk(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: ts("expires_at").notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("verifications_identifier_idx").on(t.identifier)],
);

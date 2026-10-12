import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

// Placeholder schema. The real data model comes later.
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  username: text("username").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

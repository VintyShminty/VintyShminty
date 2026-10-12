import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { ORDER_STATUSES } from "@vinty/shared";
import { is } from "drizzle-orm";
import { type AnyPgTable, getTableConfig, PgTable } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import * as schema from "./schema/index.js";

const tables = Object.values(schema).filter((value) => is(value, PgTable)) as unknown as AnyPgTable[];

describe("schema", () => {
  it("loads and exposes the main tables", () => {
    const names = tables.map((t) => getTableConfig(t).name);
    for (const expected of [
      "users",
      "sessions",
      "accounts",
      "verifications",
      "profiles",
      "categories",
      "listings",
      "listing_photos",
      "conversations",
      "messages",
      "offers",
      "orders",
      "order_items",
      "order_events",
      "payments",
      "shipments",
      "reviews",
      "wallet_entries",
      "notifications",
    ]) {
      expect(names).toContain(expected);
    }
    expect(tables.length).toBeGreaterThanOrEqual(50);
  });

  it("gives every table a primary key", () => {
    for (const table of tables) {
      const config = getTableConfig(table);
      const hasColumnPk = config.columns.some((c) => c.primary);
      expect(hasColumnPk || config.primaryKeys.length > 0, config.name).toBe(true);
    }
  });

  it("keeps Better Auth table names and required columns", () => {
    const columns = (t: AnyPgTable) => getTableConfig(t).columns.map((c) => c.name);
    expect(columns(schema.users)).toEqual(
      expect.arrayContaining(["id", "name", "email", "email_verified", "image", "created_at", "updated_at"]),
    );
    expect(columns(schema.sessions)).toEqual(
      expect.arrayContaining(["id", "expires_at", "token", "ip_address", "user_agent", "user_id"]),
    );
    expect(columns(schema.accounts)).toEqual(
      expect.arrayContaining([
        "account_id",
        "provider_id",
        "user_id",
        "access_token",
        "refresh_token",
        "id_token",
        "password",
      ]),
    );
    expect(columns(schema.verifications)).toEqual(
      expect.arrayContaining(["identifier", "value", "expires_at"]),
    );
  });

  it("builds the order status enum from the shared list", () => {
    expect(schema.orderStatusEnum.enumValues).toEqual([...ORDER_STATUSES]);
  });

  it("has a full text index on listings", () => {
    const indexes = getTableConfig(schema.listings).indexes.map((i) => i.config.name);
    expect(indexes).toContain("listings_search_idx");
    expect(indexes).toContain("listings_feed_idx");
  });

  it("stores money as integers next to a currency", () => {
    const listing = getTableConfig(schema.listings).columns;
    expect(listing.find((c) => c.name === "price_minor")?.dataType).toBe("number");
    expect(listing.find((c) => c.name === "currency")?.default).toBe("ILS");
  });

  it("documents every table in docs/blueprint/data-model.md", () => {
    const doc = readFileSync(
      fileURLToPath(new URL("../../../docs/blueprint/data-model.md", import.meta.url)),
      "utf8",
    );
    for (const table of tables) {
      const name = getTableConfig(table).name;
      expect(doc, `${name} is missing from data-model.md`).toContain(`### \`${name}\``);
    }
  });
});

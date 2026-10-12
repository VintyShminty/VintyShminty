import { describe, expect, it } from "vitest";
import { healthDbResponseSchema, healthResponseSchema } from "./health.js";

describe("health schemas", () => {
  it("accepts a valid health response", () => {
    expect(healthResponseSchema.parse({ ok: true })).toEqual({ ok: true });
  });

  it("rejects a response without ok", () => {
    expect(healthResponseSchema.safeParse({}).success).toBe(false);
  });

  it("only allows up or down for the database state", () => {
    expect(healthDbResponseSchema.safeParse({ ok: true, database: "up" }).success).toBe(true);
    expect(healthDbResponseSchema.safeParse({ ok: true, database: "sideways" }).success).toBe(false);
  });
});

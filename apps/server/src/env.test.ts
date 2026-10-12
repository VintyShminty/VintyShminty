import { describe, expect, it } from "vitest";
import { parseEnv } from "./env.js";

describe("parseEnv", () => {
  it("applies defaults", () => {
    const env = parseEnv({ DATABASE_URL: "postgres://x" });
    expect(env.PORT).toBe(3000);
    expect(env.NODE_ENV).toBe("development");
  });

  it("fails fast when DATABASE_URL is missing", () => {
    expect(() => parseEnv({})).toThrow(/DATABASE_URL/);
  });

  it("fails fast on a bad port", () => {
    expect(() => parseEnv({ DATABASE_URL: "postgres://x", PORT: "banana" })).toThrow(/PORT/);
  });
});

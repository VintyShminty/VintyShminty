import { describe, expect, it } from "vitest";
import { createRealtimeAdapter } from "./realtime-adapter.js";

const log = { error: () => {}, info: () => {} };

describe("createRealtimeAdapter", () => {
  it("stays in memory (null) without REDIS_URL", async () => {
    expect(await createRealtimeAdapter({ REDIS_URL: undefined }, log)).toBeNull();
  });

  it("fails fast when Redis cannot be reached, so the caller can fall back", async () => {
    // Port 1 refuses at once. The caller (plugins/messaging.ts) logs this and carries on in memory.
    await expect(createRealtimeAdapter({ REDIS_URL: "redis://127.0.0.1:1" }, log)).rejects.toThrow();
  }, 15_000);
});

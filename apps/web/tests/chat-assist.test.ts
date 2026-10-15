import { describe, expect, it } from "vitest";
import { warningFor } from "../lib/chat-assist";

describe("warningFor", () => {
  it("shows only to the person who received the message", () => {
    const m = { senderId: "u1", kind: "text", warning: "pressure" } as const;
    expect(warningFor(m, "u2")).toBe("pressure");
    expect(warningFor(m, "u1")).toBeNull();
    expect(warningFor(m, undefined)).toBeNull();
    expect(warningFor({ ...m, warning: null }, "u2")).toBeNull();
    expect(warningFor({ senderId: "u1", kind: "text" }, "u2")).toBeNull();
  });
});

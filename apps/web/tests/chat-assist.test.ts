import { describe, expect, it } from "vitest";
import { quickReplyTarget, visibleQuickReplies, warningFor, withReply } from "../lib/chat-assist";

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

describe("quickReplyTarget", () => {
  const base = {
    enabled: true,
    newest: { id: "m1", kind: "text", senderId: "u1" } as const,
    me: "u2",
    hasPending: false,
    blocked: false,
  };
  it("asks for the newest text from the other person", () => {
    expect(quickReplyTarget(base)).toBe("m1");
  });
  it("stays quiet otherwise", () => {
    expect(quickReplyTarget({ ...base, enabled: false })).toBeNull();
    expect(quickReplyTarget({ ...base, me: "u1" })).toBeNull();
    expect(quickReplyTarget({ ...base, hasPending: true })).toBeNull();
    expect(quickReplyTarget({ ...base, blocked: true })).toBeNull();
    expect(quickReplyTarget({ ...base, newest: { id: "m1", kind: "photo", senderId: "u1" } })).toBeNull();
    expect(quickReplyTarget({ ...base, newest: undefined })).toBeNull();
  });
});

describe("visibleQuickReplies", () => {
  const data = { forMessageId: "m1", replies: ["Yes", "No"] };
  it("shows for the newest message with an empty box", () => {
    expect(visibleQuickReplies(data, "m1", "")).toEqual(["Yes", "No"]);
    expect(visibleQuickReplies(data, "m1", "  ")).toEqual(["Yes", "No"]);
  });
  it("hides when typing, when stale or when empty", () => {
    expect(visibleQuickReplies(data, "m1", "h")).toEqual([]);
    expect(visibleQuickReplies(data, "m2", "")).toEqual([]);
    expect(visibleQuickReplies(data, null, "")).toEqual([]);
    expect(visibleQuickReplies(undefined, "m1", "")).toEqual([]);
    expect(visibleQuickReplies({ forMessageId: null, replies: [] }, "m1", "")).toEqual([]);
  });
});

describe("withReply", () => {
  it("replaces an empty box and appends otherwise", () => {
    expect(withReply("", "Sure")).toBe("Sure");
    expect(withReply("  ", "Sure")).toBe("Sure");
    expect(withReply("Hi ", "Sure")).toBe("Hi Sure");
  });
});

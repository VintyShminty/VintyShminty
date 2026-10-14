import { describe, expect, it } from "vitest";
import {
  newestMessage,
  putReplyInBox,
  quickReplyTarget,
  shouldShowWarning,
  visibleQuickReplies,
} from "../lib/chat-assist";

const msg = (
  id: string,
  senderId: string | null,
  createdAt: string,
  extra: { kind?: "text" | "photo" | "offer" | "system"; body?: string | null } = {},
) => ({
  id,
  senderId,
  createdAt,
  kind: extra.kind ?? "text",
  body: extra.body === undefined ? "Hello" : extra.body,
});

describe("newestMessage", () => {
  it("finds the newest whatever the order of the list", () => {
    const a = msg("a", "x", "2026-10-14T10:00:00.000Z");
    const b = msg("b", "y", "2026-10-14T11:00:00.000Z");
    const c = msg("c", "x", "2026-10-14T09:00:00.000Z");
    expect(newestMessage([a, b, c])?.id).toBe("b");
    expect(newestMessage([b, c, a])?.id).toBe("b");
  });

  it("returns nothing for an empty chat", () => {
    expect(newestMessage([])).toBeUndefined();
  });
});

describe("quickReplyTarget", () => {
  const older = msg("1", "me", "2026-10-14T10:00:00.000Z");

  it("is the newest message when it is a text from the other person", () => {
    const theirs = msg("2", "them", "2026-10-14T11:00:00.000Z");
    expect(quickReplyTarget([theirs, older], "me")?.id).toBe("2");
  });

  it("is null when the newest is mine", () => {
    expect(quickReplyTarget([older, msg("0", "them", "2026-10-14T09:00:00.000Z")], "me")).toBeNull();
  });

  it("is null for a photo, an offer, a system line or an empty body", () => {
    for (const kind of ["photo", "offer", "system"] as const) {
      expect(
        quickReplyTarget([older, msg("2", "them", "2026-10-14T11:00:00.000Z", { kind })], "me"),
      ).toBeNull();
    }
    expect(
      quickReplyTarget([older, msg("2", "them", "2026-10-14T11:00:00.000Z", { body: "   " })], "me"),
    ).toBeNull();
    expect(
      quickReplyTarget([older, msg("2", "them", "2026-10-14T11:00:00.000Z", { body: null })], "me"),
    ).toBeNull();
  });

  it("is null for a message from nobody, an empty chat, an unknown me, or while a message is sending", () => {
    expect(quickReplyTarget([msg("2", null, "2026-10-14T11:00:00.000Z")], "me")).toBeNull();
    expect(quickReplyTarget([], "me")).toBeNull();
    const theirs = msg("2", "them", "2026-10-14T11:00:00.000Z");
    expect(quickReplyTarget([theirs], undefined)).toBeNull();
    expect(quickReplyTarget([theirs], "me", true)).toBeNull();
  });
});

describe("shouldShowWarning", () => {
  it("shows to the one who received the message", () => {
    expect(shouldShowWarning({ senderId: "them", warning: "pressure" }, "me")).toBe(true);
  });

  it("never shows to the sender", () => {
    expect(shouldShowWarning({ senderId: "me", warning: "pressure" }, "me")).toBe(false);
  });

  it("shows nothing without a warning, a viewer or a sender", () => {
    expect(shouldShowWarning({ senderId: "them", warning: null }, "me")).toBe(false);
    expect(shouldShowWarning({ senderId: "them", warning: "pressure" }, undefined)).toBe(false);
    expect(shouldShowWarning({ senderId: null, warning: "pressure" }, "me")).toBe(false);
  });
});

describe("visibleQuickReplies", () => {
  const base = {
    forMessageId: "m2",
    replies: ["Yes", "No"],
    newestId: "m2",
    dismissedFor: null,
    composerText: "",
  };

  it("shows the replies for the newest message", () => {
    expect(visibleQuickReplies(base)).toEqual(["Yes", "No"]);
  });

  it("hides them when they answer an older message", () => {
    expect(visibleQuickReplies({ ...base, newestId: "m3" })).toEqual([]);
  });

  it("hides them once dismissed for that message, or when the box has text", () => {
    expect(visibleQuickReplies({ ...base, dismissedFor: "m2" })).toEqual([]);
    expect(visibleQuickReplies({ ...base, composerText: "H" })).toEqual([]);
    expect(visibleQuickReplies({ ...base, dismissedFor: "m1" })).toEqual(["Yes", "No"]);
  });

  it("hides them when there are none or no message to answer", () => {
    expect(visibleQuickReplies({ ...base, replies: [] })).toEqual([]);
    expect(visibleQuickReplies({ ...base, replies: undefined })).toEqual([]);
    expect(visibleQuickReplies({ ...base, forMessageId: null })).toEqual([]);
  });
});

describe("putReplyInBox", () => {
  it("replaces an empty box", () => {
    expect(putReplyInBox("", "Yes")).toBe("Yes");
    expect(putReplyInBox("   ", "Yes")).toBe("Yes");
  });

  it("follows existing text after one space", () => {
    expect(putReplyInBox("Hi", "Yes")).toBe("Hi Yes");
    expect(putReplyInBox("Hi  ", "Yes")).toBe("Hi Yes");
  });
});

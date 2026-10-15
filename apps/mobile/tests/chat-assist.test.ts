import { describe, expect, it } from "vitest";
import { shouldShowWarning } from "../lib/chat-assist";

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

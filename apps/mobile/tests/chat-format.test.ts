import type { Message } from "@vinty/shared";
import { describe, expect, it } from "vitest";
import { buildThreadItems, dayLabel, formatRowTime } from "../lib/chat-format";

const msg = (id: string, sender: string | null, at: string, extra: Partial<Message> = {}): Message => ({
  id,
  conversationId: "c",
  senderId: sender,
  kind: "text",
  body: id,
  attachment: null,
  offer: null,
  systemEvent: null,
  orderId: null,
  payload: null,
  clientMessageId: null,
  createdAt: at,
  ...extra,
});

const base = { pending: [], me: "me", hasMore: false, otherTyping: false };

describe("buildThreadItems", () => {
  it("puts newest first, a day divider after each day's oldest message", () => {
    const items = buildThreadItems({
      ...base,
      messages: [
        msg("c", "you", "2026-10-02T10:00:00"),
        msg("b", "me", "2026-10-01T10:05:00"),
        msg("a", "me", "2026-10-01T10:00:00"),
      ],
    });
    expect(items.map((i) => i.type)).toEqual(["message", "day", "message", "message", "day"]);
  });

  it("marks only your newest message and groups close messages from one side", () => {
    const items = buildThreadItems({
      ...base,
      messages: [
        msg("c", "me", "2026-10-01T10:06:00"),
        msg("b", "me", "2026-10-01T10:05:00"),
        msg("a", "you", "2026-10-01T09:00:00"),
      ],
    });
    const messages = items.filter((i) => i.type === "message");
    expect(messages.map((m) => m.type === "message" && m.lastMine)).toEqual([true, false, false]);
    expect(messages.map((m) => m.type === "message" && m.tight)).toEqual([true, false, false]);
  });

  it("hides a pending message once the server copy arrived, and keeps the rest at the bottom", () => {
    const pending = (id: string) => ({
      clientMessageId: id,
      conversationId: "c",
      senderId: "me",
      kind: "text" as const,
      body: id,
      state: "sending" as const,
      createdAt: "2026-10-01T10:10:00",
    });
    const items = buildThreadItems({
      ...base,
      pending: [pending("x"), pending("y")],
      messages: [msg("m", "me", "2026-10-01T10:00:00", { clientMessageId: "x" })],
    });
    expect(items.map((i) => i.type)).toEqual(["pending", "message", "day"]);
  });

  it("shows no first day divider while older messages can still load, and a typing row at the bottom", () => {
    const items = buildThreadItems({
      ...base,
      hasMore: true,
      otherTyping: true,
      messages: [msg("a", "you", "2026-10-01T10:00:00")],
    });
    expect(items.map((i) => i.type)).toEqual(["typing", "message"]);
  });
});

describe("time labels", () => {
  const now = new Date(2026, 9, 13, 12, 0);
  it("labels today and yesterday", () => {
    const labels = { today: "Today", yesterday: "Yesterday" };
    expect(dayLabel(new Date(2026, 9, 13, 8).toISOString(), "en", labels, now)).toBe("Today");
    expect(dayLabel(new Date(2026, 9, 12, 8).toISOString(), "en", labels, now)).toBe("Yesterday");
  });
  it("shows a weekday inside a week and a date after that", () => {
    expect(formatRowTime(new Date(2026, 9, 10, 8).toISOString(), "en", now)).toMatch(/Sat/);
    expect(formatRowTime(new Date(2026, 8, 1, 8).toISOString(), "en", now)).toMatch(/Sep/);
  });
});

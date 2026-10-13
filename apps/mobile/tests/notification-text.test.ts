import { NOTIFICATION_TYPES } from "@vinty/shared";
import { createInstance } from "i18next";
import { describe, expect, it } from "vitest";
import en from "../i18n/locales/en.json";
import he from "../i18n/locales/he.json";
import { notificationText } from "../lib/notification-text";

const make = async (lng: "en" | "he") => {
  const i18n = createInstance();
  await i18n.init({
    lng,
    resources: { en: { translation: en }, he: { translation: he } },
    interpolation: { escapeValue: false },
  });
  return i18n.t.bind(i18n);
};
const row = (type: (typeof NOTIFICATION_TYPES)[number], data: Record<string, unknown> = {}) => ({
  id: "n",
  type,
  data,
  listingId: null,
  orderId: null,
  conversationId: null,
  actor: null,
  readAt: null,
  createdAt: "2026-10-13T10:00:00.000Z",
});

describe("notification sentences", () => {
  it("has a real sentence in both languages for every type, with and without values", async () => {
    for (const lng of ["en", "he"] as const) {
      const t = await make(lng);
      for (const type of NOTIFICATION_TYPES) {
        for (const data of [
          {},
          { title: "Blue coat", amountMinor: 4500, count: 3, rating: 5, newPriceMinor: 3000 },
        ]) {
          const text = notificationText(row(type, data), t);
          expect(text, `${lng} ${type}`).not.toMatch(/inbox\.notif|undefined|\{\{/);
          expect(text.length).toBeGreaterThan(3);
        }
      }
    }
  });

  it("writes the grouped heart sentence with the count", async () => {
    const t = await make("en");
    expect(notificationText(row("listing_favourited", { title: "Coat", count: 1 }), t)).toBe(
      "Someone favourited Coat",
    );
    expect(notificationText(row("listing_favourited", { title: "Coat", count: 2 }), t)).toBe(
      "Someone and 1 other favourited Coat",
    );
    expect(notificationText(row("listing_favourited", { title: "Coat", count: 5 }), t)).toBe(
      "Someone and 4 others favourited Coat",
    );
  });
});

import en from "@vinty/locales/en.json";
import he from "@vinty/locales/he.json";
import { NOTIFICATION_TYPES } from "@vinty/shared";
import { createInstance } from "i18next";
import { describe, expect, it } from "vitest";
import { routeForNotification } from "../lib/notification-route";
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
      "Someone saved Coat",
    );
    expect(notificationText(row("listing_favourited", { title: "Coat", count: 2 }), t)).toBe(
      "Someone and 1 other saved Coat",
    );
    expect(notificationText(row("listing_favourited", { title: "Coat", count: 5 }), t)).toBe(
      "Someone and 4 others saved Coat",
    );
  });

  it("writes the order sentences from their values", async () => {
    const t = await make("en");
    const data = { title: "Coat", itemCount: 1, orderNumber: 12 };
    expect(notificationText(row("order_paid", { ...data, amountMinor: 4500, currency: "ILS" }), t)).toBe(
      "Someone bought Coat. You will earn ₪45",
    );
    expect(notificationText(row("order_paid", { ...data, itemCount: 3 }), t)).toBe(
      "You sold Coat and 2 more to Someone",
    );
    expect(notificationText(row("order_shipped", { ...data, trackingCode: "VT123" }), t)).toBe(
      "Your order Coat is on its way. Tracking code VT123",
    );
    expect(notificationText(row("order_shipped", data), t)).toBe("Your order Coat is on its way");
    expect(notificationText(row("order_completed", { ...data, role: "seller" }), t)).toBe(
      "Coat is sold and paid",
    );
    expect(notificationText(row("order_completed", { ...data, role: "buyer" }), t)).toBe(
      "Coat is all wrapped up",
    );
    expect(
      notificationText(row("balance_released", { ...data, amountMinor: 4500, currency: "ILS" }), t),
    ).toBe("₪45 is now available in your balance");
    expect(notificationText(row("referral_rewarded", { role: "inviter" }), t)).toBe(
      "Your friend's first order is done. You earned a reward",
    );
    expect(notificationText(row("referral_rewarded", { role: "invitee" }), t)).toBe(
      "Your first order is done. You earned a voucher",
    );
  });

  it("tells why an order was cancelled", async () => {
    const t = await make("en");
    const sentence = (extra: Record<string, unknown>) =>
      notificationText(row("order_cancelled", { title: "Coat", itemCount: 1, ...extra }), t);
    expect(sentence({ reason: "refunded" })).toBe("Your payment for Coat was refunded");
    expect(sentence({ reason: "buyer_cancelled", byRole: "buyer" })).toBe(
      "The buyer cancelled the order for Coat",
    );
    expect(sentence({ reason: "shipping_timeout", byRole: "system" })).toBe(
      "The order for Coat was cancelled because it was not shipped in time",
    );
    expect(sentence({})).toBe("The order for Coat was cancelled");
  });

  it("writes offer, review and reminder sentences in both languages", async () => {
    const en = await make("en");
    const he = await make("he");
    const accepted = row("offer_accepted", { title: "Coat", amountMinor: 3000, currency: "ILS" });
    expect(notificationText(accepted, en)).toBe("Your offer of ₪30 on Coat was accepted");
    expect(notificationText(accepted, he)).toContain("₪30");
    const review = row("review_received", { rating: 1 });
    expect(notificationText(review, en)).toBe("Someone gave you 1 star");
    expect(notificationText(row("review_received", { rating: 4 }), en)).toBe("Someone gave you 4 stars");
    expect(notificationText(row("review_received", { rating: 2 }), he)).toContain("שני כוכבים");
    expect(notificationText(row("review_reminder", { title: "Coat" }), en)).toBe(
      "How was Coat? Leave feedback",
    );
    expect(notificationText(row("favourite_sold", { title: "Coat" }), en)).toBe("Coat has been sold");
    expect(notificationText(row("order_paid", { title: "Coat", itemCount: 3 }), he)).toContain("שני פריטים");
  });
});

describe("where a notification leads", () => {
  it("opens the order for order news, the chat for offers, the profile for a review", () => {
    expect(routeForNotification({ type: "order_shipped", orderId: "o1", conversationId: "c1" })).toEqual({
      pathname: "/(app)/(tabs)/(inbox)/order/[id]",
      params: { id: "o1" },
    });
    expect(routeForNotification({ type: "review_reminder", orderId: "o1", conversationId: "c1" })).toEqual({
      pathname: "/(app)/(tabs)/(inbox)/order/[id]",
      params: { id: "o1" },
    });
    expect(routeForNotification({ type: "balance_released", orderId: "o1" })).toEqual({
      pathname: "/(app)/(tabs)/(inbox)/order/[id]",
      params: { id: "o1" },
    });
    expect(routeForNotification({ type: "referral_rewarded" })).toBe("/(app)/(tabs)/(inbox)/invite");
    expect(routeForNotification({ type: "new_offer", conversationId: "c1", listingId: "l1" })).toEqual({
      pathname: "/conversation/[id]",
      params: { id: "c1" },
    });
    expect(routeForNotification({ type: "review_received", orderId: "o1", conversationId: "c1" })).toBe(
      "/profile",
    );
    expect(routeForNotification({ type: "favourite_sold", listingId: "l1" })).toEqual({
      pathname: "/(app)/(tabs)/(inbox)/listing/[id]",
      params: { id: "l1" },
    });
  });

  it("isolates a title of the other script so the sentence keeps its reading order", async () => {
    const en = await make("en");
    expect(notificationText(row("order_completed", { title: "מעיל" }), en)).toBe(
      "\u2068מעיל\u2069 is all wrapped up",
    );
    const he = await make("he");
    expect(notificationText(row("order_completed", { title: "Blue coat" }), he)).toContain(
      "\u2068Blue coat\u2069",
    );
    expect(notificationText(row("order_completed", { title: "מעיל" }), he)).not.toContain("\u2068");
  });
});

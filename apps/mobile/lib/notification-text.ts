import type { AppNotification } from "@vinty/shared";
import type { TFunction } from "i18next";
import { formatMoney } from "./money";

const str = (v: unknown): string | null => (typeof v === "string" && v.trim() !== "" ? v.trim() : null);
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

/**
 * The sentence for a row in the Notifications tab. The server sends only a type and some values, the app writes the
 * words in the person's language (docs/blueprint/api.md). Every type the server can produce has a sentence, and a
 * missing value falls back to a plain wording instead of showing "undefined".
 */
export function notificationText(n: AppNotification, t: TFunction): string {
  const data = n.data;
  const title = str(data.title) ?? t("inbox.notif.yourItem");
  const name = n.actor?.username ?? str(data.username) ?? t("inbox.notif.someone");
  const amount = num(data.amountMinor);
  const money = (minor: number) => formatMoney(minor, "ILS");
  const key = (k: string) => `inbox.notif.${k}`;

  switch (n.type) {
    case "new_offer":
      return amount !== null
        ? t(key("new_offer"), { name, title, amount: money(amount) })
        : t(key("new_offerNoAmount"), { name, title });
    case "offer_countered":
      return amount !== null
        ? t(key("offer_counteredAmount"), { title, amount: money(amount) })
        : t(key("offer_countered"), { title });
    case "listing_favourited": {
      const total = num(data.count) ?? 1;
      return total > 1
        ? t(key("listing_favouritedMany"), { name, title, count: total - 1 })
        : t(key("listing_favourited"), { name, title });
    }
    case "favourite_price_drop": {
      const price = num(data.newPriceMinor);
      return price !== null
        ? t(key("favourite_price_dropNow"), { title, price: money(price) })
        : t(key("favourite_price_drop"), { title });
    }
    case "review_received": {
      const rating = num(data.rating);
      return rating !== null && rating >= 1
        ? t(key("review_receivedRating"), { count: Math.round(rating) })
        : t(key("review_received"));
    }
    case "balance_released":
      return t(key("balance_released"), { amount: money(amount ?? 0) });
    case "platform_message": {
      const text = str(data.body) ?? str(data.text);
      if (text) return text;
      const known = str(data.key);
      if (known === "welcome") return t(key("platform_welcome"));
      if (known === "welcome_back") return t(key("platform_welcome_back"));
      return t(key("platform_message"));
    }
    case "new_message":
    case "offer_accepted":
    case "offer_declined":
    case "offer_expired":
    case "favourite_sold":
    case "new_follower":
    case "followed_seller_new_item":
    case "saved_search_match":
    case "order_paid":
    case "order_shipped":
    case "order_delivered":
    case "order_completed":
    case "order_cancelled":
    case "review_reminder":
    case "referral_rewarded":
    case "listing_removed":
    case "bump_ended":
      return t(key(n.type), { name, title });
    default:
      return t(key("platform_message"));
  }
}

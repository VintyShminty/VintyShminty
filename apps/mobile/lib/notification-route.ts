import type { Href } from "expo-router";

type Target = {
  type?: string | null;
  listingId?: string | null;
  orderId?: string | null;
  conversationId?: string | null;
  userId?: string | null;
};

/**
 * Where a notification leads, for a row in the Notifications tab and for a tapped push (docs/blueprint/api.md, Push).
 * Item, profile and order pages open inside the Inbox tab so the tab bar stays. Offers open their chat, orders (paid,
 * shipped, delivered, completed, cancelled), the money released and the feedback reminder open the order. Null means
 * there is nothing to open.
 */
export function routeForNotification(target: Target): Href | null {
  if (target.type === "review_received") return "/profile";
  if (target.type === "referral_rewarded") return "/(app)/(tabs)/(inbox)/invite";
  if (target.orderId) {
    return { pathname: "/(app)/(tabs)/(inbox)/order/[id]", params: { id: target.orderId } };
  }
  if (target.conversationId) return { pathname: "/conversation/[id]", params: { id: target.conversationId } };
  if (target.type === "new_follower" && target.userId) {
    return { pathname: "/(app)/(tabs)/(inbox)/user/[id]", params: { id: target.userId } };
  }
  if (target.listingId)
    return { pathname: "/(app)/(tabs)/(inbox)/listing/[id]", params: { id: target.listingId } };
  return null;
}

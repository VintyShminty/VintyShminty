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
 * Item and profile pages open inside the Inbox tab so the tab bar stays. Null means there is nothing to open (the order screens arrive in Milestone 5).
 */
export function routeForNotification(target: Target): Href | null {
  if (target.conversationId) return { pathname: "/conversation/[id]", params: { id: target.conversationId } };
  if (target.type === "new_follower" && target.userId) {
    return { pathname: "/(app)/(tabs)/(inbox)/user/[id]", params: { id: target.userId } };
  }
  if (target.type === "review_received") return "/profile";
  if (target.listingId)
    return { pathname: "/(app)/(tabs)/(inbox)/listing/[id]", params: { id: target.listingId } };
  return null;
}

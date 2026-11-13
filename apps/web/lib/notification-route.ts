type Target = {
  type?: string | null;
  listingId?: string | null;
  orderId?: string | null;
  conversationId?: string | null;
  userId?: string | null;
};

/**
 * Where a notification leads on the website. The same choices as the app, mapped to the pages the website has:
 * an order (paid, shipped, delivered, completed, cancelled) opens the order page, a chat opens its chat, a follower
 * opens their profile, an item opens the item page. A page the website does not have yet (the invite page) goes to the
 * closest one. Null means there is nothing to open.
 */
export function routeForNotification(lang: string, target: Target): string | null {
  const base = `/${lang}`;
  if (target.type === "review_received" || target.type === "referral_rewarded") return `${base}/profile`;
  if (target.orderId) return `${base}/orders/${target.orderId}`;
  if (target.conversationId) return `${base}/inbox/${target.conversationId}`;
  if (target.type === "new_follower" && target.userId) return `${base}/seller/${target.userId}`;
  if (target.listingId) return `${base}/item/${target.listingId}`;
  return null;
}

type Target = {
  type?: string | null;
  listingId?: string | null;
  orderId?: string | null;
  conversationId?: string | null;
  userId?: string | null;
};

/**
 * Where a notification leads on the website. The same choices as the app, mapped to the pages the website has:
 * a chat opens its chat (an order opens the chat it came from, that is where the order card is, until orders come to
 * the website), a follower opens their profile, an item opens the item page. A page the website does not have yet
 * (the invite page) goes to the closest one. Null means there is nothing to open.
 */
export function routeForNotification(lang: string, target: Target): string | null {
  const base = `/${lang}`;
  if (target.type === "review_received" || target.type === "referral_rewarded") return `${base}/profile`;
  if (target.conversationId) return `${base}/inbox/${target.conversationId}`;
  if (target.type === "new_follower" && target.userId) return `${base}/seller/${target.userId}`;
  if (target.listingId) return `${base}/item/${target.listingId}`;
  if (target.orderId) return `${base}/inbox`;
  return null;
}

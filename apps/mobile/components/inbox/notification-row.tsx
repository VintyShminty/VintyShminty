import type { AppNotification, NotificationType } from "@vinty/shared";
import { useRouter } from "expo-router";
import type { LucideIcon } from "lucide-react-native";
import {
  BadgeDollarSign,
  Bell,
  Gift,
  Heart,
  Megaphone,
  MessageCircle,
  PackageCheck,
  Search,
  Star,
  Tag,
  Trash2,
  TrendingUp,
  UserPlus,
  Wallet,
} from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { Pressable, View } from "react-native";
import { Avatar } from "@/components/ui/avatar";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { formatRowTime } from "@/lib/chat-format";
import { useMarkNotificationsRead } from "@/lib/messaging-queries";
import { routeForNotification } from "@/lib/notification-route";
import { notificationText } from "@/lib/notification-text";

const ICONS: Record<NotificationType, LucideIcon> = {
  new_message: MessageCircle,
  new_offer: Tag,
  offer_accepted: Tag,
  offer_declined: Tag,
  offer_countered: Tag,
  offer_expired: Tag,
  listing_favourited: Heart,
  favourite_sold: Heart,
  favourite_price_drop: TrendingUp,
  new_follower: UserPlus,
  followed_seller_new_item: UserPlus,
  saved_search_match: Search,
  order_paid: BadgeDollarSign,
  order_shipped: PackageCheck,
  order_delivered: PackageCheck,
  order_completed: PackageCheck,
  order_cancelled: PackageCheck,
  review_received: Star,
  review_reminder: Star,
  balance_released: Wallet,
  referral_rewarded: Gift,
  listing_removed: Trash2,
  bump_ended: TrendingUp,
  platform_message: Megaphone,
};

/**
 * One notification (docs/components.md, ConversationRow, notification variant): the person who caused it or an icon
 * for the kind, up to four lines of text, the time, and a dot with bolder text while unread. Tapping marks it read and
 * opens the item or chat it is about.
 */
function NotificationRow({ notification }: { notification: AppNotification }) {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const markRead = useMarkNotificationsRead();
  const unread = notification.readAt === null;
  const text = notificationText(notification, t);
  const actor = notification.actor;

  const open = () => {
    if (unread) markRead.mutate([notification.id]);
    const data = notification.data as { userId?: string };
    const href = routeForNotification({
      type: notification.type,
      listingId: notification.listingId,
      orderId: notification.orderId,
      conversationId: notification.conversationId,
      userId: actor?.id ?? data.userId,
    });
    if (href) router.push(href);
  };

  return (
    <Pressable
      onPress={open}
      role="button"
      accessibilityLabel={`${unread ? `${t("inbox.unread")}, ` : ""}${text}`}
      className={`flex-row items-start gap-md px-lg py-md active:bg-surface ${unread ? "bg-accent-tint" : ""}`}
    >
      {actor && notification.type !== "listing_removed" ? (
        <Avatar uri={actor.avatarUrl} name={actor.username} size={44} />
      ) : (
        <View className="h-11 w-11 items-center justify-center rounded-full bg-pressed">
          <Icon as={ICONS[notification.type] ?? Bell} size={20} className="text-text-2" />
        </View>
      )}
      <View className="flex-1 gap-xs">
        <Text variant="bodySmall" weight={unread ? 700 : 400} numberOfLines={4}>
          {text}
        </Text>
        <Text variant="cardMeta">{formatRowTime(notification.createdAt, i18n.language)}</Text>
      </View>
      {unread ? <View className="mt-xs h-2.5 w-2.5 rounded-full bg-primary" /> : null}
    </Pressable>
  );
}

export { NotificationRow };

"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { type AppNotification, formatRowTime, type NotificationType, notificationText } from "@vinty/shared";
import {
  BadgeDollarSign,
  Bell,
  Bookmark,
  Gift,
  Loader2,
  type LucideIcon,
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
} from "lucide-react";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { ListMessage, SkeletonRows } from "@/components/inbox/conversation-list";
import { SellerAvatar } from "@/components/seller-avatar";
import { notificationsQuery, useMarkNotificationsRead } from "@/lib/messaging-queries";
import { routeForNotification } from "@/lib/notification-route";
import { useLoadMore } from "@/lib/use-load-more";
import { cn } from "@/lib/utils";

const ICONS: Record<NotificationType, LucideIcon> = {
  new_message: MessageCircle,
  new_offer: Tag,
  offer_accepted: Tag,
  offer_declined: Tag,
  offer_countered: Tag,
  offer_expired: Tag,
  listing_favourited: Bookmark,
  favourite_sold: Bookmark,
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
 * One notification: the person who caused it or an icon for the kind, the sentence, the time, and a dot with bolder
 * text while unread. A click marks it read and opens the item or chat it is about.
 */
function Row({ lang, notification }: { lang: string; notification: AppNotification }) {
  const { t, i18n } = useTranslation();
  const markRead = useMarkNotificationsRead();
  const unread = notification.readAt === null;
  const text = notificationText(notification, t);
  const actor = notification.actor;
  const data = notification.data as { userId?: string };
  const href = routeForNotification(lang, {
    type: notification.type,
    listingId: notification.listingId,
    orderId: notification.orderId,
    conversationId: notification.conversationId,
    userId: actor?.id ?? data.userId,
  });
  const Icon = ICONS[notification.type] ?? Bell;

  const content = (
    <>
      {actor && notification.type !== "listing_removed" ? (
        <SellerAvatar url={actor.avatarUrl} name={actor.username ?? "?"} size={44} />
      ) : (
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-pressed">
          <Icon size={20} className="text-text-2" aria-hidden />
        </span>
      )}
      <span className="flex min-w-0 flex-1 flex-col gap-xs text-start">
        <span className={cn("line-clamp-4 text-body-sm", unread ? "font-bold" : "")}>{text}</span>
        <span className="text-card-meta text-text-3">
          {formatRowTime(notification.createdAt, i18n.language)}
        </span>
      </span>
      {unread ? <span aria-hidden className="mt-xs h-2.5 w-2.5 shrink-0 rounded-full bg-primary" /> : null}
    </>
  );
  const classes = cn(
    "flex w-full items-start gap-md px-lg py-md hover:bg-surface",
    unread && "bg-accent-tint hover:bg-accent-tint",
  );
  const label = `${unread ? `${t("inbox.unread")}, ` : ""}${text}`;
  const onOpen = () => {
    if (unread) markRead.mutate([notification.id]);
  };
  return href ? (
    <Link href={href} onClick={onOpen} aria-label={label} className={classes}>
      {content}
    </Link>
  ) : (
    <button type="button" onClick={onOpen} aria-label={label} className={classes}>
      {content}
    </button>
  );
}

/** The news list (Notifications tab): sentences written from the type and values the server sends. Endless. */
export function NotificationList({ lang }: { lang: string }) {
  const { t } = useTranslation();
  const query = useInfiniteQuery(notificationsQuery());
  const rows = query.data?.pages.flatMap((p) => p.items) ?? [];
  const more = useLoadMore(
    Boolean(query.hasNextPage),
    query.isFetchingNextPage,
    () => void query.fetchNextPage(),
  );

  let empty: React.ReactElement | null = null;
  if (query.isPending) empty = <SkeletonRows />;
  else if (query.isError && rows.length === 0) {
    empty = (
      <ListMessage
        title={t("errors.general")}
        action={
          <button
            type="button"
            onClick={() => void query.refetch()}
            className="inline-flex h-11 items-center rounded-control border border-border px-lg text-body-sm font-semibold text-text-1 hover:bg-pressed"
          >
            {t("common.tryAgain")}
          </button>
        }
      />
    );
  } else if (rows.length === 0) {
    empty = (
      <ListMessage title={t("inbox.emptyNotificationsTitle")} note={t("inbox.emptyNotificationsNote")} />
    );
  }

  return (
    <div>
      {empty}
      {rows.map((n) => (
        <Row key={n.id} lang={lang} notification={n} />
      ))}
      <div ref={more} aria-hidden className="flex h-10 items-center justify-center">
        {query.isFetchingNextPage ? (
          <Loader2 size={18} className="animate-spin text-text-3 motion-reduce:animate-none" aria-hidden />
        ) : null}
      </div>
    </div>
  );
}

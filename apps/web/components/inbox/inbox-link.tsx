"use client";

import { Bell, Inbox } from "lucide-react";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { useUnread } from "@/lib/use-unread";

/** A small round count on the inbox icon. Hidden at zero. */
export function UnreadCount({ count, className = "" }: { count: number; className?: string }) {
  if (count <= 0) return null;
  return (
    <span
      aria-hidden
      className={`inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold leading-none text-on-accent ${className}`}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}

/** The inbox icon in the top bar with the number of unread chats on it. */
export function InboxLink({ lang, className }: { lang: string; className: string }) {
  const { t } = useTranslation();
  const { messages } = useUnread();
  return (
    <Link
      href={`/${lang}/inbox`}
      aria-label={messages > 0 ? t("web.inbox.iconUnread", { count: messages }) : t("tabs.inbox")}
      className={`relative ${className}`}
    >
      <Inbox size={20} aria-hidden />
      <UnreadCount count={messages} className="absolute end-[3px] top-[3px] ring-2 ring-background" />
    </Link>
  );
}

/** The notification bell in the top bar. Opens the Notifications tab of the inbox, with the unread count on it. */
export function BellLink({ lang, className }: { lang: string; className: string }) {
  const { t } = useTranslation();
  const { notifications } = useUnread();
  return (
    <Link
      href={`/${lang}/inbox?tab=notifications`}
      aria-label={
        notifications > 0 ? t("web.inbox.bellUnread", { count: notifications }) : t("inbox.notifications")
      }
      className={`relative ${className}`}
    >
      <Bell size={20} aria-hidden />
      <UnreadCount count={notifications} className="absolute end-[3px] top-[3px] ring-2 ring-background" />
    </Link>
  );
}

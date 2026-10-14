"use client";

import { Inbox } from "lucide-react";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { useUnread } from "@/lib/use-unread";

/** A small round count on the inbox icon. Hidden at zero. */
export function UnreadCount({ count, className = "" }: { count: number; className?: string }) {
  if (count <= 0) return null;
  return (
    <span
      aria-hidden
      className={`inline-flex min-w-[18px] items-center justify-center rounded-full bg-primary px-[5px] text-badge font-semibold text-on-accent ${className}`}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}

/** The inbox icon in the top bar with the number of unread chats and notifications on it. */
export function InboxLink({ lang, className }: { lang: string; className: string }) {
  const { t } = useTranslation();
  const { messages, notifications } = useUnread();
  const total = messages + notifications;
  return (
    <Link
      href={`/${lang}/inbox`}
      aria-label={total > 0 ? t("web.inbox.iconUnread", { count: total }) : t("tabs.inbox")}
      className={`relative ${className}`}
    >
      <Inbox size={20} aria-hidden />
      <UnreadCount count={total} className="absolute -end-1 -top-1" />
    </Link>
  );
}

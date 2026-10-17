"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { Bell, Inbox } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ListMessage, SkeletonRows } from "@/components/inbox/conversation-list";
import { NotificationRow } from "@/components/inbox/notification-list";
import { notificationsQuery } from "@/lib/messaging-queries";
import { useUnread } from "@/lib/use-unread";

const PREVIEW_COUNT = 5;

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

/**
 * The notification bell in the top bar (D-053). It opens a small panel under the bell with the latest 5 news items
 * (unread ones marked, the same rows as the Notifications tab) and a button to the full list. Clicking outside or
 * pressing Escape closes it, and so does going to another page. The news is only fetched once the panel is opened.
 */
export function BellLink({ lang, className }: { lang: string; className: string }) {
  const { t } = useTranslation();
  const { notifications } = useUnread();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  const pathname = usePathname();
  const query = useInfiniteQuery({ ...notificationsQuery(), enabled: open });
  const rows = (query.data?.pages[0]?.items ?? []).slice(0, PREVIEW_COUNT);

  // biome-ignore lint/correctness/useExhaustiveDependencies: closing when the page changes is the point
  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        button.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  let body: React.ReactElement;
  if (query.isPending) body = <SkeletonRows />;
  else if (rows.length === 0) {
    body = query.isError ? (
      <ListMessage title={t("errors.general")} />
    ) : (
      <ListMessage title={t("inbox.emptyNotificationsTitle")} note={t("inbox.emptyNotificationsNote")} />
    );
  } else {
    body = (
      <div>
        {rows.map((n) => (
          <NotificationRow key={n.id} lang={lang} notification={n} />
        ))}
      </div>
    );
  }

  return (
    <div ref={root} className="relative">
      <button
        ref={button}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={
          notifications > 0 ? t("web.inbox.bellUnread", { count: notifications }) : t("inbox.notifications")
        }
        onClick={() => setOpen((v) => !v)}
        className={`relative ${className}`}
      >
        <Bell size={20} aria-hidden />
        <UnreadCount count={notifications} className="absolute end-[3px] top-[3px] ring-2 ring-background" />
      </button>
      <section
        id={panelId}
        hidden={!open}
        aria-label={t("inbox.notifications")}
        className="absolute end-0 top-full z-50 mt-sm w-[min(calc(100vw-32px),380px)] overflow-hidden rounded-window border border-border bg-background shadow-lg"
      >
        <div className="max-h-[420px] overflow-y-auto">{body}</div>
        <Link
          href={`/${lang}/inbox?tab=notifications`}
          className="flex h-12 items-center justify-center border-t border-border-subtle text-body-sm font-semibold text-text-1 hover:bg-surface"
        >
          {t("web.inbox.viewAllNotifications")}
        </Link>
      </section>
    </div>
  );
}

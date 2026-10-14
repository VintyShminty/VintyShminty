"use client";

import { MessageSquare } from "lucide-react";
import { useSearchParams, useSelectedLayoutSegment } from "next/navigation";
import { type ReactNode, useState } from "react";
import { useTranslation } from "react-i18next";
import { ConversationList } from "@/components/inbox/conversation-list";
import { NotificationList } from "@/components/inbox/notification-list";
import { useMarkNotificationsRead } from "@/lib/messaging-queries";
import { useUnread } from "@/lib/use-unread";
import { cn } from "@/lib/utils";

type Section = "messages" | "notifications";

/**
 * The inbox frame (D-030, decision 3). On a laptop two columns: the list at the start (Messages and Notifications
 * tabs) and the open chat at the end. On a phone the list is the page, and a chat takes the whole screen with a back
 * link, like the app. The layout stays mounted while you move between chats, so the list keeps its place.
 * `?tab=notifications` opens the Notifications tab.
 */
export function InboxShell({ lang, children }: { lang: string; children: ReactNode }) {
  const { t } = useTranslation();
  const openId = useSelectedLayoutSegment();
  const params = useSearchParams();
  const [section, setSection] = useState<Section>(
    params.get("tab") === "notifications" ? "notifications" : "messages",
  );
  const unread = useUnread();
  const markAll = useMarkNotificationsRead();
  const chatOpen = openId !== null;

  const tab = (key: Section, label: string, dot: boolean) => (
    <button
      type="button"
      role="tab"
      id={`inbox-tab-${key}`}
      aria-selected={section === key}
      aria-controls="inbox-list"
      onClick={() => setSection(key)}
      className={cn(
        "relative flex h-11 flex-1 items-center justify-center gap-xs text-body-sm font-semibold",
        section === key
          ? "text-text-1 after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-primary"
          : "text-text-3 hover:text-text-1",
      )}
    >
      {label}
      {dot ? (
        <>
          <span aria-hidden className="h-2 w-2 rounded-full bg-primary" />
          <span className="sr-only">{t("inbox.unread")}</span>
        </>
      ) : null}
    </button>
  );

  return (
    <main className="mx-auto w-full max-w-[1400px] md:px-xl md:py-lg">
      <div className="grid grid-cols-[minmax(0,1fr)] h-[calc(100dvh-8rem)] min-h-[420px] overflow-hidden bg-background md:h-[calc(100dvh-7.5rem)] md:grid-cols-[minmax(320px,400px)_minmax(0,1fr)] md:rounded-window md:border md:border-border">
        <section
          aria-label={t("tabs.inbox")}
          className={cn("min-h-0 flex-col border-border md:flex md:border-e", chatOpen ? "hidden" : "flex")}
        >
          <div className="flex h-14 shrink-0 items-center justify-between px-lg">
            <h1 className="text-heading font-bold text-text-1">{t("tabs.inbox")}</h1>
            {section === "notifications" && unread.notifications > 0 ? (
              <button
                type="button"
                onClick={() => markAll.mutate(undefined)}
                className="rounded-control px-sm py-xs text-body-sm font-semibold text-primary hover:bg-accent-tint"
              >
                {t("inbox.markAllRead")}
              </button>
            ) : null}
          </div>
          <div role="tablist" aria-label={t("tabs.inbox")} className="flex shrink-0 border-b border-border">
            {tab("messages", t("inbox.messages"), unread.messages > 0)}
            {tab("notifications", t("inbox.notifications"), unread.notifications > 0)}
          </div>
          <div
            id="inbox-list"
            role="tabpanel"
            aria-labelledby={`inbox-tab-${section}`}
            className="min-h-0 flex-1 overflow-y-auto overscroll-contain"
          >
            {section === "messages" ? (
              <ConversationList lang={lang} openId={openId} />
            ) : (
              <NotificationList lang={lang} />
            )}
          </div>
        </section>
        <div className={cn("min-h-0 min-w-0 md:block", chatOpen ? "block" : "hidden")}>{children}</div>
      </div>
    </main>
  );
}

/** What the chat column shows on a laptop before a chat is picked. */
export function PickAChat() {
  const { t } = useTranslation();
  return (
    <div className="flex h-full flex-col items-center justify-center gap-sm px-xl text-center">
      <MessageSquare size={36} className="text-text-4" aria-hidden />
      <p className="text-heading font-semibold text-text-1">{t("web.inbox.pickTitle")}</p>
      <p className="text-subtitle text-text-3">{t("web.inbox.pickNote")}</p>
    </div>
  );
}

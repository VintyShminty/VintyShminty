"use client";

import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import {
  areOffersClosed,
  buildThreadItems,
  dayLabel,
  formatClock,
  type MessageOffer,
  type ThreadItem,
} from "@vinty/shared";
import { Archive, ArchiveRestore, ArrowLeft, Bell, BellOff, Loader2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { IntroCard, ItemStrip, TypingDots, usePhotoViewer } from "@/components/inbox/chat-parts";
import { Composer } from "@/components/inbox/composer";
import { MessageBubble, PendingBubble } from "@/components/inbox/message-bubble";
import { OrderTracker } from "@/components/inbox/order-tracker";
import { OfferDialog } from "@/components/offer/offer-dialog";
import { SellerAvatar } from "@/components/seller-avatar";
import { useViewer } from "@/components/site-context";
import {
  discardMessage,
  type PendingMessage,
  retryMessage,
  sendNewMessage,
  usePendingMessages,
} from "@/lib/chat-send";
import { conversationQuery, messagesQuery, useArchive, useMute } from "@/lib/messaging-queries";
import { useCounterOffer, useSendOffer } from "@/lib/order-flow-queries";
import { joinThread, leaveThread, markThreadRead, useRealtime } from "@/lib/realtime";

type Translate = (key: string, options?: Record<string, unknown>) => string;

/** Why a message did not go, in words, for the line under the bubble. */
function failedText(p: PendingMessage, t: Translate): string {
  if (p.reason === "blocked") return t("chat.blockedSend");
  if (p.reason === "tooFast") {
    return p.retryAfter ? t("chat.tooFastSeconds", { count: p.retryAfter }) : t("chat.tooFast");
  }
  if (p.reason === "network") return t("chat.network");
  return t("chat.other");
}

const iconButton =
  "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-text-2 hover:bg-pressed";

/**
 * One open chat: the header, the item strip, the order card when there is an order, the messages (newest at the bottom,
 * older ones load when you scroll up) and the box to write in. Behaves like the app's conversation screen.
 */
export function ChatView({ lang, id }: { lang: string; id: string }) {
  const { t, i18n } = useTranslation();
  const me = useViewer()?.id;
  const detail = useQuery(conversationQuery(id));
  const thread = useInfiniteQuery(messagesQuery(id));
  const allPending = usePendingMessages();
  const otherTyping = useRealtime((s) => Boolean(s.typing[id]));
  const archive = useArchive();
  const mute = useMute();
  const sendOffer = useSendOffer();
  const counterOffer = useCounterOffer();
  // The offer dialog: closed, a new offer from the buyer ("make"), or an answer to someone's offer (that offer).
  const [offerDialog, setOfferDialog] = useState<{ open: boolean; counterOf: MessageOffer | null }>({
    open: false,
    counterOf: null,
  });
  const [openPhoto, photoViewer] = usePhotoViewer();
  const conversation = detail.data;

  // The chat is open: join its live room, hold back pushes for it and keep it marked as read while the tab is visible.
  useEffect(() => {
    joinThread(id);
    if (document.visibilityState === "visible") markThreadRead(id);
    const onVisible = () => {
      if (document.visibilityState === "visible") markThreadRead(id);
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      leaveThread(id);
    };
  }, [id]);

  const messages = useMemo(() => thread.data?.pages.flatMap((p) => p.items) ?? [], [thread.data]);
  const pending = useMemo(() => allPending.filter((p) => p.conversationId === id), [allPending, id]);
  const items = useMemo(
    () =>
      buildThreadItems({
        messages,
        pending,
        me,
        hasMore: Boolean(thread.hasNextPage),
        otherTyping,
      }),
    [messages, pending, me, thread.hasNextPage, otherTyping],
  );

  // Older messages load when the top of the list comes into view (the list is drawn upside down, see below).
  const topMark = useRef<HTMLDivElement>(null);
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = thread;
  const ready = Boolean(conversation) && !thread.isPending;
  useEffect(() => {
    const el = topMark.current;
    if (!el || !ready) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting) && hasNextPage && !isFetchingNextPage) {
          void fetchNextPage();
        }
      },
      { rootMargin: "200px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [ready, hasNextPage, isFetchingNextPage, fetchNextPage]);

  const sendText = (text: string) => {
    if (!me) return;
    sendNewMessage({ conversationId: id, senderId: me, kind: "text", body: text });
  };
  const sendPhoto = (file: File) => {
    if (!me) return;
    sendNewMessage({ conversationId: id, senderId: me, kind: "photo", file });
  };

  const orderStatus = conversation?.order?.status;
  // Once the item is sold or an order is paid, old offers are history.
  const offersClosed = areOffersClosed(conversation?.listing.status, orderStatus);
  const canOffer =
    conversation?.role === "buyer" && conversation.listing.status === "active" && !conversation.blocked;
  const otherName = conversation?.otherUser.username ?? t("profile.closedAccount");
  const otherLastReadAt = conversation?.otherLastReadAt ?? null;

  const renderItem = (item: ThreadItem<PendingMessage>) => {
    switch (item.type) {
      case "typing":
        return <TypingDots key={item.key} name={otherName} />;
      case "day":
        return (
          <p key={item.key} className="py-md text-center text-card-meta text-text-3">
            {dayLabel(item.iso, i18n.language, { today: t("chat.today"), yesterday: t("chat.yesterday") })}
          </p>
        );
      case "intro":
        return conversation ? <IntroCard key={item.key} lang={lang} person={conversation.otherUser} /> : null;
      case "pending":
        return (
          <PendingBubble
            key={item.key}
            pending={item.pending}
            tight={item.tight}
            failedText={failedText(item.pending, t)}
            onRetry={() => retryMessage(item.pending.clientMessageId)}
            onDiscard={() => discardMessage(item.pending.clientMessageId)}
          />
        );
      case "message": {
        const clock = formatClock(item.message.createdAt, i18n.language);
        let statusLine: string | undefined;
        if (item.lastMine) {
          const seen = otherLastReadAt !== null && otherLastReadAt >= item.message.createdAt;
          statusLine = `${clock} · ${seen ? t("chat.seen") : t("chat.sent")}`;
        } else if (item.groupEnd && item.message.kind !== "system") {
          statusLine = clock;
        }
        return (
          <MessageBubble
            key={item.key}
            message={item.message}
            mine={item.mine}
            tight={item.tight}
            statusLine={statusLine}
            role={conversation?.role ?? "buyer"}
            lang={lang}
            offersClosed={offersClosed}
            onOpenPhoto={openPhoto}
            onCounter={(offer) => setOfferDialog({ open: true, counterOf: offer })}
          />
        );
      }
    }
  };

  const header = (
    <div className="flex h-14 shrink-0 items-center gap-sm px-sm">
      <Link
        href={`/${lang}/inbox`}
        aria-label={t("web.inbox.backToInbox")}
        className={`${iconButton} md:hidden`}
      >
        <ArrowLeft size={20} className="rtl:-scale-x-100" aria-hidden />
      </Link>
      {conversation?.otherUser.username ? (
        <Link
          href={`/${lang}/seller/${conversation.otherUser.id}`}
          aria-label={t("chat.openProfile", { name: otherName })}
          className="flex min-w-0 flex-1 items-center gap-sm rounded-control ps-xs hover:bg-pressed"
        >
          <SellerAvatar url={conversation.otherUser.avatarUrl} name={otherName} size={36} />
          <span className="truncate text-heading font-semibold text-text-1">{otherName}</span>
        </Link>
      ) : (
        <span className="flex min-w-0 flex-1 items-center gap-sm ps-xs">
          <span className="truncate text-heading font-semibold text-text-1">
            {conversation ? otherName : ""}
          </span>
        </span>
      )}
      {conversation ? (
        <>
          <button
            type="button"
            onClick={() => mute.mutate({ id, muted: !conversation.muted })}
            aria-label={conversation.muted ? t("inbox.unmute") : t("inbox.mute")}
            title={conversation.muted ? t("inbox.unmute") : t("inbox.mute")}
            className={iconButton}
          >
            {conversation.muted ? <BellOff size={20} aria-hidden /> : <Bell size={20} aria-hidden />}
          </button>
          <button
            type="button"
            onClick={() => archive.mutate({ id, archived: !conversation.archived })}
            aria-label={conversation.archived ? t("inbox.unarchive") : t("inbox.archive")}
            title={conversation.archived ? t("inbox.unarchive") : t("inbox.archive")}
            className={iconButton}
          >
            {conversation.archived ? (
              <ArchiveRestore size={20} aria-hidden />
            ) : (
              <Archive size={20} aria-hidden />
            )}
          </button>
        </>
      ) : null}
    </div>
  );

  let body: React.ReactElement;
  if (detail.isPending || (thread.isPending && !thread.data)) {
    body = (
      <div
        className="flex flex-1 items-center justify-center"
        role="status"
        aria-label={t("web.inbox.loading")}
      >
        <Loader2 size={28} className="animate-spin text-text-3 motion-reduce:animate-none" aria-hidden />
      </div>
    );
  } else if (detail.isError || !conversation) {
    body = (
      <div className="flex flex-1 flex-col items-center justify-center gap-md px-xl text-center">
        <p className="text-heading font-semibold text-text-1">{t("chat.loadFailed")}</p>
        <button
          type="button"
          onClick={() => {
            void detail.refetch();
            void thread.refetch();
          }}
          className="inline-flex h-11 items-center rounded-control border border-border px-lg text-body-sm font-semibold text-text-1 hover:bg-pressed"
        >
          {t("common.tryAgain")}
        </button>
      </div>
    );
  } else {
    body = (
      <>
        <ItemStrip lang={lang} listing={conversation.listing} />
        {conversation.order ? <OrderTracker orderId={conversation.order.id} lang={lang} /> : null}
        {/* The list is drawn upside down (newest first in the page, the browser puts the first one at the bottom and
            keeps the place when older messages are added above). */}
        <div
          role="log"
          aria-label={t("tabs.inbox")}
          className="flex min-h-0 flex-1 flex-col-reverse overflow-y-auto overscroll-contain py-sm"
        >
          {items.map(renderItem)}
          <div ref={topMark} aria-hidden className="flex h-8 shrink-0 items-center justify-center">
            {isFetchingNextPage ? (
              <Loader2
                size={18}
                className="animate-spin text-text-3 motion-reduce:animate-none"
                aria-hidden
              />
            ) : null}
          </div>
        </div>
        {conversation.blocked ? (
          <div className="border-t border-border-subtle bg-surface px-lg py-md">
            <p className="text-center text-body-sm text-text-2">{t("chat.blockedNote")}</p>
          </div>
        ) : (
          <Composer
            conversationId={id}
            onSend={sendText}
            onPickPhoto={sendPhoto}
            onOffer={canOffer ? () => setOfferDialog({ open: true, counterOf: null }) : undefined}
          />
        )}
      </>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      {header}
      {body}
      {conversation ? (
        <OfferDialog
          open={offerDialog.open}
          mode={offerDialog.counterOf ? "counter" : "make"}
          listingPriceMinor={offerDialog.counterOf?.listingPriceMinor ?? conversation.listing.priceMinor}
          currency={conversation.listing.currency}
          showQuota={conversation.role === "buyer"}
          onSend={async (amountMinor) => {
            const counterOf = offerDialog.counterOf;
            if (counterOf) await counterOffer.mutateAsync({ offerId: counterOf.id, amountMinor });
            else await sendOffer.mutateAsync({ conversationId: id, amountMinor });
          }}
          onClose={() => setOfferDialog((d) => ({ ...d, open: false }))}
        />
      ) : null}
      {photoViewer}
    </div>
  );
}

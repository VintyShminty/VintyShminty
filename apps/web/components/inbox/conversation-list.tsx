"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { type ConversationRow, formatRowTime } from "@vinty/shared";
import { Archive, ArrowLeft, BellOff, Camera, Loader2, Tag } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { SellerAvatar } from "@/components/seller-avatar";
import { conversationsQuery } from "@/lib/messaging-queries";
import { useLoadMore } from "@/lib/use-load-more";
import { cn } from "@/lib/utils";

/** What the second line says: the text, or a word for a photo, an offer or a divider. */
function PreviewLine({ row }: { row: ConversationRow }) {
  const { t } = useTranslation();
  const tone = row.unread ? "font-semibold text-text-1" : "text-text-3";
  const Icon = row.lastMessageKind === "photo" ? Camera : row.lastMessageKind === "offer" ? Tag : null;
  const text =
    row.lastMessageKind === "photo"
      ? t("inbox.previewPhoto")
      : row.lastMessageKind === "offer"
        ? t("inbox.previewOffer")
        : row.lastMessageKind === "system"
          ? t("inbox.previewSystem")
          : (row.lastMessagePreview ?? "");
  return (
    <span className={cn("flex items-center gap-xs text-body-sm", tone)}>
      {Icon ? <Icon size={14} className="shrink-0" aria-hidden /> : null}
      <span className="truncate">{text}</span>
    </span>
  );
}

/**
 * One chat in the list: the other person, the item's thumbnail, the last message, the time, a dot when unread (name
 * and text turn bold) and a muted bell. The open chat is highlighted.
 */
function Row({ lang, row, active }: { lang: string; row: ConversationRow; active: boolean }) {
  const { t, i18n } = useTranslation();
  const name = row.otherUser.username ?? t("profile.closedAccount");
  return (
    <Link
      href={`/${lang}/inbox/${row.id}`}
      aria-current={active ? "page" : undefined}
      aria-label={[row.unread ? t("inbox.unread") : null, name, row.listing.title].filter(Boolean).join(", ")}
      className={cn(
        "flex items-center gap-md px-lg py-md hover:bg-surface",
        active && "bg-accent-tint hover:bg-accent-tint",
      )}
    >
      <SellerAvatar url={row.otherUser.avatarUrl} name={name} size={52} />
      <span className="flex min-w-0 flex-1 flex-col gap-px">
        <span className="flex items-center gap-sm">
          <span className={cn("flex-1 truncate text-body", row.unread ? "font-extrabold" : "font-semibold")}>
            {name}
          </span>
          {row.muted ? (
            <BellOff size={13} className="shrink-0 text-text-4" aria-label={t("inbox.muted")} />
          ) : null}
          <span className={cn("shrink-0 text-card-meta", row.unread ? "text-text-1" : "text-text-3")}>
            {formatRowTime(row.lastMessageAt, i18n.language)}
          </span>
        </span>
        <span className="truncate text-card-desc text-text-3">{row.listing.title}</span>
        <span className="flex items-center gap-sm">
          <span className="min-w-0 flex-1">
            <PreviewLine row={row} />
          </span>
          {row.unread ? <span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-full bg-primary" /> : null}
        </span>
      </span>
      <span className="h-[52px] w-[52px] shrink-0 overflow-hidden rounded-control bg-pressed">
        {row.listing.photoUrl ? (
          // biome-ignore lint/performance/noImgElement: a small thumbnail, no image optimisation on purpose
          <img
            src={row.listing.photoUrl}
            alt=""
            width={52}
            height={52}
            className="h-full w-full object-cover"
          />
        ) : null}
      </span>
    </Link>
  );
}

export function SkeletonRows() {
  return (
    <div aria-hidden>
      {[0, 1, 2, 3, 4].map((n) => (
        <div key={n} className="flex items-center gap-md px-lg py-md">
          <span className="h-[52px] w-[52px] rounded-full bg-pressed" />
          <span className="flex flex-1 flex-col gap-sm">
            <span className="h-3 w-1/3 rounded-full bg-pressed" />
            <span className="h-3 w-1/2 rounded-full bg-surface" />
            <span className="h-3 w-2/3 rounded-full bg-pressed" />
          </span>
          <span className="h-[52px] w-[52px] rounded-control bg-pressed" />
        </div>
      ))}
    </div>
  );
}

export function ListMessage({
  title,
  note,
  action,
}: {
  title: string;
  note?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-sm px-xl py-2xl text-center">
      <p className="text-heading font-semibold text-text-1">{title}</p>
      {note ? <p className="text-subtitle text-text-3">{note}</p> : null}
      {action}
    </div>
  );
}

/** The chats (Messages tab), with the archive one click away. Endless: more load as you scroll. */
export function ConversationList({ lang, openId }: { lang: string; openId: string | null }) {
  const { t } = useTranslation();
  const [archived, setArchived] = useState(false);
  const query = useInfiniteQuery(conversationsQuery(archived));
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
    empty = archived ? (
      <ListMessage title={t("inbox.emptyArchivedTitle")} note={t("inbox.emptyArchivedNote")} />
    ) : (
      <ListMessage title={t("inbox.emptyMessagesTitle")} note={t("inbox.emptyMessagesNote")} />
    );
  }

  return (
    <div>
      {archived ? (
        <button
          type="button"
          onClick={() => setArchived(false)}
          className="flex w-full items-center gap-md border-b border-border-subtle px-lg py-md text-start hover:bg-surface"
        >
          <ArrowLeft size={20} className="text-text-2 rtl:-scale-x-100" aria-hidden />
          <span className="flex-1 text-body font-semibold text-text-1">{t("inbox.archived")}</span>
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setArchived(true)}
          className="flex w-full items-center gap-md border-b border-border-subtle px-lg py-md text-start hover:bg-surface"
        >
          <Archive size={20} className="text-text-2" aria-hidden />
          <span className="flex-1 text-body font-semibold text-text-1">{t("inbox.archived")}</span>
        </button>
      )}
      {empty}
      {rows.map((row) => (
        <Row key={row.id} lang={lang} row={row} active={row.id === openId} />
      ))}
      <div ref={more} aria-hidden className="flex h-10 items-center justify-center">
        {query.isFetchingNextPage ? (
          <Loader2 size={18} className="animate-spin text-text-3 motion-reduce:animate-none" aria-hidden />
        ) : null}
      </div>
    </div>
  );
}

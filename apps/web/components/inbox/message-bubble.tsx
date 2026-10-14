"use client";

import { effectiveOfferStatus, formatPrice, isolate, type Message, type MessageOffer } from "@vinty/shared";
import {
  AlertCircle,
  AlertTriangle,
  Ban,
  CheckCircle2,
  ChevronRight,
  Loader2,
  type LucideIcon,
  Package,
  ReceiptText,
  RotateCcw,
  Star,
  TriangleAlert,
  Truck,
} from "lucide-react";
import Link from "next/link";
import { type ReactNode, useState } from "react";
import { useTranslation } from "react-i18next";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { ApiClientError } from "@/lib/api-error";
import type { PendingMessage } from "@/lib/chat-send";
import { warningFor } from "@/lib/chat-assist";
import { type OfferAnswer, useAnswerOffer } from "@/lib/order-flow-queries";
import { cn } from "@/lib/utils";

/** The corner that points at the sender is tighter (a small tail). `rounded-ee` is the end side, `rounded-es` the start. */
const TAIL = { mine: "rounded-ee-[3px]", theirs: "rounded-es-[3px]" } as const;
type Side = keyof typeof TAIL;

/** The most a photo bubble shows: 260 wide, and no taller than 1.4 times its width. */
function photoBox(width: number | null | undefined, height: number | null | undefined) {
  const w = 260;
  const ratio = width && height ? Math.min(Math.max(height / width, 0.6), 1.4) : 1;
  return { width: w, height: Math.round(w * ratio) };
}

function PhotoBubble({
  url,
  width,
  height,
  side,
  busy,
  failed,
  onOpen,
  label,
}: {
  url: string;
  width: number | null | undefined;
  height: number | null | undefined;
  side: Side;
  busy?: boolean;
  failed?: boolean;
  onOpen?: () => void;
  label: string;
}) {
  const box = photoBox(width, height);
  return (
    <button
      type="button"
      onClick={onOpen}
      disabled={!onOpen}
      aria-label={label}
      style={{ width: box.width, height: box.height }}
      className={cn(
        "relative block max-w-[76%] overflow-hidden rounded-control border bg-pressed",
        TAIL[side],
        side === "mine" ? "self-end" : "self-start",
        failed ? "border-error" : "border-border",
        onOpen ? "cursor-zoom-in" : "cursor-default",
      )}
    >
      {/* biome-ignore lint/performance/noImgElement: a chat photo straight from storage */}
      <img src={url} alt="" className="h-full w-full object-cover" />
      {busy ? (
        <span className="absolute inset-0 flex items-center justify-center bg-backdrop">
          <Loader2 size={22} className="animate-spin text-on-accent motion-reduce:animate-none" aria-hidden />
        </span>
      ) : null}
    </button>
  );
}

function TextBubble({ body, side }: { body: string; side: Side }) {
  return (
    <div
      dir="auto"
      className={cn(
        "max-w-[76%] whitespace-pre-wrap break-words rounded-control px-md py-[9px] text-[15px] leading-[21px]",
        TAIL[side],
        side === "mine"
          ? "self-end bg-primary text-on-accent"
          : "self-start border border-border bg-background text-text-1",
      )}
    >
      {body}
    </div>
  );
}

const DIVIDER_STYLES: Record<string, { icon: LucideIcon; tone: string }> = {
  order_paid: { icon: ReceiptText, tone: "text-primary" },
  order_shipped: { icon: Truck, tone: "text-primary" },
  order_delivered: { icon: Package, tone: "text-primary" },
  order_completed: { icon: CheckCircle2, tone: "text-success" },
  order_cancelled: { icon: Ban, tone: "text-error" },
  order_disputed: { icon: AlertTriangle, tone: "text-warning" },
  order_refunded: { icon: RotateCcw, tone: "text-text-2" },
  review_auto_left: { icon: Star, tone: "text-primary" },
};

type DividerPayload = {
  orderNumber?: number;
  title?: string;
  itemCount?: number;
  trackingCode?: string;
  reason?: string;
  details?: string;
};

/** A step of an order inside the chat: an icon, what happened, which order and item. A click opens the order page. */
function OrderDivider({
  event,
  orderId,
  payload,
  lang,
}: {
  event: string;
  orderId: string | null;
  payload: unknown;
  lang: string;
}) {
  const { t, i18n } = useTranslation();
  const style = DIVIDER_STYLES[event] ?? { icon: Package, tone: "text-primary" };
  const Icon = style.icon;
  const data = (payload ?? {}) as DividerPayload;
  const what =
    data.title && (data.itemCount ?? 1) > 1
      ? t("chat.order.moreItems", {
          title: isolate(data.title, i18n.language === "he"),
          count: (data.itemCount ?? 1) - 1,
        })
      : data.title;
  const detail =
    event === "order_shipped" && data.trackingCode
      ? t("chat.order.tracking", { code: data.trackingCode })
      : event === "order_cancelled" && data.reason
        ? t(`chat.order.reason.${data.reason}`, { defaultValue: "" })
        : event === "order_disputed" && data.details
          ? data.details
          : "";
  const content = (
    <>
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-background">
        <Icon size={20} className={style.tone} aria-hidden />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-px text-start">
        <span className="text-body font-semibold text-text-1">{t(`chat.system.${event}`)}</span>
        <span className="truncate text-card-desc text-text-2">
          {[data.orderNumber ? t("chat.order.number", { number: data.orderNumber }) : null, what]
            .filter(Boolean)
            .join(" · ")}
        </span>
        {detail ? <span className="text-card-meta text-text-3">{detail}</span> : null}
      </span>
      {orderId ? (
        <ChevronRight size={18} className="shrink-0 text-text-3 rtl:rotate-180" aria-hidden />
      ) : null}
    </>
  );
  const classes =
    "mx-auto flex w-full max-w-[420px] items-center gap-md rounded-control bg-surface px-[14px] py-md";
  return (
    <div className="px-lg py-sm">
      {orderId ? (
        <Link
          href={`/${lang}/orders/${orderId}`}
          aria-label={`${t(`chat.system.${event}`)}. ${t("chat.order.view")}`}
          className={cn(classes, "hover:bg-pressed")}
        >
          {content}
        </Link>
      ) : (
        <div className={classes}>{content}</div>
      )}
    </div>
  );
}

/**
 * An offer in the chat (D-034): a full width ledger line with who and the state on one side, the price and the listed
 * price struck through on the other, and a thin bar of the buttons that make sense for this person right now. The other person's waiting offer can be accepted, declined or countered. My own waiting
 * offer can be withdrawn. An accepted offer lets the buyer buy at that price until the hold runs out.
 */
function OfferBubble({
  offer,
  lang,
  mine,
  role,
  closed,
  onCounter,
}: {
  offer: MessageOffer;
  lang: string;
  mine: boolean;
  role: "buyer" | "seller";
  closed: boolean;
  onCounter: (offer: MessageOffer) => void;
}) {
  const { t, i18n } = useTranslation();
  const answer = useAnswerOffer();
  const [confirming, setConfirming] = useState<"decline" | "withdraw" | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const status = effectiveOfferStatus(offer);
  const lower = offer.amountMinor < offer.listingPriceMinor;
  const canAnswer = status === "pending" && !closed;
  const until = new Date(offer.expiresAt).toLocaleString(i18n.language, {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
  const busy = answer.isPending;

  const run = (kind: OfferAnswer) => {
    setFailed(null);
    answer.mutate(
      { offerId: offer.id, answer: kind },
      {
        onSettled: () => setConfirming(null),
        onError: (err) =>
          setFailed(
            err instanceof ApiClientError && err.status === 409 ? "offer.errors.closed" : "errors.general",
          ),
      },
    );
  };

  const cell =
    "flex h-11 flex-1 items-center justify-center text-[14px] font-semibold text-text-1 hover:bg-pressed disabled:opacity-60";
  const strong = "font-bold text-primary";
  const cells: ReactNode[] = [];
  if (canAnswer && !mine) {
    cells.push(
      <button
        key="decline"
        type="button"
        disabled={busy}
        onClick={() => setConfirming("decline")}
        className={cell}
      >
        {t("offer.decline")}
      </button>,
      <button key="counter" type="button" disabled={busy} onClick={() => onCounter(offer)} className={cell}>
        {t("offer.counter")}
      </button>,
      <button
        key="accept"
        type="button"
        disabled={busy}
        onClick={() => run("accept")}
        className={cn(cell, strong)}
      >
        {t("offer.accept")}
      </button>,
    );
  } else if (canAnswer && mine) {
    cells.push(
      <button
        key="withdraw"
        type="button"
        disabled={busy}
        onClick={() => setConfirming("withdraw")}
        className={cell}
      >
        {t("offer.withdraw")}
      </button>,
    );
  } else if (status === "accepted" && role === "buyer" && !closed) {
    cells.push(
      <Link key="buy" href={`/${lang}/checkout?offer=${offer.id}`} className={cn(cell, strong)}>
        {t("offer.buyNow", { amount: formatPrice(offer.amountMinor, offer.currency) })}
      </Link>,
    );
  }

  return (
    <div className="w-full self-stretch overflow-hidden rounded-control border border-border bg-background">
      <div className="flex items-center gap-md px-[14px] py-md">
        <span
          aria-hidden
          className={cn("w-[3px] self-stretch rounded-full", mine ? "bg-primary" : "bg-border")}
        />
        <span className="flex min-w-0 flex-1 flex-col gap-px text-start">
          <span className="text-section-label font-semibold uppercase text-text-3">
            {mine ? t("offer.bubble.yours") : t("offer.bubble.theirs")}
          </span>
          <span
            className={cn(
              "text-[13px] leading-[18px]",
              status === "accepted" ? "text-success" : "text-text-2",
            )}
          >
            {status === "pending"
              ? t(`offer.bubble.pending_${mine ? "mine" : "theirs"}`)
              : t(`chat.offerStatus.${status}`)}
          </span>
        </span>
        <span className="flex flex-col items-end">
          <span className="text-heading font-bold text-text-1">
            {formatPrice(offer.amountMinor, offer.currency)}
          </span>
          {lower ? (
            <span className="text-card-desc text-text-3 line-through">
              {formatPrice(offer.listingPriceMinor, offer.currency)}
            </span>
          ) : null}
        </span>
      </div>
      {status === "accepted" ? (
        <p className="pb-md ps-[29px] pe-[14px] text-card-desc text-text-3">
          {role === "buyer"
            ? t("offer.bubble.reservedForYou", { time: until })
            : t("offer.bubble.reservedForThem", { time: until })}
        </p>
      ) : null}
      {failed ? (
        <p role="alert" className="pb-md ps-[29px] pe-[14px] text-card-desc text-error">
          {t(failed)}
        </p>
      ) : null}
      {cells.length > 0 ? (
        <div className="flex divide-x divide-border-subtle border-t border-border-subtle rtl:divide-x-reverse">
          {cells}
        </div>
      ) : null}
      <ConfirmDialog
        open={confirming !== null}
        title={confirming ? t(`offer.confirm.${confirming}Title`) : ""}
        body={confirming ? t(`offer.confirm.${confirming}Note`) : undefined}
        confirmLabel={confirming ? t(`offer.${confirming}`) : ""}
        destructive
        busy={busy}
        onConfirm={() => confirming && run(confirming)}
        onCancel={() => setConfirming(null)}
      />
    </div>
  );
}

/** The sentence of a system divider that is not about an order ("Offer accepted"). */
function systemText(message: Message, t: (key: string, options?: Record<string, unknown>) => string): string {
  const event = message.systemEvent;
  if (!event) return t("chat.system.other");
  const payload = (message.payload ?? {}) as { amountMinor?: number };
  if (event === "offer_accepted" && typeof payload.amountMinor === "number") {
    return t("chat.system.offer_acceptedAmount", { amount: formatPrice(payload.amountMinor, "ILS") });
  }
  return t(`chat.system.${event}`);
}

/** One message of the chat. */
export function MessageBubble({
  message,
  mine,
  tight,
  statusLine,
  role,
  lang,
  offersClosed,
  me,
  onOpenPhoto,
  onCounter,
}: {
  message: Message;
  mine: boolean;
  tight: boolean;
  /** Small line under the bubble: the time, and Sent or Seen on your newest. */
  statusLine?: string;
  role: "buyer" | "seller";
  lang: string;
  offersClosed: boolean;
  /** Who is looking, for the warning line (only the receiver sees it). */
  me?: string;
  onOpenPhoto: (url: string) => void;
  onCounter: (offer: MessageOffer) => void;
}) {
  const { t } = useTranslation();
  const warning = warningFor(message, me);
  const side: Side = mine ? "mine" : "theirs";

  if (message.kind === "system") {
    if (message.systemEvent && message.systemEvent in DIVIDER_STYLES) {
      return (
        <OrderDivider
          event={message.systemEvent}
          orderId={message.orderId}
          payload={message.payload}
          lang={lang}
        />
      );
    }
    return (
      <div className="flex justify-center px-xl pb-xs pt-lg">
        <span className="text-center text-card-desc text-text-3">{systemText(message, t)}</span>
      </div>
    );
  }

  let body: React.ReactElement | null = null;
  if (message.kind === "photo" && message.attachment) {
    const url = message.attachment.url;
    body = (
      <PhotoBubble
        url={url}
        width={message.attachment.width}
        height={message.attachment.height}
        side={side}
        label={t("chat.viewPhoto")}
        onOpen={() => onOpenPhoto(url)}
      />
    );
  } else if (message.kind === "offer") {
    body = message.offer ? (
      <OfferBubble
        offer={message.offer}
        lang={lang}
        mine={mine}
        role={role}
        closed={offersClosed}
        onCounter={onCounter}
      />
    ) : null;
  } else if (message.body) {
    body = <TextBubble body={message.body} side={side} />;
  }
  if (!body) return null;

  return (
    <div className={cn("flex flex-col px-lg", tight ? "pt-xs" : "pt-md")}>
      {body}
      {warning ? (
        <span
          className={cn(
            "flex max-w-[76%] items-start gap-xs px-xs pt-xs text-card-meta text-text-3",
            mine ? "self-end" : "self-start",
          )}
        >
          <TriangleAlert size={14} className="mt-px shrink-0 text-warning" aria-hidden />
          <span>{t(`chat.assist.warning.${warning}`)}</span>
        </span>
      ) : null}
      {statusLine ? (
        <span className={cn("px-xs pt-xs text-card-meta text-text-3", mine ? "self-end" : "self-start")}>
          {statusLine}
        </span>
      ) : null}
    </div>
  );
}

/** A message that is still being sent, or could not be. Click the line under it to try again. */
export function PendingBubble({
  pending,
  tight,
  failedText,
  onRetry,
  onDiscard,
}: {
  pending: PendingMessage;
  tight: boolean;
  failedText: string;
  onRetry: () => void;
  onDiscard: () => void;
}) {
  const { t } = useTranslation();
  const failed = pending.state === "failed";
  return (
    <div className={cn("flex flex-col px-lg", tight ? "pt-xs" : "pt-md")}>
      {pending.kind === "photo" && pending.previewUrl ? (
        <PhotoBubble
          url={pending.previewUrl}
          width={pending.width}
          height={pending.height}
          side="mine"
          busy={!failed}
          failed={failed}
          label={t("chat.photo")}
        />
      ) : (
        <div
          dir="auto"
          className={cn(
            "max-w-[76%] self-end whitespace-pre-wrap break-words rounded-control rounded-ee-[3px] bg-primary px-md py-[9px] text-[15px] leading-[21px] text-on-accent",
            failed ? "border border-error" : "opacity-70",
          )}
        >
          {pending.body}
        </div>
      )}
      {failed ? (
        <span className="flex items-center gap-sm self-end pt-xs">
          <AlertCircle size={13} className="text-error" aria-hidden />
          <button
            type="button"
            onClick={onRetry}
            className="text-card-meta font-semibold text-error hover:underline"
          >
            {failedText}
          </button>
          <button
            type="button"
            onClick={onDiscard}
            className="text-card-meta font-semibold text-text-2 underline"
          >
            {t("chat.discard")}
          </button>
        </span>
      ) : (
        <span className="self-end px-xs pt-xs text-card-meta text-text-3">{t("chat.sending")}</span>
      )}
    </div>
  );
}

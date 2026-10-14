"use client";

import { formatPrice, isolate, type Message, type MessageOffer } from "@vinty/shared";
import {
  AlertCircle,
  AlertTriangle,
  Ban,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock,
  CornerUpLeft,
  Hourglass,
  Loader2,
  type LucideIcon,
  Package,
  ReceiptText,
  RotateCcw,
  Star,
  Truck,
  Undo2,
  X,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/badge";
import type { PendingMessage } from "@/lib/chat-send";
import { cn } from "@/lib/utils";

/** The corner that points at the sender is tighter (a small tail). `rounded-ee` is the end side, `rounded-es` the start. */
const TAIL = { mine: "rounded-ee-[6px]", theirs: "rounded-es-[6px]" } as const;
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
        "relative block max-w-[80%] overflow-hidden rounded-window border bg-pressed",
        TAIL[side],
        side === "mine" ? "self-end" : "self-start",
        failed ? "border-error" : "border-border-subtle",
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
        "max-w-[80%] whitespace-pre-wrap break-words rounded-window px-md py-sm text-body",
        TAIL[side],
        side === "mine"
          ? "self-end bg-primary text-on-accent"
          : "self-start border border-border-subtle bg-background text-text-1",
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

/** A step of an order inside the chat: an icon, what happened, which order and item. A click says orders work in the app for now. */
function OrderDivider({
  event,
  orderId,
  payload,
  onAppOnly,
}: {
  event: string;
  orderId: string | null;
  payload: unknown;
  onAppOnly: () => void;
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
    "mx-auto flex w-full max-w-[420px] items-center gap-md rounded-control border border-border-subtle bg-surface px-md py-md";
  return (
    <div className="px-lg py-sm">
      {orderId ? (
        <button
          type="button"
          onClick={onAppOnly}
          aria-label={`${t(`chat.system.${event}`)}. ${t("chat.order.view")}`}
          className={cn(classes, "hover:bg-pressed")}
        >
          {content}
        </button>
      ) : (
        <div className={classes}>{content}</div>
      )}
    </div>
  );
}

const OFFER_ICON = {
  pending: Hourglass,
  accepted: Check,
  declined: X,
  countered: CornerUpLeft,
  withdrawn: Undo2,
  expired: Clock,
} as const;
const OFFER_VARIANT = {
  pending: "accent",
  accepted: "success",
  declined: "error",
  countered: "neutral",
  withdrawn: "neutral",
  expired: "neutral",
} as const;

/**
 * An offer in the chat: the price, the listed price struck through, the state, and the buttons that make sense for
 * this person right now. Answering offers comes to the website in a later step, so the buttons open the small
 * "works in the app for now" notice.
 */
function OfferBubble({
  offer,
  mine,
  role,
  closed,
  onAppOnly,
}: {
  offer: MessageOffer;
  mine: boolean;
  role: "buyer" | "seller";
  closed: boolean;
  onAppOnly: () => void;
}) {
  const { t, i18n } = useTranslation();
  // The server turns old offers into expired a little later. The bubble does not wait.
  const timedOut = new Date(offer.expiresAt).getTime() <= Date.now();
  const status =
    (offer.status === "pending" || offer.status === "accepted") && timedOut ? "expired" : offer.status;
  const lower = offer.amountMinor < offer.listingPriceMinor;
  const canAnswer = status === "pending" && !closed;
  const until = new Date(offer.expiresAt).toLocaleString(i18n.language, {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
  const small =
    "inline-flex h-9 items-center justify-center rounded-control px-md text-body-sm font-semibold";
  return (
    <div
      className={cn(
        "flex w-[78%] max-w-[340px] flex-col gap-sm rounded-window border border-border bg-surface px-md py-md",
        mine ? "self-end" : "self-start",
      )}
    >
      <span className="text-section-label font-semibold uppercase text-text-3">
        {mine ? t("offer.bubble.yours") : t("offer.bubble.theirs")}
      </span>
      <span className="flex items-baseline gap-sm">
        <span className="text-title font-bold text-primary">
          {formatPrice(offer.amountMinor, offer.currency)}
        </span>
        {lower ? (
          <span className="text-card-desc text-text-3 line-through">
            {formatPrice(offer.listingPriceMinor, offer.currency)}
          </span>
        ) : null}
      </span>
      <Badge
        className="self-start"
        variant={OFFER_VARIANT[status]}
        icon={OFFER_ICON[status]}
        label={
          status === "pending"
            ? t(`offer.bubble.pending_${mine ? "mine" : "theirs"}`)
            : t(`chat.offerStatus.${status}`)
        }
      />
      {status === "accepted" ? (
        <span className="text-card-desc text-text-2">
          {role === "buyer"
            ? t("offer.bubble.reservedForYou", { time: until })
            : t("offer.bubble.reservedForThem", { time: until })}
        </span>
      ) : null}
      {canAnswer && !mine ? (
        <div className="flex flex-col gap-sm pt-xs">
          <button
            type="button"
            onClick={onAppOnly}
            className={cn(small, "bg-primary text-on-accent hover:opacity-90")}
          >
            {t("offer.accept")}
          </button>
          <div className="flex gap-sm">
            <button
              type="button"
              onClick={onAppOnly}
              className={cn(small, "flex-1 border border-border text-text-1 hover:bg-pressed")}
            >
              {t("offer.decline")}
            </button>
            <button
              type="button"
              onClick={onAppOnly}
              className={cn(small, "flex-1 border border-border text-text-1 hover:bg-pressed")}
            >
              {t("offer.counter")}
            </button>
          </div>
        </div>
      ) : null}
      {canAnswer && mine ? (
        <button
          type="button"
          onClick={onAppOnly}
          className={cn(small, "mt-xs border border-border text-text-1 hover:bg-pressed")}
        >
          {t("offer.withdraw")}
        </button>
      ) : null}
      {status === "accepted" && role === "buyer" && !closed ? (
        <button
          type="button"
          onClick={onAppOnly}
          className={cn(small, "mt-xs bg-primary text-on-accent hover:opacity-90")}
        >
          {t("offer.buyNow", { amount: formatPrice(offer.amountMinor, offer.currency) })}
        </button>
      ) : null}
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
  offersClosed,
  onOpenPhoto,
  onAppOnly,
}: {
  message: Message;
  mine: boolean;
  tight: boolean;
  /** Small line under the bubble: the time, and Sent or Seen on your newest. */
  statusLine?: string;
  role: "buyer" | "seller";
  offersClosed: boolean;
  onOpenPhoto: (url: string) => void;
  onAppOnly: () => void;
}) {
  const { t } = useTranslation();
  const side: Side = mine ? "mine" : "theirs";

  if (message.kind === "system") {
    if (message.systemEvent && message.systemEvent in DIVIDER_STYLES) {
      return (
        <OrderDivider
          event={message.systemEvent}
          orderId={message.orderId}
          payload={message.payload}
          onAppOnly={onAppOnly}
        />
      );
    }
    return (
      <div className="flex justify-center px-xl py-sm">
        <span className="rounded-full bg-surface px-md py-xs text-center text-card-desc text-text-2">
          {systemText(message, t)}
        </span>
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
        mine={mine}
        role={role}
        closed={offersClosed}
        onAppOnly={onAppOnly}
      />
    ) : null;
  } else if (message.body) {
    body = <TextBubble body={message.body} side={side} />;
  }
  if (!body) return null;

  return (
    <div className={cn("flex flex-col px-lg", tight ? "pt-xs" : "pt-md")}>
      {body}
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
            "max-w-[80%] self-end whitespace-pre-wrap break-words rounded-window rounded-ee-[6px] bg-primary px-md py-sm text-body text-on-accent",
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

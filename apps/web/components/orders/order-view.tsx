"use client";

import { useQuery } from "@tanstack/react-query";
import { formatPrice, type OrderDetail, type ReviewItem } from "@vinty/shared";
import { ChevronLeft, Loader2, MessageCircle, Star } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { EmptyState } from "@/components/empty-state";
import { AddressLines, ItemThumb, OrderStatusBadge } from "@/components/orders/order-parts";
import { useOrderSteps } from "@/components/orders/order-steps";
import { OrderTimeline } from "@/components/orders/order-timeline";
import { ReplyDialog, ReviewDialog } from "@/components/review/review-dialogs";
import { SellerAvatar } from "@/components/seller-avatar";
import { StarRating } from "@/components/star-rating";
import { ApiClientError } from "@/lib/api-error";
import { orderQuery } from "@/lib/order-flow-queries";
import { formatDate } from "@/lib/time";
import { cn } from "@/lib/utils";

const panel = "flex flex-col gap-md";
const heading = "text-section-label font-bold uppercase text-text-3";

function MoneyRow({
  label,
  amount,
  currency,
  strong,
  negative,
}: {
  label: string;
  amount: number;
  currency: string;
  strong?: boolean;
  negative?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-md">
      <dt className={strong ? "text-body font-bold text-text-1" : "text-body text-text-2"}>{label}</dt>
      <dd className={strong ? "text-body font-bold text-text-1" : "text-body font-medium text-text-1"}>
        {negative ? "-" : ""}
        {formatPrice(amount, currency)}
      </dd>
    </div>
  );
}

/** A review shown on the order: stars, the words, and the reply if there is one. `onReply` adds the Reply button. */
function ReviewCard({ title, review, onReply }: { title: string; review: ReviewItem; onReply?: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-sm rounded-control border border-border-subtle p-md">
      <span className="text-body-sm font-semibold text-text-1">{title}</span>
      <span className="flex items-center gap-sm">
        <StarRating rating={review.rating} size={16} label={t("review.stars", { count: review.rating })} />
        {review.isAutomatic ? (
          <span className="text-card-meta text-text-3">{t("profile.automatic")}</span>
        ) : null}
      </span>
      {review.comment ? <p className="text-body-sm text-text-1">{review.comment}</p> : null}
      {review.replyBody ? (
        <div className="rounded-control bg-surface p-md">
          <p className="mb-xs text-card-meta font-semibold text-text-2">{t("profile.reply")}</p>
          <p className="text-body-sm text-text-1">{review.replyBody}</p>
        </div>
      ) : null}
      {onReply && !review.isAutomatic ? (
        <button
          type="button"
          onClick={onReply}
          className="inline-flex h-10 items-center self-start rounded-control border border-border px-md text-body-sm font-semibold text-text-1 hover:bg-pressed"
        >
          {review.replyBody ? t("review.editReply") : t("review.reply")}
        </button>
      ) : null}
    </div>
  );
}

/**
 * One order: what is in it, who with, where it stands, the money, and the buttons that make sense right now (the
 * server says which in `actions`). It reads the order again when the live `order:updated` event arrives.
 */
export function OrderView({ lang, id, placed }: { lang: string; id: string; placed: boolean }) {
  const { t, i18n } = useTranslation();
  const query = useQuery(orderQuery(id));
  const order = query.data;
  const steps = useOrderSteps({ id, role: order?.role ?? "buyer" });
  const [reviewing, setReviewing] = useState(false);
  const [replyTarget, setReplyTarget] = useState<ReviewItem | null>(null);

  if (!order) {
    const notFound = query.error instanceof ApiClientError && query.error.status === 404;
    return (
      <main className="mx-auto w-full max-w-[1000px] px-lg pb-2xl pt-xl md:px-xl">
        {query.isPending ? (
          <div className="flex justify-center py-2xl" role="status" aria-label={t("web.inbox.loading")}>
            <Loader2 size={28} className="animate-spin text-text-3 motion-reduce:animate-none" aria-hidden />
          </div>
        ) : notFound ? (
          <EmptyState title={t("orders.notFound")} message={t("orders.notFoundNote")} />
        ) : (
          <EmptyState
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
        )}
      </main>
    );
  }

  const isSeller = order.role === "seller";
  const other = isSeller ? order.buyer : order.seller;
  const otherName = other.username ?? t("profile.closedAccount");
  const has = (a: OrderDetail["actions"][number]) => order.actions.includes(a);
  const addr = order.shippingAddress;
  const button =
    "inline-flex h-12 w-full items-center justify-center rounded-control px-lg text-body font-semibold disabled:opacity-60";

  const actions = (className: string) => (
    <section className={cn("flex flex-col gap-sm", className)}>
      {has("pay") ? (
        <Link
          href={`/${lang}/checkout?order=${order.id}`}
          className={cn(button, "bg-primary text-on-accent hover:opacity-90")}
        >
          {t("orders.pay")}
        </Link>
      ) : null}
      {has("ship") ? (
        <button
          type="button"
          disabled={steps.pending}
          onClick={() => steps.ask("ship")}
          className={cn(button, "bg-primary text-on-accent hover:opacity-90")}
        >
          {t("orders.ship")}
        </button>
      ) : null}
      {has("confirm_received") ? (
        <button
          type="button"
          disabled={steps.pending}
          onClick={() => steps.ask("confirm-received")}
          className={cn(button, "bg-primary text-on-accent hover:opacity-90")}
        >
          {t("orders.received")}
        </button>
      ) : null}
      {has("open_dispute") ? (
        <button
          type="button"
          disabled={steps.pending}
          onClick={() => steps.ask("dispute")}
          className={cn(button, "border border-border text-text-1 hover:bg-pressed")}
        >
          {t("orders.dispute")}
        </button>
      ) : null}
      {has("cancel") ? (
        <button
          type="button"
          disabled={steps.pending}
          onClick={() => steps.ask("cancel")}
          className={cn(button, "text-error hover:bg-pressed")}
        >
          {t("orders.cancel")}
        </button>
      ) : null}
    </section>
  );

  return (
    <main className="mx-auto w-full max-w-[1000px] px-lg pb-2xl pt-lg md:px-xl">
      <Link
        href={`/${lang}/orders`}
        className="mb-md inline-flex h-10 items-center gap-xs text-body-sm font-semibold text-primary hover:underline"
      >
        <ChevronLeft size={18} aria-hidden className="rtl:-scale-x-100" />
        {t("orders.title")}
      </Link>

      <div className="grid gap-2xl md:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex flex-col gap-xl">
          <header className="flex flex-col gap-sm">
            <h1 className="text-title font-bold text-text-1">
              {t("orders.orderNumber", { number: order.orderNumber })}
            </h1>
            <div className="flex">
              <OrderStatusBadge status={order.status} role={order.role} />
            </div>
            <p className="text-heading font-semibold text-text-1">
              {t(`orders.next.${order.status}.${order.role}`)}
            </p>
            <p className="text-subtitle text-text-3">
              {t(`orders.nextNote.${order.status}.${order.role}`, { name: otherName })}
            </p>
            {order.payByAt && order.status === "pending_payment" ? (
              <p className="text-body-sm font-semibold text-warning">
                {t("orders.payBy", {
                  time: new Date(order.payByAt).toLocaleTimeString(i18n.language, {
                    hour: "numeric",
                    minute: "2-digit",
                  }),
                })}
              </p>
            ) : null}
          </header>

          {actions("md:hidden")}
          {placed && order.status === "paid" ? (
            <div role="status" className="rounded-control bg-success-tint px-md py-md">
              <p className="text-body font-semibold text-success">{t("checkout.done.title")}</p>
              <p className="mt-xs text-body-sm text-text-1">
                {t("checkout.done.note", { seller: order.seller.username ?? t("profile.closedAccount") })}
              </p>
              <p className="mt-xs text-body-sm text-text-2">{t("checkout.simulatedDone")}</p>
            </div>
          ) : null}
          <p className="rounded-control bg-accent-tint px-md py-md text-body-sm text-text-1">
            {t("orders.pretendNote")}
          </p>
          {steps.errorKey ? (
            <p role="alert" className="rounded-control bg-error-tint px-md py-md text-body-sm text-error">
              {t(steps.errorKey)}
            </p>
          ) : null}

          <section className={panel}>
            <h2 className={heading}>{t("orders.progress")}</h2>
            <OrderTimeline order={order} />
          </section>

          <section className={panel}>
            <h2 className={heading}>{t("orders.items", { count: order.items.length })}</h2>
            {order.items.map((line) => {
              const content = (
                <>
                  <ItemThumb url={line.photoUrl} />
                  <span className="flex min-w-0 flex-1 flex-col gap-xs text-start">
                    <span className="line-clamp-2 text-body font-semibold text-text-1">{line.title}</span>
                    <span className="truncate text-card-meta text-text-3">
                      {[line.brand, line.size].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                  <span className="text-body font-semibold text-text-1">
                    {formatPrice(line.priceMinor, order.currency)}
                  </span>
                </>
              );
              return line.listingId ? (
                <Link
                  key={line.listingId}
                  href={`/${lang}/item/${line.listingId}`}
                  className="flex items-center gap-md hover:opacity-80"
                >
                  {content}
                </Link>
              ) : (
                <div key={line.title} className="flex items-center gap-md">
                  {content}
                </div>
              );
            })}
          </section>

          <section className={panel}>
            <h2 className={heading}>{t("orders.delivery")}</h2>
            <p className="text-body font-semibold text-text-1">
              {t(`orders.deliveryMethod.${order.deliveryMethod}`)}
            </p>
            {addr ? (
              <div className="flex flex-col gap-xs">
                <AddressLines address={addr} />
                <span className="text-body-sm text-text-2">
                  {t(`countries.${addr.countryCode}`, { defaultValue: addr.countryCode })}
                </span>
              </div>
            ) : (
              <p className="text-body-sm text-text-3">{t("orders.noAddress")}</p>
            )}
            {order.shipment?.trackingCode ? (
              <div className="flex flex-col gap-xs rounded-control bg-surface p-md">
                <span className="text-card-meta text-text-3">{t("orders.tracking")}</span>
                <span className="select-text text-body font-bold text-text-1">
                  {order.shipment.trackingCode}
                </span>
                {order.shipment.simulated ? (
                  <span className="text-card-meta text-text-3">{t("orders.pretendParcel")}</span>
                ) : null}
              </div>
            ) : null}
          </section>

          {order.canReview || order.reviews.mine || order.reviews.theirs ? (
            <section className={panel}>
              <h2 className={heading}>{t("orders.feedback")}</h2>
              {order.canReview ? (
                <div className="flex flex-col gap-md rounded-control bg-accent-tint p-md">
                  <p className="text-body font-semibold text-text-1">
                    {t("review.prompt", { name: otherName })}
                  </p>
                  <button
                    type="button"
                    onClick={() => setReviewing(true)}
                    className={cn(button, "gap-sm bg-primary text-on-accent hover:opacity-90")}
                  >
                    <Star size={18} aria-hidden />
                    {t("review.leave")}
                  </button>
                </div>
              ) : null}
              {order.reviews.mine ? (
                <ReviewCard title={t("review.yours")} review={order.reviews.mine} />
              ) : null}
              {order.reviews.theirs ? (
                <ReviewCard
                  title={t("review.theirs", { name: otherName })}
                  review={order.reviews.theirs}
                  onReply={() => setReplyTarget(order.reviews.theirs)}
                />
              ) : null}
            </section>
          ) : null}

          <p className="text-card-meta text-text-3">
            {t("orders.placedOn", {
              date: formatDate(order.createdAt, i18n.language),
              number: order.orderNumber,
            })}
          </p>
        </div>

        <aside className="flex flex-col gap-xl md:sticky md:top-28 md:self-start">
          {actions("max-md:hidden")}

          <section className={panel}>
            <h2 className={heading}>{isSeller ? t("orders.buyer") : t("orders.seller")}</h2>
            {other.username ? (
              <Link
                href={`/${lang}/seller/${other.id}`}
                aria-label={t("orders.openProfile", { name: otherName })}
                className="flex items-center gap-md hover:opacity-80"
              >
                <SellerAvatar url={other.avatarUrl} name={otherName} size={44} />
                <span className="min-w-0 flex-1 truncate text-body font-semibold text-text-1">
                  {otherName}
                </span>
              </Link>
            ) : (
              <span className="flex items-center gap-md">
                <SellerAvatar url={other.avatarUrl} name={otherName} size={44} />
                <span className="min-w-0 flex-1 truncate text-body font-semibold text-text-1">
                  {otherName}
                </span>
              </span>
            )}
            {order.conversationId ? (
              <Link
                href={`/${lang}/inbox/${order.conversationId}`}
                className="inline-flex h-11 items-center justify-center gap-sm rounded-control border border-border px-lg text-body-sm font-semibold text-text-1 hover:bg-pressed"
              >
                <MessageCircle size={18} className="text-primary" aria-hidden />
                {t("orders.message", { name: otherName })}
              </Link>
            ) : null}
          </section>

          <section className={panel}>
            <h2 className={heading}>{t("orders.price")}</h2>
            <dl className="flex flex-col gap-sm">
              <MoneyRow
                label={t("orders.itemsSubtotal")}
                amount={order.itemsSubtotalMinor}
                currency={order.currency}
              />
              {order.bundleDiscountMinor > 0 ? (
                <MoneyRow
                  label={t("orders.bundleDiscount")}
                  amount={order.bundleDiscountMinor}
                  currency={order.currency}
                  negative
                />
              ) : null}
              {!isSeller ? (
                <>
                  <MoneyRow
                    label={t("orders.protection")}
                    amount={order.buyerProtectionFeeMinor}
                    currency={order.currency}
                  />
                  <MoneyRow
                    label={t("orders.shipping")}
                    amount={order.shippingMinor}
                    currency={order.currency}
                  />
                  {order.voucherDiscountMinor > 0 ? (
                    <MoneyRow
                      label={t("orders.voucher")}
                      amount={order.voucherDiscountMinor}
                      currency={order.currency}
                      negative
                    />
                  ) : null}
                </>
              ) : null}
              <div className="border-t border-border-subtle pt-sm">
                {isSeller && order.sellerEarningsMinor !== null ? (
                  <MoneyRow
                    strong
                    label={t("orders.youEarn")}
                    amount={order.sellerEarningsMinor}
                    currency={order.currency}
                  />
                ) : (
                  <MoneyRow
                    strong
                    label={t("orders.total")}
                    amount={order.totalMinor}
                    currency={order.currency}
                  />
                )}
              </div>
            </dl>
            {!isSeller ? <p className="text-card-meta text-text-3">{t("orders.protectionNote")}</p> : null}
          </section>
        </aside>
      </div>
      {steps.dialog}
      <ReviewDialog
        open={reviewing}
        orderId={order.id}
        otherName={otherName}
        onClose={() => setReviewing(false)}
      />
      <ReplyDialog review={replyTarget} onClose={() => setReplyTarget(null)} />
    </main>
  );
}

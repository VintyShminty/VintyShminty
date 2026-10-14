"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { formatPrice, isolate, type OrderRow } from "@vinty/shared";
import { Check, ChevronRight, Loader2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Chip } from "@/components/chip";
import { EmptyState } from "@/components/empty-state";
import { ItemThumb, OrderStatusBadge } from "@/components/orders/order-parts";
import { type OrdersFilter, type OrdersRole, ordersQuery } from "@/lib/order-flow-queries";
import { formatDate } from "@/lib/time";
import { useLoadMore } from "@/lib/use-load-more";
import { cn } from "@/lib/utils";

const FILTERS: OrdersFilter[] = ["all", "in_progress", "completed", "cancelled"];

/** One line of My orders: photo with a green tick when complete, the item, the other person, the money and the status. */
function Row({ order, lang }: { order: OrderRow; lang: string }) {
  const { t, i18n } = useTranslation();
  const isSeller = order.role === "seller";
  const amount =
    isSeller && order.sellerEarningsMinor !== null ? order.sellerEarningsMinor : order.totalMinor;
  const title =
    order.itemCount > 1
      ? t("orders.moreItems", {
          title: isolate(order.title, i18n.language === "he"),
          count: order.itemCount - 1,
        })
      : order.title;
  const who = order.otherUser.username ?? t("profile.closedAccount");
  return (
    <Link
      href={`/${lang}/orders/${order.id}`}
      aria-label={`${title}, ${t(`orders.status.${order.status}.${order.role}`)}`}
      className="flex items-center gap-md border-b border-border-subtle px-md py-md hover:bg-surface"
    >
      <span className="relative shrink-0">
        <ItemThumb url={order.photoUrl} />
        {order.status === "completed" ? (
          <span className="absolute -end-xs -top-xs flex h-5 w-5 items-center justify-center rounded-full bg-success">
            <Check size={12} strokeWidth={3} className="text-on-accent" aria-hidden />
          </span>
        ) : null}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-xs text-start">
        <span className="truncate text-body font-semibold text-text-1">{title}</span>
        <span className="truncate text-card-meta text-text-3">
          {t(isSeller ? "orders.soldTo" : "orders.boughtFrom", { name: who })}
        </span>
        <span className="truncate text-card-meta text-text-3">
          {formatDate(order.createdAt, i18n.language)}
        </span>
        <span className="flex">
          <OrderStatusBadge status={order.status} role={order.role} />
        </span>
      </span>
      <span className="flex flex-col items-end gap-xs">
        <span className="text-body font-bold text-text-1">{formatPrice(amount, order.currency)}</span>
        {isSeller ? <span className="text-card-meta text-text-3">{t("orders.youEarn")}</span> : null}
      </span>
      <ChevronRight size={18} className="shrink-0 text-text-3 rtl:rotate-180" aria-hidden />
    </Link>
  );
}

/** My orders: what I bought and what I sold, filtered by how far along they are. An endless list. */
export function OrdersList({ lang }: { lang: string }) {
  const { t } = useTranslation();
  const [role, setRole] = useState<OrdersRole>("bought");
  const [filter, setFilter] = useState<OrdersFilter>("all");
  const query = useInfiniteQuery(ordersQuery(role, filter));
  const rows = query.data?.pages.flatMap((p) => p.items) ?? [];
  const more = useLoadMore(
    Boolean(query.hasNextPage),
    query.isFetchingNextPage,
    () => void query.fetchNextPage(),
  );

  return (
    <main className="mx-auto w-full max-w-[760px] px-lg pb-2xl pt-xl md:px-xl">
      <h1 className="text-title font-bold text-text-1">{t("orders.title")}</h1>
      <div role="tablist" aria-label={t("orders.title")} className="mt-lg flex border-b border-border">
        {(["bought", "sold"] as const).map((key) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={role === key}
            onClick={() => setRole(key)}
            className={cn(
              "-mb-px h-11 flex-1 border-b-2 text-body font-semibold",
              role === key
                ? "border-primary text-primary"
                : "border-transparent text-text-3 hover:text-text-1",
            )}
          >
            {t(`orders.${key}`)}
          </button>
        ))}
      </div>
      <div className="flex gap-sm overflow-x-auto py-md">
        {FILTERS.map((key) => (
          <Chip
            key={key}
            label={t(`orders.filter.${key}`)}
            selected={filter === key}
            onClick={() => setFilter(key)}
          />
        ))}
      </div>

      {query.isPending ? (
        <div className="flex justify-center py-2xl" role="status" aria-label={t("web.inbox.loading")}>
          <Loader2 size={28} className="animate-spin text-text-3 motion-reduce:animate-none" aria-hidden />
        </div>
      ) : query.isError && rows.length === 0 ? (
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
      ) : rows.length === 0 ? (
        <EmptyState
          title={t(`orders.empty.${role}.${filter}.title`)}
          message={t(`orders.empty.${role}.${filter}.note`)}
        />
      ) : (
        <div>
          {rows.map((order) => (
            <Row key={order.id} order={order} lang={lang} />
          ))}
          <div ref={more} aria-hidden className="flex h-10 items-center justify-center">
            {query.isFetchingNextPage ? (
              <Loader2
                size={18}
                className="animate-spin text-text-3 motion-reduce:animate-none"
                aria-hidden
              />
            ) : null}
          </div>
        </div>
      )}
    </main>
  );
}

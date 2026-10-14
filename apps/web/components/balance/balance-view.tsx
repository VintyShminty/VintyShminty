"use client";

import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { type BalanceEntry, formatPrice } from "@vinty/shared";
import { ChevronRight, Clock, Landmark, Loader2, ShoppingBag, XCircle } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { WithdrawDialog } from "@/components/balance/withdraw-dialog";
import { EmptyState } from "@/components/empty-state";
import { balanceEntriesQuery, balanceQuery } from "@/lib/order-flow-queries";
import { formatDay } from "@/lib/time";
import { useLoadMore } from "@/lib/use-load-more";
import { cn } from "@/lib/utils";

function Retry({ onRetry }: { onRetry: () => void }) {
  const { t } = useTranslation();
  return (
    <EmptyState
      title={t("errors.general")}
      action={
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex h-11 items-center rounded-control border border-border px-lg text-body-sm font-semibold text-text-1 hover:bg-pressed"
        >
          {t("common.tryAgain")}
        </button>
      }
    />
  );
}

/** One move of the balance: what it was, the order it belongs to, the date, a Pending or Cancelled note, the amount. */
function EntryRow({ entry, lang }: { entry: BalanceEntry; lang: string }) {
  const { t, i18n } = useTranslation();
  const label = t(`balance.entry.${entry.type}`);
  const void_ = entry.status === "void";
  const body = (
    <>
      <span className="flex min-w-0 flex-1 flex-col gap-xs text-start">
        <span className={cn("text-body font-semibold", void_ ? "text-text-4 line-through" : "text-text-1")}>
          {label}
        </span>
        <span className="text-card-meta text-text-3">
          {[
            entry.orderNumber !== null ? t("orders.orderNumber", { number: entry.orderNumber }) : null,
            formatDay(entry.createdAt, i18n.language),
          ]
            .filter(Boolean)
            .join(" · ")}
        </span>
        {entry.status === "pending" ? (
          <span className="inline-flex items-center gap-xs self-start rounded-full bg-warning-tint px-sm py-px text-badge font-semibold text-warning">
            <Clock size={12} aria-hidden />
            {t("balance.pending")}
          </span>
        ) : void_ ? (
          <span className="inline-flex items-center gap-xs self-start rounded-full bg-error-tint px-sm py-px text-badge font-semibold text-error">
            <XCircle size={12} aria-hidden />
            {t("balance.void")}
          </span>
        ) : null}
      </span>
      <span
        className={cn(
          "text-body font-bold",
          void_ ? "text-text-4 line-through" : entry.amountMinor < 0 ? "text-text-1" : "text-success",
        )}
      >
        {entry.amountMinor > 0 ? "+" : entry.amountMinor < 0 ? "-" : ""}
        {formatPrice(Math.abs(entry.amountMinor), entry.currency)}
      </span>
      {entry.orderId ? (
        <ChevronRight size={18} className="shrink-0 text-text-3 rtl:rotate-180" aria-hidden />
      ) : null}
    </>
  );
  const row = "flex items-center gap-md border-b border-border-subtle px-md py-md";
  return entry.orderId ? (
    <li>
      <Link href={`/${lang}/orders/${entry.orderId}`} className={cn(row, "hover:bg-surface")}>
        {body}
      </Link>
    </li>
  ) : (
    <li className={row}>{body}</li>
  );
}

/** Balance: what you can withdraw, what is still waiting for a delivery, and every move, newest first by month. */
export function BalanceView({ lang }: { lang: string }) {
  const { t, i18n } = useTranslation();
  const balance = useQuery(balanceQuery());
  const entries = useInfiniteQuery(balanceEntriesQuery());
  const [withdrawing, setWithdrawing] = useState(false);
  const rows = entries.data?.pages.flatMap((p) => p.items) ?? [];
  const more = useLoadMore(
    Boolean(entries.hasNextPage),
    entries.isFetchingNextPage,
    () => void entries.fetchNextPage(),
  );
  const sections: { month: string; data: BalanceEntry[] }[] = [];
  for (const row of rows) {
    const last = sections[sections.length - 1];
    if (last?.month === row.month) last.data.push(row);
    else sections.push({ month: row.month, data: [row] });
  }
  const b = balance.data;

  const monthLabel = (month: string) => {
    const [y, m] = month.split("-").map(Number);
    return new Date(Date.UTC(y as number, (m as number) - 1, 1)).toLocaleDateString(i18n.language, {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    });
  };

  const spinner = (
    <div className="flex justify-center py-2xl" role="status" aria-label={t("web.inbox.loading")}>
      <Loader2 size={28} className="animate-spin text-text-3 motion-reduce:animate-none" aria-hidden />
    </div>
  );

  return (
    <main className="mx-auto w-full max-w-[760px] px-lg pb-2xl pt-xl md:px-xl">
      <h1 className="text-title font-bold text-text-1">{t("balance.title")}</h1>

      <section className="mt-lg flex flex-col items-center gap-lg">
        {balance.isError && !b ? (
          <Retry onRetry={() => void balance.refetch()} />
        ) : !b ? (
          spinner
        ) : (
          <>
            <div className="flex flex-col items-center gap-xs">
              <span className="text-card-meta text-text-3">{t("balance.available")}</span>
              <span className="text-display font-bold text-text-1">
                {formatPrice(b.available, b.currency)}
              </span>
              <span className="text-body-sm text-text-3">
                {t("balance.pendingLine", { amount: formatPrice(b.pending, b.currency) })}
              </span>
            </div>
            <div className="flex gap-md">
              <button
                type="button"
                disabled={b.available <= 0}
                onClick={() => setWithdrawing(true)}
                className="inline-flex h-12 items-center justify-center gap-sm rounded-control bg-primary px-xl text-body font-semibold text-on-accent hover:opacity-90 disabled:opacity-40"
              >
                <Landmark size={18} aria-hidden />
                {t("balance.withdraw")}
              </button>
              <Link
                href={`/${lang}`}
                className="inline-flex h-12 items-center justify-center gap-sm rounded-control border border-border px-xl text-body font-semibold text-text-1 hover:bg-pressed"
              >
                <ShoppingBag size={18} aria-hidden />
                {t("balance.shop")}
              </Link>
            </div>
            <p className="self-stretch rounded-control bg-accent-tint px-md py-md text-body-sm text-text-1">
              {t("balance.pretendNote")}
            </p>
          </>
        )}
      </section>

      {entries.isPending ? (
        spinner
      ) : entries.isError && rows.length === 0 ? (
        <Retry onRetry={() => void entries.refetch()} />
      ) : rows.length === 0 ? (
        <EmptyState title={t("balance.emptyTitle")} message={t("balance.emptyNote")} />
      ) : (
        <div>
          {sections.map((section) => (
            <section key={section.month} aria-labelledby={`month-${section.month}`}>
              <h2
                id={`month-${section.month}`}
                className="px-md pb-sm pt-xl text-section-label font-bold uppercase text-text-3"
              >
                {monthLabel(section.month)}
              </h2>
              <ul>
                {section.data.map((entry) => (
                  <EntryRow key={entry.id} entry={entry} lang={lang} />
                ))}
              </ul>
            </section>
          ))}
          <div ref={more} aria-hidden className="flex h-10 items-center justify-center">
            {entries.isFetchingNextPage ? (
              <Loader2
                size={18}
                className="animate-spin text-text-3 motion-reduce:animate-none"
                aria-hidden
              />
            ) : null}
          </div>
        </div>
      )}

      <WithdrawDialog
        open={withdrawing}
        availableMinor={b?.available ?? 0}
        currency={b?.currency ?? "ILS"}
        onClose={() => setWithdrawing(false)}
      />
    </main>
  );
}

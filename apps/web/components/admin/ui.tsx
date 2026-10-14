"use client";

import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

export function PageTitle({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="mb-xl flex flex-wrap items-center justify-between gap-md">
      <h1 className="text-title font-bold text-text-1">{title}</h1>
      {children}
    </div>
  );
}

export function Card({
  title,
  children,
  className,
}: {
  title?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("rounded-window border border-border bg-surface p-lg", className)}>
      {title ? <h2 className="mb-md text-heading font-bold text-text-1">{title}</h2> : null}
      {children}
    </section>
  );
}

export function StatCard({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="rounded-window border border-border bg-surface p-lg">
      <p className="text-section-label font-semibold uppercase text-text-3">{label}</p>
      <p className="mt-xs text-item-name font-bold text-text-1">{value}</p>
      {note ? <p className="mt-xs text-card-meta text-text-3">{note}</p> : null}
    </div>
  );
}

/** Shown while the first answer is on its way. Reloads later keep the old numbers on screen instead. */
export function Loading() {
  const { t } = useTranslation();
  return (
    <p role="status" className="py-2xl text-center text-body-sm text-text-3">
      {t("admin.loading")}
    </p>
  );
}

export function LoadFailed({ onRetry }: { onRetry: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col items-center gap-sm py-2xl text-center">
      <p className="text-heading font-semibold text-text-1">{t("errors.general")}</p>
      <button
        type="button"
        onClick={onRetry}
        className="inline-flex h-11 items-center rounded-control border border-border px-lg text-body-sm font-semibold text-text-1 hover:bg-pressed"
      >
        {t("common.tryAgain")}
      </button>
    </div>
  );
}

/** Loading, failed or the page itself: the same three states on every admin page. */
export function QueryState<T>({
  query,
  children,
}: {
  query: { data: T | undefined; isError: boolean; refetch: () => unknown };
  children: (data: T) => ReactNode;
}) {
  if (query.data !== undefined) return <>{children(query.data)}</>;
  if (query.isError) return <LoadFailed onRetry={() => void query.refetch()} />;
  return <Loading />;
}

export const buttonClass =
  "inline-flex h-10 items-center justify-center rounded-control px-lg text-body-sm font-semibold disabled:opacity-60";
export const primaryButton = cn(buttonClass, "bg-primary text-on-accent hover:opacity-90");
export const quietButton = cn(buttonClass, "border border-border text-text-1 hover:bg-pressed");
export const inputClass =
  "h-10 rounded-control border border-border bg-background px-md text-body-sm text-text-1 focus:border-primary focus:outline-none";

/** A table that scrolls sideways on a phone instead of squeezing. */
export function DataTable({ head, children }: { head: ReactNode[]; children: ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[520px] border-collapse text-body-sm">
        <thead>
          <tr className="border-b border-border text-text-3">
            {head.map((cell, i) => (
              <th
                // biome-ignore lint/suspicious/noArrayIndexKey: fixed header cells never reorder
                key={i}
                scope="col"
                className={cn("px-sm py-sm font-semibold", i === 0 ? "text-start" : "text-end")}
              >
                {cell}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export const cellClass = "px-sm py-sm text-end tabular-nums text-text-1";
export const firstCellClass = "px-sm py-sm text-start text-text-1";

/** Bars made of plain boxes. Every bar has its number written next to it, and a label for screen readers. */
export function BarColumns({
  rows,
  label,
}: {
  rows: { label: string; value: number; text: string }[];
  label: string;
}) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul aria-label={label} className="flex h-44 items-end gap-xs sm:gap-sm">
      {rows.map((row) => (
        <li
          key={row.label}
          aria-label={`${row.label}: ${row.text}`}
          className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-xs"
        >
          <span className="text-card-meta font-semibold text-text-1">{row.text}</span>
          <span
            aria-hidden
            className="w-full rounded-t-control bg-primary"
            style={{ height: `${Math.max(2, (row.value / max) * 100)}%`, maxHeight: "calc(100% - 40px)" }}
          />
          <span aria-hidden className="w-full truncate text-center text-card-meta text-text-3">
            {row.label}
          </span>
        </li>
      ))}
    </ul>
  );
}

/** A sideways bar with a written value, for "this one against that one". */
export function MeterBar({
  ratio,
  tone = "primary",
}: {
  ratio: number;
  tone?: "primary" | "warning" | "error";
}) {
  const pct = Math.min(100, Math.max(0, ratio * 100));
  return (
    <div aria-hidden className="h-3 w-full overflow-hidden rounded-full bg-pressed">
      <div
        className={cn(
          "h-full rounded-full",
          tone === "error" ? "bg-error" : tone === "warning" ? "bg-warning" : "bg-primary",
        )}
        style={{ width: `${Math.max(pct > 0 ? 2 : 0, pct)}%` }}
      />
    </div>
  );
}

"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  type AdminExpenses,
  adminExpensesSchema,
  type ExpenseCurrency,
  type ExpenseKind,
  type FixedCostInput,
  formatMoney,
} from "@vinty/shared";
import { ChevronLeft, ChevronRight, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useToast } from "@/components/admin/toast";
import {
  Card,
  cellClass,
  DataTable,
  firstCellClass,
  inputClass,
  PageTitle,
  primaryButton,
  QueryState,
  quietButton,
} from "@/components/admin/ui";
import {
  aiActionName,
  formatCount,
  formatIls,
  formatUsd,
  monthLabel,
  monthOf,
  parseMinor,
  providerName,
  shiftMonth,
  usdMicrosToIlsMinor,
} from "@/lib/admin-format";
import { adminKeys } from "@/lib/admin-keys";
import { adminErrorText, useAdminExpenses } from "@/lib/admin-queries";
import { clientApi } from "@/lib/api-client";
import { cn } from "@/lib/utils";

type Draft = { name: string; amount: string; currency: ExpenseCurrency; kind: ExpenseKind };

const toDraft = (row: AdminExpenses["fixed"][number]): Draft => ({
  name: row.name,
  amount: (row.amountMinor / 100).toFixed(2),
  currency: row.currency,
  kind: row.kind,
});

function Tag({ kind }: { kind: "subscription" | "auto" | "configured" }) {
  const { t } = useTranslation();
  return (
    <span
      className={cn(
        "rounded-full px-sm py-px text-badge font-semibold",
        kind === "auto" ? "bg-accent-tint text-text-2" : "bg-chip-selected text-on-chip",
      )}
    >
      {t(`admin.expenses.kind.${kind}`)}
    </span>
  );
}

/** The editable list of fixed costs, the dollar rate and the three save buttons. */
function CostEditor({ data }: { data: AdminExpenses }) {
  const { t } = useTranslation();
  const toast = useToast();
  const client = useQueryClient();
  const [rows, setRows] = useState<Draft[]>(() => data.fixed.map(toDraft));
  const [rate, setRate] = useState(String(data.usdToIlsRate));
  const [problem, setProblem] = useState<string | null>(null);

  const done = (saved: AdminExpenses, messageKey: string) => {
    client.setQueryData(adminKeys.expenses(saved.month), saved);
    // Other months may use the defaults that just changed.
    void client.invalidateQueries({ queryKey: adminKeys.expensesAll });
    void client.invalidateQueries({ queryKey: adminKeys.dashboard });
    toast(t(messageKey));
  };
  const fail = (error: unknown) => toast(adminErrorText(error, t), "error");

  /** The rows as the server wants them, or null (with a message on screen) when a row is not filled in right. */
  const collect = (): FixedCostInput[] | null => {
    const out: FixedCostInput[] = [];
    for (const row of rows) {
      const amountMinor = parseMinor(row.amount);
      if (!row.name.trim() || amountMinor === null) {
        setProblem(t("admin.expenses.fixRows"));
        return null;
      }
      out.push({ name: row.name.trim(), amountMinor, currency: row.currency, kind: row.kind });
    }
    setProblem(null);
    return out;
  };
  const parsedRate = Number(rate.replace(",", "."));

  const saveMonth = useMutation({
    mutationFn: (fixedCosts: FixedCostInput[]) =>
      clientApi(`/v1/admin/expenses/months/${data.month}`, {
        method: "PUT",
        body: { fixedCosts },
        schema: adminExpensesSchema,
      }),
    onSuccess: (saved) => done(saved, "admin.expenses.savedMonth"),
    onError: fail,
  });
  const clearMonth = useMutation({
    mutationFn: () =>
      clientApi(`/v1/admin/expenses/months/${data.month}`, { method: "DELETE", schema: adminExpensesSchema }),
    onSuccess: (saved) => done(saved, "admin.expenses.clearedMonth"),
    onError: fail,
  });
  const saveDefaults = useMutation({
    mutationFn: (fixedCosts: FixedCostInput[]) =>
      clientApi("/v1/admin/expenses/config", {
        method: "PUT",
        body: { fixedCosts, usdToIlsRate: parsedRate },
        schema: adminExpensesSchema,
      }),
    onSuccess: (saved) => done(saved, "admin.expenses.savedDefaults"),
    onError: fail,
  });
  const busy = saveMonth.isPending || clearMonth.isPending || saveDefaults.isPending;

  const update = (index: number, patch: Partial<Draft>) =>
    setRows((list) => list.map((row, i) => (i === index ? { ...row, ...patch } : row)));

  const onSaveMonth = () => {
    const list = collect();
    if (list) saveMonth.mutate(list);
  };
  const onSaveDefaults = () => {
    if (!Number.isFinite(parsedRate) || parsedRate < 0.1 || parsedRate > 100) {
      setProblem(t("admin.expenses.fixRate"));
      return;
    }
    const list = collect();
    if (list) saveDefaults.mutate(list);
  };

  return (
    <Card title={t("admin.expenses.editTitle")}>
      <p className="mb-md text-body-sm text-text-3">
        {data.usesOverride ? t("admin.expenses.usesOwn") : t("admin.expenses.usesDefaults")}
      </p>
      <ul className="flex flex-col gap-sm">
        {rows.map((row, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: rows have no id and are edited in place
          <li key={i} className="grid grid-cols-2 gap-sm md:grid-cols-[1fr_7rem_5.5rem_9rem_auto]">
            <input
              aria-label={t("admin.expenses.name")}
              placeholder={t("admin.expenses.name")}
              value={row.name}
              maxLength={80}
              onChange={(e) => update(i, { name: e.target.value })}
              className={cn(inputClass, "col-span-2 md:col-span-1")}
            />
            <input
              aria-label={t("admin.expenses.amount")}
              placeholder={t("admin.expenses.amount")}
              inputMode="decimal"
              value={row.amount}
              onChange={(e) => update(i, { amount: e.target.value })}
              className={inputClass}
            />
            <select
              aria-label={t("admin.expenses.currency")}
              value={row.currency}
              onChange={(e) => update(i, { currency: e.target.value as ExpenseCurrency })}
              className={inputClass}
            >
              <option value="ILS">₪</option>
              <option value="USD">$</option>
            </select>
            <select
              aria-label={t("admin.expenses.kindLabel")}
              value={row.kind}
              onChange={(e) => update(i, { kind: e.target.value as ExpenseKind })}
              className={inputClass}
            >
              <option value="subscription">{t("admin.expenses.kind.subscription")}</option>
              <option value="configured">{t("admin.expenses.kind.configured")}</option>
            </select>
            <button
              type="button"
              aria-label={t("admin.expenses.removeRow")}
              onClick={() => setRows((list) => list.filter((_, j) => j !== i))}
              className="inline-flex h-10 w-10 items-center justify-center rounded-control text-error hover:bg-pressed"
            >
              <Trash2 size={16} aria-hidden />
            </button>
          </li>
        ))}
      </ul>
      <button
        type="button"
        disabled={rows.length >= 50}
        onClick={() =>
          setRows((list) => [...list, { name: "", amount: "", currency: "ILS", kind: "subscription" }])
        }
        className={cn(quietButton, "mt-md gap-xs")}
      >
        <Plus size={16} aria-hidden />
        {t("admin.expenses.addRow")}
      </button>

      <label className="mt-lg flex flex-wrap items-center gap-sm text-body-sm text-text-2">
        {t("admin.expenses.rate")}
        <input
          inputMode="decimal"
          value={rate}
          onChange={(e) => setRate(e.target.value)}
          className={cn(inputClass, "w-24")}
        />
        <span className="text-card-meta text-text-3">{t("admin.expenses.rateNote")}</span>
      </label>

      {problem ? (
        <p role="alert" className="mt-md text-body-sm font-semibold text-error">
          {problem}
        </p>
      ) : null}

      <div className="mt-lg flex flex-wrap gap-sm">
        <button type="button" disabled={busy} onClick={onSaveMonth} className={primaryButton}>
          {t("admin.expenses.saveMonth")}
        </button>
        {data.usesOverride ? (
          <button type="button" disabled={busy} onClick={() => clearMonth.mutate()} className={quietButton}>
            {t("admin.expenses.useDefaults")}
          </button>
        ) : null}
        <button type="button" disabled={busy} onClick={onSaveDefaults} className={quietButton}>
          {t("admin.expenses.saveDefaults")}
        </button>
      </div>
    </Card>
  );
}

function ExpensesBody({ data, lang }: { data: AdminExpenses; lang: string }) {
  const { t } = useTranslation();
  const ils = (micros: number) => formatIls(usdMicrosToIlsMinor(micros, data.usdToIlsRate), lang);
  // The editor starts from the month's list. A new key gives it fresh rows when the month or the saved list changes.
  const editorKey = `${data.month}:${data.usesOverride}:${JSON.stringify(data.fixed)}:${data.usdToIlsRate}`;
  return (
    <div className="flex flex-col gap-xl">
      <Card>
        <p className="text-section-label font-semibold uppercase text-text-3">{t("admin.expenses.total")}</p>
        <p className="mt-xs text-display font-bold text-text-1">{formatIls(data.totalIlsMinor, lang)}</p>
        <p className="mt-xs text-card-meta text-text-3">
          {t("admin.expenses.rateUsed", { rate: data.usdToIlsRate })}
        </p>
      </Card>

      <Card title={t("admin.expenses.costs")}>
        <ul className="flex flex-col divide-y divide-border-subtle">
          {data.fixed.map((row, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: names can repeat
            <li key={i} className="flex flex-wrap items-center justify-between gap-sm py-sm">
              <span className="flex items-center gap-sm">
                <span className="text-body-sm font-semibold text-text-1">{row.name}</span>
                <Tag kind={row.kind} />
              </span>
              <span className="text-body-sm text-text-1" dir="ltr">
                {formatMoney(row.amountMinor, row.currency, lang)}
              </span>
            </li>
          ))}
          {data.auto.map((row) => (
            <li key={row.provider} className="flex flex-wrap items-center justify-between gap-sm py-sm">
              <span className="flex flex-col gap-xs">
                <span className="flex items-center gap-sm">
                  <span className="text-body-sm font-semibold text-text-1">
                    {t("admin.expenses.aiProvider", { provider: providerName(row.provider) })}
                  </span>
                  <Tag kind="auto" />
                </span>
                <span className="text-card-meta text-text-3">
                  {t("admin.expenses.autoDetails", {
                    calls: formatCount(row.calls, lang),
                    input: formatCount(row.inputTokens, lang),
                    output: formatCount(row.outputTokens, lang),
                  })}
                </span>
              </span>
              <span className="text-end text-body-sm text-text-1">
                <span dir="ltr">{formatUsd(row.costUsdMicros, lang)}</span>
                <br />
                <span className="text-card-meta text-text-3">{ils(row.costUsdMicros)}</span>
              </span>
            </li>
          ))}
          {data.fixed.length === 0 && data.auto.length === 0 ? (
            <li className="py-sm text-body-sm text-text-3">{t("admin.expenses.noCosts")}</li>
          ) : null}
        </ul>
      </Card>

      <Card title={t("admin.expenses.byAction")}>
        {data.byAction.length === 0 ? (
          <p className="text-body-sm text-text-3">{t("admin.expenses.noAi")}</p>
        ) : (
          <DataTable
            head={[
              t("admin.expenses.action"),
              t("admin.expenses.calls"),
              t("admin.expenses.tokensIn"),
              t("admin.expenses.tokensOut"),
              t("admin.expenses.totalCost"),
              t("admin.expenses.avgPerCall"),
            ]}
          >
            {data.byAction.map((row) => (
              <tr key={row.action} className="border-b border-border-subtle">
                <td className={firstCellClass}>{aiActionName(row.action, t)}</td>
                <td className={cellClass}>{formatCount(row.calls, lang)}</td>
                <td className={cellClass}>{formatCount(row.inputTokens, lang)}</td>
                <td className={cellClass}>{formatCount(row.outputTokens, lang)}</td>
                <td className={cellClass}>
                  <span dir="ltr">{formatUsd(row.costUsdMicros, lang)}</span>
                </td>
                <td className={cellClass}>
                  <span dir="ltr">{formatUsd(row.averageCostUsdMicros, lang)}</span>
                </td>
              </tr>
            ))}
          </DataTable>
        )}
      </Card>

      <Card title={t("admin.expenses.byModel")}>
        {data.byModel.length === 0 ? (
          <p className="text-body-sm text-text-3">{t("admin.expenses.noAi")}</p>
        ) : (
          <DataTable
            head={[
              t("admin.expenses.model"),
              t("admin.expenses.calls"),
              t("admin.expenses.tokensIn"),
              t("admin.expenses.tokensOut"),
              t("admin.expenses.totalCost"),
            ]}
          >
            {data.byModel.map((row) => (
              <tr key={row.model} className="border-b border-border-subtle">
                <td className={firstCellClass}>
                  <span dir="ltr">{row.model}</span>
                </td>
                <td className={cellClass}>{formatCount(row.calls, lang)}</td>
                <td className={cellClass}>{formatCount(row.inputTokens, lang)}</td>
                <td className={cellClass}>{formatCount(row.outputTokens, lang)}</td>
                <td className={cellClass}>
                  <span dir="ltr">{formatUsd(row.costUsdMicros, lang)}</span>
                </td>
              </tr>
            ))}
          </DataTable>
        )}
      </Card>

      <CostEditor key={editorKey} data={data} />
    </div>
  );
}

/** The key page: what the business costs each month. A month switcher, the total in shekels, every cost, the AI bill by feature and model, and the editor for fixed costs. */
export function ExpensesView() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const now = monthOf(new Date());
  const [month, setMonth] = useState(now);
  const query = useAdminExpenses(month);
  const isNow = month >= now;
  return (
    <>
      <PageTitle title={t("admin.nav.expenses")}>
        <div className="flex items-center gap-sm">
          <button
            type="button"
            aria-label={t("admin.expenses.previousMonth")}
            onClick={() => setMonth((m) => shiftMonth(m, -1))}
            className="inline-flex h-10 w-10 items-center justify-center rounded-control border border-border hover:bg-pressed rtl:-scale-x-100"
          >
            <ChevronLeft size={18} aria-hidden />
          </button>
          <span aria-live="polite" className="min-w-36 text-center text-body font-semibold text-text-1">
            {monthLabel(month, lang)}
          </span>
          <button
            type="button"
            aria-label={t("admin.expenses.nextMonth")}
            disabled={isNow}
            onClick={() => setMonth((m) => shiftMonth(m, 1))}
            className="inline-flex h-10 w-10 items-center justify-center rounded-control border border-border hover:bg-pressed disabled:opacity-40 rtl:-scale-x-100"
          >
            <ChevronRight size={18} aria-hidden />
          </button>
        </div>
      </PageTitle>
      <QueryState query={query}>{(data) => <ExpensesBody data={data} lang={lang} />}</QueryState>
    </>
  );
}

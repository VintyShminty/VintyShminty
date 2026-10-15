"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  type AdminExpenses,
  type ExpenseCadence,
  type ExpenseCurrency,
  type ExtraCost,
  type ExtraCostInput,
  extraCostSchema,
  formatMoney,
} from "@vinty/shared";
import { Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useToast } from "@/components/admin/toast";
import { Card, inputClass, primaryButton, quietButton } from "@/components/admin/ui";
import { parseMinor } from "@/lib/admin-format";
import { adminKeys } from "@/lib/admin-keys";
import { adminErrorText } from "@/lib/admin-queries";
import { clientApi } from "@/lib/api-client";
import { cn } from "@/lib/utils";

type Draft = {
  id: string | null;
  cadence: ExpenseCadence;
  name: string;
  amount: string;
  currency: ExpenseCurrency;
  paidBy: string;
  paidOn: string;
};

/** Today when the screen shows the current month, otherwise the first day of the month on screen. */
const startingDay = (month: string) => {
  const today = new Date().toISOString().slice(0, 10);
  return today.startsWith(month) ? today : `${month}-01`;
};

const blank = (month: string): Draft => ({
  id: null,
  cadence: "yearly",
  name: "",
  amount: "",
  currency: "USD",
  paidBy: "",
  paidOn: startingDay(month),
});

const toDraft = (row: ExtraCost): Draft => ({
  id: row.id,
  cadence: row.cadence,
  name: row.name,
  amount: (row.amountMinor / 100).toFixed(2),
  currency: row.currency,
  paidBy: row.paidBy,
  paidOn: row.paidOn,
});

/** The names used before, offered by every "paid by" box on the page. */
export function PaidByNames({ names }: { names: string[] }) {
  return (
    <datalist id="paid-by-names">
      {names.map((name) => (
        <option key={name} value={name} />
      ))}
    </datalist>
  );
}

/** A text box that also offers the names used before. */
export function PaidByInput({
  value,
  onChange,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  const { t } = useTranslation();
  return (
    <input
      aria-label={t("admin.expenses.paidBy")}
      placeholder={t("admin.expenses.paidBy")}
      list="paid-by-names"
      value={value}
      maxLength={40}
      onChange={(e) => onChange(e.target.value)}
      className={cn(inputClass, className)}
    />
  );
}

/** Yearly and one time costs: a list for the month on screen and a form to add or change one. */
export function ExtraCostsEditor({ data }: { data: AdminExpenses }) {
  const { t } = useTranslation();
  const toast = useToast();
  const client = useQueryClient();
  const [draft, setDraft] = useState<Draft>(() => blank(data.month));
  const [problem, setProblem] = useState<string | null>(null);

  const refresh = (messageKey: string) => {
    void client.invalidateQueries({ queryKey: adminKeys.expensesAll });
    void client.invalidateQueries({ queryKey: adminKeys.dashboard });
    toast(t(messageKey));
  };
  const fail = (error: unknown) => toast(adminErrorText(error, t), "error");

  const save = useMutation({
    mutationFn: (input: { id: string | null; body: ExtraCostInput }) =>
      clientApi(input.id ? `/v1/admin/expenses/items/${input.id}` : "/v1/admin/expenses/items", {
        method: input.id ? "PUT" : "POST",
        body: input.body,
        schema: extraCostSchema,
      }),
    onSuccess: () => {
      setDraft(blank(data.month));
      refresh("admin.expenses.savedItem");
    },
    onError: fail,
  });
  const remove = useMutation({
    mutationFn: (id: string) =>
      clientApi(`/v1/admin/expenses/items/${id}`, { method: "DELETE", schema: extraCostSchema }),
    onSuccess: () => refresh("admin.expenses.removedItem"),
    onError: fail,
  });
  const busy = save.isPending || remove.isPending;

  const onSave = () => {
    const amountMinor = parseMinor(draft.amount);
    if (!draft.name.trim() || amountMinor === null || !draft.paidOn) {
      setProblem(t("admin.expenses.fixItem"));
      return;
    }
    setProblem(null);
    save.mutate({
      id: draft.id,
      body: {
        cadence: draft.cadence,
        name: draft.name.trim(),
        amountMinor,
        currency: draft.currency,
        paidBy: draft.paidBy.trim(),
        paidOn: draft.paidOn,
      },
    });
  };

  const rows = [...data.yearly, ...data.oneTime];
  return (
    <Card title={t("admin.expenses.extraTitle")}>
      <p className="mb-md text-body-sm text-text-3">{t("admin.expenses.extraNote")}</p>

      {rows.length > 0 ? (
        <ul className="mb-lg flex flex-col divide-y divide-border-subtle">
          {rows.map((row) => (
            <li key={row.id} className="flex flex-wrap items-center justify-between gap-sm py-sm">
              <span className="flex flex-col gap-xs">
                <span className="text-body-sm font-semibold text-text-1">{row.name}</span>
                <span className="text-card-meta text-text-3">
                  {t(`admin.expenses.cadence.${row.cadence}`)}, {row.paidOn}
                  {row.paidBy ? `, ${t("admin.expenses.paidByName", { name: row.paidBy })}` : ""}
                </span>
              </span>
              <span className="flex items-center gap-sm">
                <span className="text-body-sm text-text-1" dir="ltr">
                  {formatMoney(row.amountMinor, row.currency, "en")}
                </span>
                <button
                  type="button"
                  aria-label={t("admin.expenses.editItem")}
                  disabled={busy}
                  onClick={() => setDraft(toDraft(row))}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-control hover:bg-pressed"
                >
                  <Pencil size={16} aria-hidden />
                </button>
                <button
                  type="button"
                  aria-label={t("admin.expenses.removeRow")}
                  disabled={busy}
                  onClick={() => remove.mutate(row.id)}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-control text-error hover:bg-pressed"
                >
                  <Trash2 size={16} aria-hidden />
                </button>
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="grid grid-cols-2 gap-sm md:grid-cols-[8rem_1fr_7rem_5.5rem]">
        <select
          aria-label={t("admin.expenses.kindLabel")}
          value={draft.cadence}
          onChange={(e) => setDraft((d) => ({ ...d, cadence: e.target.value as ExpenseCadence }))}
          className={inputClass}
        >
          <option value="yearly">{t("admin.expenses.cadence.yearly")}</option>
          <option value="one_time">{t("admin.expenses.cadence.one_time")}</option>
        </select>
        <input
          aria-label={t("admin.expenses.name")}
          placeholder={t("admin.expenses.name")}
          value={draft.name}
          maxLength={80}
          onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
          className={cn(inputClass, "col-span-2 md:col-span-1")}
        />
        <input
          aria-label={t("admin.expenses.amount")}
          placeholder={t("admin.expenses.amount")}
          inputMode="decimal"
          value={draft.amount}
          onChange={(e) => setDraft((d) => ({ ...d, amount: e.target.value }))}
          className={inputClass}
        />
        <select
          aria-label={t("admin.expenses.currency")}
          value={draft.currency}
          onChange={(e) => setDraft((d) => ({ ...d, currency: e.target.value as ExpenseCurrency }))}
          className={inputClass}
        >
          <option value="ILS">₪</option>
          <option value="USD">$</option>
        </select>
      </div>
      <div className="mt-sm grid grid-cols-2 gap-sm md:grid-cols-[1fr_11rem]">
        <PaidByInput value={draft.paidBy} onChange={(paidBy) => setDraft((d) => ({ ...d, paidBy }))} />
        <label className="flex flex-col gap-xs text-card-meta text-text-3">
          {draft.cadence === "yearly" ? t("admin.expenses.startsOn") : t("admin.expenses.paidOn")}
          <input
            type="date"
            value={draft.paidOn}
            onChange={(e) => setDraft((d) => ({ ...d, paidOn: e.target.value }))}
            className={inputClass}
          />
        </label>
      </div>

      {problem ? (
        <p role="alert" className="mt-md text-body-sm font-semibold text-error">
          {problem}
        </p>
      ) : null}

      <div className="mt-lg flex flex-wrap gap-sm">
        <button type="button" disabled={busy} onClick={onSave} className={primaryButton}>
          {draft.id ? t("admin.expenses.saveItem") : t("admin.expenses.addItem")}
        </button>
        {draft.id ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => setDraft(blank(data.month))}
            className={quietButton}
          >
            {t("admin.expenses.cancelEdit")}
          </button>
        ) : null}
      </div>
    </Card>
  );
}

"use client";

import { useQueryClient } from "@tanstack/react-query";
import {
  BUNDLE_LADDER_MAX_STEPS,
  BUNDLE_MAX_PERCENT,
  BUNDLE_MIN_ITEMS_LIMIT,
  type BundleLadder,
  bundleLadderSchema,
} from "@vinty/shared";
import { Minus, Plus, X } from "lucide-react";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Notice } from "@/components/auth/fields";
import { SectionLabel, SwitchRow } from "@/components/settings/page-head";
import { Switch } from "@/components/switch";
import { clientApi } from "@/lib/api-client";

type Step = { minItems: number; percentOff: number };
/** A step on screen, with an id so the rows keep their place while steps are added or removed. */
type Row = Step & { id: number };

function Stepper({
  label,
  value,
  min,
  max,
  onChange,
  valueText,
  lessLabel,
  moreLabel,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (next: number) => void;
  valueText: string;
  lessLabel: string;
  moreLabel: string;
}) {
  const round =
    "flex h-9 w-9 items-center justify-center rounded-full border border-border text-text-1 hover:bg-pressed disabled:opacity-40";
  return (
    <div className="flex flex-1 flex-col gap-xs">
      <span className="text-card-meta text-text-3">{label}</span>
      <div className="flex items-center gap-sm">
        <button
          type="button"
          aria-label={lessLabel}
          disabled={value <= min}
          onClick={() => onChange(value - 1)}
          className={round}
        >
          <Minus size={16} aria-hidden />
        </button>
        <span className="min-w-[72px] text-center text-body font-semibold text-text-1">{valueText}</span>
        <button
          type="button"
          aria-label={moreLabel}
          disabled={value >= max}
          onClick={() => onChange(value + 1)}
          className={round}
        >
          <Plus size={16} aria-hidden />
        </button>
      </div>
    </div>
  );
}

/**
 * Settings, Bundles (D-049). A switch that turns the seller's bundles on or off (it saves at once), then the discount
 * steps with steppers for items and percent. Each step needs more items and a bigger discount than the one before, so
 * the steppers stop at the neighbours and a wrong ladder cannot be made. Save sends the steps.
 */
export function BundleLadderForm({ initial }: { initial: BundleLadder }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [on, setOn] = useState(initial.on);
  const [saved, setSaved] = useState<Step[]>(initial.tiers);
  const nextId = useRef(0);
  const withIds = (list: Step[]): Row[] => list.map((s) => ({ ...s, id: nextId.current++ }));
  const [steps, setSteps] = useState<Row[]>(() => withIds(initial.tiers));
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [done, setDone] = useState(false);

  const send = async (next: { on: boolean; tiers: Step[] }) => {
    setBusy(true);
    setFailed(false);
    setDone(false);
    try {
      const result = await clientApi("/v1/me/bundle-ladder", {
        method: "PUT",
        body: next,
        schema: bundleLadderSchema,
      });
      setOn(result.on);
      setSaved(result.tiers);
      setSteps(withIds(result.tiers));
      setDone(true);
      void queryClient.invalidateQueries({ queryKey: ["bundle-ladder"] });
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  const change = (i: number, patch: Partial<Step>) =>
    setSteps((list) => list.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  const last = steps[steps.length - 1];
  const canAdd =
    steps.length < BUNDLE_LADDER_MAX_STEPS &&
    last !== undefined &&
    last.minItems < BUNDLE_MIN_ITEMS_LIMIT &&
    last.percentOff < BUNDLE_MAX_PERCENT;
  const addStep = () => {
    if (!last) return;
    setSteps((list) => [
      ...list,
      ...withIds([
        { minItems: last.minItems + 1, percentOff: Math.min(BUNDLE_MAX_PERCENT, last.percentOff + 5) },
      ]),
    ]);
  };
  const plain = steps.map(({ minItems, percentOff }) => ({ minItems, percentOff }));
  const dirty = JSON.stringify(plain) !== JSON.stringify(saved);

  return (
    <div>
      {failed ? <Notice kind="error">{t("bundleSettings.saveFailed")}</Notice> : null}
      <SwitchRow label={t("bundleSettings.offer")} hint={t("bundleSettings.offerHint")}>
        <Switch
          checked={on}
          label={t("bundleSettings.offer")}
          disabled={busy}
          onChange={(next) => void send({ on: next, tiers: saved })}
        />
      </SwitchRow>

      {on ? (
        <>
          <SectionLabel>{t("bundleSettings.steps")}</SectionLabel>
          <p className="mb-md text-body-sm text-text-3">{t("bundleSettings.stepsNote")}</p>
          <ul className="flex flex-col gap-md">
            {steps.map((step, i) => {
              const prev = steps[i - 1];
              const next = steps[i + 1];
              return (
                <li
                  key={step.id}
                  className="flex flex-wrap items-end gap-md rounded-control border border-border-subtle p-md"
                >
                  <Stepper
                    label={t("bundleSettings.items")}
                    value={step.minItems}
                    min={prev ? prev.minItems + 1 : 2}
                    max={next ? next.minItems - 1 : BUNDLE_MIN_ITEMS_LIMIT}
                    onChange={(minItems) => change(i, { minItems })}
                    valueText={t("bundleSettings.itemsValue", { count: step.minItems })}
                    lessLabel={t("bundleSettings.fewer")}
                    moreLabel={t("bundleSettings.more")}
                  />
                  <Stepper
                    label={t("bundleSettings.percent")}
                    value={step.percentOff}
                    min={prev ? prev.percentOff + 1 : 1}
                    max={next ? next.percentOff - 1 : BUNDLE_MAX_PERCENT}
                    onChange={(percentOff) => change(i, { percentOff })}
                    valueText={`${step.percentOff}%`}
                    lessLabel={t("bundleSettings.fewerOff")}
                    moreLabel={t("bundleSettings.moreOff")}
                  />
                  <button
                    type="button"
                    aria-label={t("bundleSettings.removeStep", { number: i + 1 })}
                    disabled={steps.length <= 1}
                    onClick={() => setSteps((list) => list.filter((_, j) => j !== i))}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-text-3 hover:bg-pressed disabled:opacity-40"
                  >
                    <X size={18} aria-hidden />
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="mt-md flex flex-wrap items-center gap-md">
            <button
              type="button"
              onClick={addStep}
              disabled={!canAdd}
              className="inline-flex h-11 items-center gap-sm rounded-control border border-primary px-lg text-body-sm font-semibold text-primary hover:bg-accent-tint disabled:opacity-40"
            >
              <Plus size={16} aria-hidden />
              {t("bundleSettings.addStep")}
            </button>
            <button
              type="button"
              onClick={() => void send({ on, tiers: plain })}
              disabled={busy || !dirty}
              className="inline-flex h-11 items-center rounded-control bg-primary px-lg text-body-sm font-semibold text-on-accent hover:opacity-90 disabled:opacity-40"
            >
              {t("bundleSettings.save")}
            </button>
            {done && !dirty ? (
              <span role="status" className="text-body-sm text-success">
                {t("bundleSettings.saved")}
              </span>
            ) : null}
          </div>
        </>
      ) : (
        <p className="mt-md text-body-sm text-text-3">{t("bundleSettings.off")}</p>
      )}
    </div>
  );
}

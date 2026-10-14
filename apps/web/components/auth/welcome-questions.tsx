"use client";

import {
  FIGURE_FILE,
  ONBOARDING_PICKS,
  type OnboardingPick,
  PERSONALISATION_SIZES_MAX,
  SIZE_STEPS,
  type SizeFigure,
} from "@vinty/shared";
import { Check } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Chip } from "@/components/chip";
import { clientApi } from "@/lib/api-client";
import { finishOnboarding } from "@/lib/onboarding";
import { SIZE_PICTURES } from "@/lib/size-pictures";
import { cn } from "@/lib/utils";

type SizeOption = { id: string; label: string };

const FIGURES: SizeFigure[] = ["women", "men", "kids"];

const primaryButton =
  "inline-flex h-12 w-full items-center justify-center rounded-control bg-primary px-lg text-body font-semibold text-on-accent hover:opacity-90 disabled:opacity-40";
const outlineButton =
  "inline-flex h-12 w-full items-center justify-center rounded-control border border-primary px-lg text-body font-semibold text-primary hover:bg-accent-tint";
const ghostButton =
  "inline-flex h-12 w-full items-center justify-center rounded-control px-lg text-body font-semibold text-text-2 hover:bg-pressed";

/**
 * The two short questions right after sign up, both skippable (D-022): what do you shop for, then your sizes with the
 * ink drawings (D-029). Picks and sizes are saved with the same calls as the app. Skipping or finishing marks the
 * questions as done for this person, so they come only once.
 */
export function WelcomeQuestions({
  lang,
  userId,
  next,
  groups,
  savedSizeIds,
}: {
  lang: string;
  userId: string;
  next: string;
  groups: Record<string, SizeOption[]>;
  savedSizeIds: string[];
}) {
  const { t } = useTranslation();
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [picks, setPicks] = useState<OnboardingPick[]>([]);
  const heading = useRef<HTMLHeadingElement>(null);

  const done = () => {
    finishOnboarding(userId);
    router.replace(next);
    router.refresh();
  };

  const toSizes = () => {
    // Picking nothing is the same as skipping: nothing is sent.
    if (picks.length > 0)
      void clientApi("/v1/me/onboarding-picks", { method: "POST", body: { picks }, lang }).catch(() => {});
    setStep(2);
  };

  const toggle = (pick: OnboardingPick) =>
    setPicks((current) => (current.includes(pick) ? current.filter((p) => p !== pick) : [...current, pick]));

  return (
    <main className="mx-auto w-full max-w-[1100px] px-lg pb-2xl pt-lg md:px-xl">
      <div className="flex h-12 items-center justify-between">
        <p className="text-body-sm text-text-3">{t("onboarding.step", { current: step, total: 2 })}</p>
        <button
          type="button"
          onClick={step === 1 ? () => setStep(2) : done}
          className="text-body-sm font-bold text-primary hover:underline"
        >
          {t("onboarding.skip")}
        </button>
      </div>
      {step === 1 ? (
        <div className="mx-auto max-w-[520px]">
          <h1 ref={heading} className="mt-lg text-title text-text-1">
            {t("onboarding.shopFor.title")}
          </h1>
          <p className="mb-xl mt-sm text-subtitle text-text-3">{t("onboarding.shopFor.subtitle")}</p>
          <fieldset className="flex flex-col gap-md border-0 p-0">
            <legend className="sr-only">{t("onboarding.shopFor.title")}</legend>
            {ONBOARDING_PICKS.map((pick) => {
              const on = picks.includes(pick);
              return (
                <label
                  key={pick}
                  className={cn(
                    "flex min-h-[72px] cursor-pointer items-center justify-between rounded-control border px-lg focus-within:border-2 focus-within:border-primary",
                    on ? "border-primary bg-accent-tint" : "border-border bg-background hover:bg-surface",
                  )}
                >
                  <span className="text-heading text-text-1">{t(`onboarding.shopFor.${pick}`)}</span>
                  <input type="checkbox" checked={on} onChange={() => toggle(pick)} className="sr-only" />
                  <span
                    aria-hidden
                    className={cn(
                      "inline-flex h-6 w-6 items-center justify-center rounded-[6px] border",
                      on ? "border-primary bg-primary text-on-accent" : "border-text-4",
                    )}
                  >
                    {on ? <Check size={16} /> : null}
                  </span>
                </label>
              );
            })}
          </fieldset>
          <button type="button" onClick={toSizes} className={cn(primaryButton, "mt-xl")}>
            {t("onboarding.continue")}
          </button>
        </div>
      ) : (
        <SizesStep lang={lang} picks={picks} groups={groups} savedSizeIds={savedSizeIds} onDone={done} />
      )}
    </main>
  );
}

/** The row of dots: the current one is longer and espresso. */
function Progress({ current, total }: { current: number; total: number }) {
  const { t } = useTranslation();
  return (
    <div
      role="img"
      aria-label={t("onboarding.sizes.progress", { current: current + 1, total })}
      className="flex h-2 items-center gap-xs"
    >
      {Array.from({ length: total }, (_, dot) => (
        <span
          // biome-ignore lint/suspicious/noArrayIndexKey: the dots are identical and never reorder
          key={dot}
          className={cn("h-2 rounded-full", dot === current ? "w-5 bg-primary" : "w-2 bg-border")}
        />
      ))}
    </div>
  );
}

function SizesStep({
  lang,
  picks,
  groups,
  savedSizeIds,
  onDone,
}: {
  lang: string;
  picks: OnboardingPick[];
  groups: Record<string, SizeOption[]>;
  savedSizeIds: string[];
  onDone: () => void;
}) {
  const { t } = useTranslation();
  const [who, setWho] = useState<SizeFigure | null>(picks.length === 1 ? (picks[0] as SizeFigure) : null);
  const [choice, setChoice] = useState<SizeFigure | null>(picks[0] ?? null);
  const [index, setIndex] = useState(0);
  const [sizeIds, setSizeIds] = useState<string[]>(savedSizeIds);
  // Whether anything was ticked since the last save, so a skipped part sends nothing.
  const [changed, setChanged] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);

  // A new part of the question moves the screen reader to its title.
  useEffect(() => {
    if (index > 0 || who) heading.current?.focus({ preventScroll: true });
  }, [index, who]);

  if (!who) {
    return (
      <div className="mx-auto max-w-[520px]">
        <h1 ref={heading} tabIndex={-1} className="mt-lg text-title text-text-1 outline-none">
          {t("onboarding.sizes.whoTitle")}
        </h1>
        <p className="mb-xl mt-sm text-subtitle text-text-3">{t("onboarding.sizes.whoSubtitle")}</p>
        <div className="flex flex-wrap gap-sm">
          {FIGURES.map((figure) => (
            <Chip
              key={figure}
              label={t(`onboarding.shopFor.${figure}`)}
              selected={choice === figure}
              onClick={() => setChoice(figure)}
            />
          ))}
        </div>
        <button
          type="button"
          disabled={!choice}
          onClick={() => choice && setWho(choice)}
          className={cn(primaryButton, "mt-xl")}
        >
          {t("onboarding.continue")}
        </button>
      </div>
    );
  }

  // Only the groups that really exist in the reference data, and only steps that have something to pick.
  const steps = SIZE_STEPS[who]
    .map((step) => ({
      ...step,
      rows: step.groups
        .map((group) => ({ label: group.label, sizes: groups[group.slug] ?? [] }))
        .filter((row) => row.sizes.length > 0),
    }))
    .filter((step) => step.rows.length > 0);
  const stepIndex = Math.min(index, steps.length - 1);
  const step = steps[stepIndex];
  if (!step) {
    return (
      <button type="button" onClick={onDone} className={primaryButton}>
        {t("onboarding.finish")}
      </button>
    );
  }

  const last = stepIndex >= steps.length - 1;
  const following = steps[stepIndex + 1];
  const hasPick = step.rows.some((row) => row.sizes.some((s) => sizeIds.includes(s.id)));
  const file = FIGURE_FILE[who];

  const toggle = (id: string) => {
    setChanged(true);
    setSizeIds((current) =>
      current.includes(id)
        ? current.filter((s) => s !== id)
        : current.length < PERSONALISATION_SIZES_MAX
          ? [...current, id]
          : current,
    );
  };

  const next = () => {
    if (changed)
      void clientApi("/v1/me/personalisation/sizes", { method: "PUT", body: { sizeIds }, lang }).catch(
        () => {},
      );
    setChanged(false);
    if (last) onDone();
    else setIndex(stepIndex + 1);
  };

  const back = () => {
    if (index > 0) setIndex(index - 1);
    else setWho(null);
  };

  // Nothing to go back to when "What do you shop for?" already told us whose sizes these are.
  const canGoBack = index > 0 || picks.length !== 1;

  const mainLabel = !hasPick
    ? t("onboarding.sizes.skipPart")
    : following
      ? t("onboarding.sizes.nextTo", { step: t(`onboarding.sizes.${following.id}.title`) })
      : t("onboarding.finish");

  return (
    <div className="grid items-center gap-lg md:grid-cols-[minmax(0,1fr)_minmax(0,460px)] md:gap-2xl">
      {/* The drawing sits at the start of the row on a laptop and above the card on a phone. The pictures of one person
          are stacked and only the active one is visible. It is decoration, so screen readers skip it. */}
      <div aria-hidden className="relative mx-auto h-[34dvh] aspect-[39/100] md:h-[min(74dvh,780px)]">
        {steps.map((s) => {
          const picture = SIZE_PICTURES[`${file}-${s.picture}`];
          return picture ? (
            <Image
              key={s.id}
              src={picture}
              alt=""
              sizes="(min-width: 768px) 320px, 140px"
              priority={s.id === step.id}
              className={cn(
                "absolute inset-0 h-full w-full object-contain transition-opacity duration-300 motion-reduce:transition-none",
                s.id === step.id ? "opacity-100" : "opacity-0",
              )}
            />
          ) : null;
        })}
      </div>
      <section className="rounded-window border border-border-subtle bg-background p-lg md:p-xl">
        <div className="flex items-start justify-between gap-md">
          <h1 ref={heading} tabIndex={-1} className="flex-1 text-title text-text-1 outline-none">
            {t(`onboarding.sizes.${step.id}.title`)}
          </h1>
          <div className="pt-md">
            <Progress current={stepIndex} total={steps.length} />
          </div>
        </div>
        <p className="mb-xs mt-xs text-subtitle text-text-3">{t(`onboarding.sizes.${step.id}.hint`)}</p>
        <div className="max-h-[36dvh] overflow-y-auto pb-md md:max-h-[44dvh]">
          {step.rows.map((row) => (
            <div key={row.label ?? "all"}>
              {row.label ? (
                <h2 className="mb-sm mt-md text-section-label font-semibold uppercase text-text-3">
                  {t(`onboarding.sizes.${row.label}`)}
                </h2>
              ) : null}
              <div className={cn("flex flex-wrap gap-sm", !row.label && "mt-md")}>
                {row.sizes.map((size) => (
                  <Chip
                    key={size.id}
                    label={size.label}
                    selected={sizeIds.includes(size.id)}
                    onClick={() => toggle(size.id)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
        <button type="button" onClick={next} className={hasPick ? primaryButton : outlineButton}>
          {mainLabel}
        </button>
        {canGoBack ? (
          <button type="button" onClick={back} className={cn(ghostButton, "mt-xs")}>
            {t("onboarding.sizes.back")}
          </button>
        ) : null}
      </section>
    </div>
  );
}

"use client";

import { type KeyboardEvent, type PointerEvent, useRef } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

export type ConditionStop = { id: string; label: string; description?: string };

/**
 * The condition slider (D-019): five stops from Unworn with tags to Well loved, a name under each stop and the chosen
 * level's hint below. Click or drag along the track, or use the arrow, Home and End keys. The first stop is at the
 * start side, so in Hebrew the track runs right to left.
 */
export function ConditionSlider({
  stops,
  value,
  onChange,
  error,
}: {
  stops: ConditionStop[];
  value: string | null;
  onChange: (id: string) => void;
  error?: string;
}) {
  const { t } = useTranslation();
  const track = useRef<HTMLDivElement>(null);
  const count = stops.length;
  const index = stops.findIndex((s) => s.id === value);
  const chosen = index >= 0 ? stops[index] : null;
  const pick = (i: number) => {
    const stop = stops[Math.max(0, Math.min(count - 1, i))];
    if (stop) onChange(stop.id);
  };

  const fromPointer = (event: PointerEvent) => {
    const el = track.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const rtl = getComputedStyle(el).direction === "rtl";
    const x = rtl ? rect.right - event.clientX : event.clientX - rect.left;
    pick(Math.floor((x / rect.width) * count));
  };
  const onKey = (event: KeyboardEvent) => {
    const rtl = getComputedStyle(event.currentTarget).direction === "rtl";
    const forward = rtl ? "ArrowLeft" : "ArrowRight";
    const back = rtl ? "ArrowRight" : "ArrowLeft";
    const start = index < 0 ? Math.floor(count / 2) : index;
    if (event.key === forward || event.key === "ArrowUp") pick(index < 0 ? start : start + 1);
    else if (event.key === back || event.key === "ArrowDown") pick(index < 0 ? start : start - 1);
    else if (event.key === "Home") pick(0);
    else if (event.key === "End") pick(count - 1);
    else return;
    event.preventDefault();
  };

  return (
    <div className="flex flex-col gap-sm">
      <div
        ref={track}
        role="slider"
        tabIndex={0}
        aria-label={t("sell.condition")}
        aria-valuemin={1}
        aria-valuemax={count}
        aria-valuenow={index >= 0 ? index + 1 : undefined}
        aria-valuetext={
          chosen
            ? t("sell.conditionStop", { name: chosen.label, n: index + 1, total: count })
            : t("sell.conditionPick")
        }
        aria-invalid={error ? true : undefined}
        onKeyDown={onKey}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          fromPointer(e);
        }}
        onPointerMove={(e) => {
          if (e.buttons === 1) fromPointer(e);
        }}
        className="cursor-pointer touch-pan-y select-none rounded-control outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
      >
        <div className="relative flex h-10 items-center">
          <span
            aria-hidden
            className="absolute h-[2px] bg-border"
            style={{ insetInlineStart: `${50 / count}%`, insetInlineEnd: `${50 / count}%` }}
          />
          {index > 0 ? (
            <span
              aria-hidden
              className="absolute h-[2px] bg-primary"
              style={{ insetInlineStart: `${50 / count}%`, width: `${(index * 100) / count}%` }}
            />
          ) : null}
          {stops.map((s, i) => (
            <span key={s.id} className="relative flex flex-1 justify-center">
              <span
                aria-hidden
                className={cn(
                  "h-4 w-4 rounded-full border-2 transition-transform duration-200",
                  i <= index ? "border-primary bg-primary" : "border-border bg-background",
                  i === index && "scale-[1.55]",
                )}
              />
            </span>
          ))}
        </div>
        <div className="flex" aria-hidden>
          {stops.map((s, i) => (
            <span
              key={s.id}
              className={cn(
                "flex-1 px-px text-center text-card-meta",
                i === index ? "font-bold text-primary" : "text-text-3",
              )}
            >
              {s.label}
            </span>
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-xs rounded-control bg-surface p-md" aria-live="polite">
        <span className="font-semibold text-text-1">{chosen ? chosen.label : t("sell.conditionPick")}</span>
        {chosen?.description ? <span className="text-body-sm text-text-3">{chosen.description}</span> : null}
      </div>
      {error ? (
        <p role="alert" className="text-body-sm text-error">
          {error}
        </p>
      ) : null}
    </div>
  );
}

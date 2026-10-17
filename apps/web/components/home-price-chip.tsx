"use client";

import { formatPrice } from "@vinty/shared";
import { ChevronDown } from "lucide-react";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { Chip } from "@/components/chip";
import { hasPrice, orderedRange, PRICE_PICKS, type PriceRange } from "@/lib/feed-url";
import { cn } from "@/lib/utils";

type Translate = (key: string, options?: Record<string, unknown>) => string;

const shekels = (whole: number) => formatPrice(whole * 100, "ILS");

/** "Under ₪50", "₪50 to ₪100", "₪200 and up". */
export function priceRangeLabel(range: PriceRange, t: Translate): string {
  const { min, max } = range;
  if (min !== undefined && max !== undefined)
    return t("home.price.range", { from: shekels(min), to: shekels(max) });
  if (min !== undefined) return t("home.price.over", { from: shekels(min) });
  return t("home.price.under", { to: shekels(max ?? 0) });
}

const PANEL_WIDTH = 320;

/**
 * The Price chip on Home (D-056). It sits in the chip row where Under 50 used to be and opens a small panel under it
 * with From and To fields in whole shekels, four quick picks, Clear and Show. The panel is drawn on the page itself,
 * not inside the chip row, because the row scrolls sideways on a phone and would cut it off. Clicking outside,
 * pressing Escape or going to another page closes it. With a range set the chip is filled and shows the range.
 */
export function HomePriceChip({
  price,
  onChange,
}: {
  price: PriceRange;
  onChange: (next: PriceRange) => void;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [spot, setSpot] = useState<{ top: number; left: number; width: number } | null>(null);
  const button = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const panelId = useId();
  const pathname = usePathname();
  const active = hasPrice(price);

  // biome-ignore lint/correctness/useExhaustiveDependencies: closing when the page changes is the point
  useEffect(() => setOpen(false), [pathname]);

  const place = useCallback(() => {
    const el = button.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const view = document.documentElement.clientWidth;
    const width = Math.min(PANEL_WIDTH, view - 32);
    const rtl = getComputedStyle(el).direction === "rtl";
    const wanted = rtl ? rect.right - width : rect.left;
    setSpot({
      top: rect.bottom + window.scrollY + 8,
      left: Math.max(16, Math.min(wanted, view - 16 - width)) + window.scrollX,
      width,
    });
  }, []);

  useLayoutEffect(() => {
    if (open) place();
  }, [open, place]);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      const target = e.target as Node;
      if (!panel.current?.contains(target) && !button.current?.contains(target)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        button.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", place);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", place);
    };
  }, [open, place]);

  const toggle = () => {
    if (!open) {
      setFrom(price.min === undefined ? "" : String(price.min));
      setTo(price.max === undefined ? "" : String(price.max));
    }
    setOpen((v) => !v);
  };

  const apply = (next: PriceRange) => {
    onChange(orderedRange(next));
    setOpen(false);
  };
  const whole = (s: string) => (s === "" ? undefined : Number(s));

  const field = (value: string, set: (v: string) => void, label: string) => (
    <label className="flex min-w-0 flex-1 flex-col gap-xs text-small-label text-text-3">
      {label}
      <span className="flex h-10 min-w-0 items-center gap-xs rounded-control border border-border bg-surface px-md focus-within:border-primary">
        <span aria-hidden className="text-body-sm text-text-3">
          ₪
        </span>
        <input
          inputMode="numeric"
          value={value}
          maxLength={7}
          onChange={(e) => set(e.target.value.replace(/\D/g, ""))}
          onKeyDown={(e) => {
            if (e.key === "Enter") apply({ min: whole(from), max: whole(to) });
          }}
          className="min-w-0 flex-1 bg-transparent text-body-sm text-text-1 outline-none"
        />
      </span>
    </label>
  );

  const label = active ? priceRangeLabel(price, t) : t("home.price.label");
  return (
    <>
      <button
        ref={button}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        aria-haspopup="dialog"
        onClick={toggle}
        className={cn(
          "inline-flex h-8 shrink-0 items-center justify-center gap-xs whitespace-nowrap rounded-full border px-[14px] text-body-sm",
          active
            ? "border-text-1 bg-text-1 font-semibold text-primary-foreground"
            : "border-border bg-background text-text-2 hover:bg-pressed",
        )}
      >
        {label}
        <ChevronDown size={14} aria-hidden className={open ? "rotate-180" : undefined} />
      </button>
      {open && spot
        ? createPortal(
            <div
              ref={panel}
              id={panelId}
              role="dialog"
              aria-label={t("home.price.label")}
              style={{ top: spot.top, left: spot.left, width: spot.width }}
              className="absolute z-50 rounded-window border border-border bg-background p-lg shadow-lg"
            >
              <div className="flex flex-wrap gap-sm">
                {PRICE_PICKS.map((pick) => (
                  <Chip
                    key={`${pick.min ?? ""}-${pick.max ?? ""}`}
                    label={priceRangeLabel(pick, t)}
                    selected={pick.min === price.min && pick.max === price.max}
                    onClick={() => apply(pick)}
                  />
                ))}
              </div>
              <div className="mt-lg flex items-end gap-md">
                {field(from, setFrom, t("home.price.from"))}
                {field(to, setTo, t("home.price.to"))}
              </div>
              <div className="mt-lg flex items-center justify-between gap-lg border-t border-border-subtle pt-md">
                <button
                  type="button"
                  onClick={() => apply({})}
                  disabled={!active && from === "" && to === ""}
                  className="text-body-sm font-semibold text-primary underline underline-offset-4 disabled:pointer-events-none disabled:opacity-40"
                >
                  {t("home.price.clear")}
                </button>
                <button
                  type="button"
                  onClick={() => apply({ min: whole(from), max: whole(to) })}
                  className="inline-flex h-10 items-center rounded-control bg-primary px-lg text-body-sm font-semibold text-primary-foreground"
                >
                  {t("home.price.show")}
                </button>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

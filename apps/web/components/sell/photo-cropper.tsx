"use client";

import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { CropRect } from "@/lib/listing-photo-upload";
import { cn } from "@/lib/utils";

/** The smallest the box can get, in screen pixels. */
const MIN_PX = 48;
const START_INSET = 0.06;
const NUDGE = 0.01;

type Drag = { mode: "move" | "tl" | "tr" | "bl" | "br"; x: number; y: number; rect: CropRect };

const clamp = (value: number, low: number, high: number) => Math.min(Math.max(value, low), high);

const CORNERS = [
  { mode: "tl", left: 0, top: 0, cursor: "cursor-nwse-resize" },
  { mode: "tr", left: 1, top: 0, cursor: "cursor-nesw-resize" },
  { mode: "bl", left: 0, top: 1, cursor: "cursor-nesw-resize" },
  { mode: "br", left: 1, top: 1, cursor: "cursor-nwse-resize" },
] as const;

/**
 * The website's crop view: the picture with a dimmed outside, a box to move (drag inside) and resize (drag a corner),
 * any shape. The box lives in fractions (0 to 1) of the picture, which is exactly what Done hands back. The arrow
 * keys nudge the box and Escape cancels (the dialog around it handles that).
 */
export function PhotoCropper({
  url,
  busy,
  onCancel,
  onDone,
}: {
  url: string;
  busy: boolean;
  onCancel: () => void;
  onDone: (rect: CropRect) => void;
}) {
  const { t } = useTranslation();
  const frame = useRef<HTMLDivElement>(null);
  const drag = useRef<Drag | null>(null);
  const [rect, setRect] = useState<CropRect>({
    x: START_INSET,
    y: START_INSET,
    width: 1 - 2 * START_INSET,
    height: 1 - 2 * START_INSET,
  });

  const start = (mode: Drag["mode"]) => (event: React.PointerEvent) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { mode, x: event.clientX, y: event.clientY, rect };
  };

  const move = (event: React.PointerEvent) => {
    const d = drag.current;
    const bounds = frame.current?.getBoundingClientRect();
    if (!d || !bounds || bounds.width === 0 || bounds.height === 0) return;
    const dx = (event.clientX - d.x) / bounds.width;
    const dy = (event.clientY - d.y) / bounds.height;
    const minW = Math.min(1, MIN_PX / bounds.width);
    const minH = Math.min(1, MIN_PX / bounds.height);
    const r = d.rect;
    if (d.mode === "move") {
      setRect({
        ...r,
        x: clamp(r.x + dx, 0, 1 - r.width),
        y: clamp(r.y + dy, 0, 1 - r.height),
      });
      return;
    }
    let left = r.x;
    let right = r.x + r.width;
    let top = r.y;
    let bottom = r.y + r.height;
    if (d.mode === "tl" || d.mode === "bl") left = clamp(r.x + dx, 0, right - minW);
    else right = clamp(right + dx, left + minW, 1);
    if (d.mode === "tl" || d.mode === "tr") top = clamp(r.y + dy, 0, bottom - minH);
    else bottom = clamp(bottom + dy, top + minH, 1);
    setRect({ x: left, y: top, width: right - left, height: bottom - top });
  };

  const end = () => {
    drag.current = null;
  };

  const pct = (value: number) => `${value * 100}%`;
  const bottom = rect.y + rect.height;
  const right = rect.x + rect.width;

  return (
    <div className="flex h-full w-full flex-col gap-md p-lg">
      <div className="flex min-h-0 flex-1 items-center justify-center">
        <div ref={frame} className="relative touch-none select-none">
          {/* biome-ignore lint/performance/noImgElement: a local or stored listing photo, no image optimisation on purpose */}
          <img
            src={url}
            alt=""
            draggable={false}
            className="block max-h-[min(66dvh,720px)] max-w-full object-contain"
          />
          <div
            className="pointer-events-none absolute inset-x-0 top-0 bg-backdrop"
            style={{ height: pct(rect.y) }}
          />
          <div
            className="pointer-events-none absolute inset-x-0 bottom-0 bg-backdrop"
            style={{ height: pct(1 - bottom) }}
          />
          <div
            className="pointer-events-none absolute bg-backdrop"
            style={{ left: 0, top: pct(rect.y), width: pct(rect.x), height: pct(rect.height) }}
          />
          <div
            className="pointer-events-none absolute bg-backdrop"
            style={{ left: pct(right), top: pct(rect.y), width: pct(1 - right), height: pct(rect.height) }}
          />
          <div
            role="slider"
            tabIndex={0}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(rect.x * 100)}
            aria-valuetext={`${Math.round(rect.x * 100)}%, ${Math.round(rect.y * 100)}%`}
            aria-label={t("sell.photos.cropArea")}
            onPointerDown={start("move")}
            onPointerMove={move}
            onPointerUp={end}
            onPointerCancel={end}
            onKeyDown={(e) => {
              const step: Record<string, [number, number]> = {
                ArrowLeft: [-NUDGE, 0],
                ArrowRight: [NUDGE, 0],
                ArrowUp: [0, -NUDGE],
                ArrowDown: [0, NUDGE],
              };
              const delta = step[e.key];
              if (!delta) return;
              e.preventDefault();
              setRect((r) => ({
                ...r,
                x: clamp(r.x + delta[0], 0, 1 - r.width),
                y: clamp(r.y + delta[1], 0, 1 - r.height),
              }));
            }}
            className="absolute cursor-move border border-background outline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
            style={{ left: pct(rect.x), top: pct(rect.y), width: pct(rect.width), height: pct(rect.height) }}
          />
          {CORNERS.map((corner) => (
            <div
              key={corner.mode}
              onPointerDown={start(corner.mode)}
              onPointerMove={move}
              onPointerUp={end}
              onPointerCancel={end}
              aria-hidden
              className={cn("absolute h-8 w-8 -translate-x-1/2 -translate-y-1/2", corner.cursor)}
              style={{
                left: pct(rect.x + corner.left * rect.width),
                top: pct(rect.y + corner.top * rect.height),
              }}
            >
              <span
                className={cn(
                  "absolute h-4 w-4 border-background",
                  corner.top === 0 ? "top-1/2 border-t-[3px]" : "bottom-1/2 border-b-[3px]",
                  corner.left === 0 ? "left-1/2 border-l-[3px]" : "right-1/2 border-r-[3px]",
                )}
              />
            </div>
          ))}
        </div>
      </div>
      <div className="flex justify-center gap-md">
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          className="inline-flex h-10 min-w-28 items-center justify-center rounded-control bg-surface px-lg text-body-sm font-semibold hover:bg-pressed disabled:opacity-40"
        >
          {t("common.cancel")}
        </button>
        <button
          type="button"
          onClick={() => onDone(rect)}
          disabled={busy}
          aria-busy={busy}
          className="inline-flex h-10 min-w-28 items-center justify-center rounded-control bg-primary px-lg text-body-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-40"
        >
          {t("common.done")}
        </button>
      </div>
    </div>
  );
}

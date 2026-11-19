"use client";

import type { Photo } from "@vinty/shared";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { type KeyboardEvent, type MouseEvent, type PointerEvent, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { PHOTO_SWIPE_EVENT } from "@/components/item-dwell";
import { cn } from "@/lib/utils";

/** How far a click zooms in on the full-screen photo (D-062). */
const ZOOM = 2.5;

const clamp = (n: number) => Math.min(100, Math.max(0, n));

/**
 * The item photos (D-030, 4): the big photo with the small ones beside it on a laptop (below it on a phone). A small
 * photo switches the big one, the arrow keys and the arrow buttons step through, swiping works on a phone, and a click
 * on the big photo opens them full screen (the browser's own modal dialog: Escape closes it, focus stays inside).
 * There a click zooms in on that spot, the mouse (or a dragging finger) looks around, and a second click zooms out (D-062).
 * The first photo is in the HTML from the server. `sold` washes the photos out like the item card.
 */
export function PhotoGallery({ photos, title, sold }: { photos: Photo[]; title: string; sold: boolean }) {
  const { t, i18n } = useTranslation();
  const rtl = i18n.language === "he";
  const [index, setIndex] = useState(0);
  const viewer = useRef<HTMLDialogElement>(null);
  const touchStart = useRef<number | null>(null);
  // The zoomed spot in percent of the photo, null at normal size.
  const [zoom, setZoom] = useState<{ x: number; y: number } | null>(null);
  const press = useRef<{ x: number; y: number; zoomX: number; zoomY: number; moved: boolean } | null>(null);
  const total = photos.length;
  const current = photos[index];

  const go = (to: number) => {
    setZoom(null);
    setIndex(((to % total) + total) % total);
    // The feed learns from photos looked at (time on an item, see ItemDwell).
    window.dispatchEvent(new Event(PHOTO_SWIPE_EVENT));
  };
  const step = (direction: 1 | -1) => go(index + direction);
  // The button keeps the photo's size at normal zoom (the zoom is only a transform), so its box maps the pointer to a
  // spot on the photo.
  const spotAt = (e: { clientX: number; clientY: number; currentTarget: HTMLElement }) => {
    const box = e.currentTarget.getBoundingClientRect();
    return {
      x: clamp(((e.clientX - box.left) / box.width) * 100),
      y: clamp(((e.clientY - box.top) / box.height) * 100),
    };
  };
  const onZoomPointerDown = (e: PointerEvent<HTMLButtonElement>) => {
    press.current = { x: e.clientX, y: e.clientY, zoomX: zoom?.x ?? 50, zoomY: zoom?.y ?? 50, moved: false };
    if (zoom && e.pointerType !== "mouse") e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onZoomPointerMove = (e: PointerEvent<HTMLButtonElement>) => {
    const start = press.current;
    if (start && Math.hypot(e.clientX - start.x, e.clientY - start.y) > 6) start.moved = true;
    if (!zoom) return;
    // A mouse looks where it points. A finger drags the photo along with it.
    if (e.pointerType === "mouse") {
      setZoom(spotAt(e));
      return;
    }
    if (!start) return;
    const box = e.currentTarget.getBoundingClientRect();
    setZoom({
      x: clamp(start.zoomX - ((e.clientX - start.x) / ((ZOOM - 1) * box.width)) * 100),
      y: clamp(start.zoomY - ((e.clientY - start.y) / ((ZOOM - 1) * box.height)) * 100),
    });
  };
  const onZoomClick = (e: MouseEvent<HTMLButtonElement>) => {
    const dragged = press.current?.moved;
    press.current = null;
    if (dragged) return;
    if (zoom) setZoom(null);
    // From the keyboard (no pointer) it zooms in on the middle.
    else setZoom(e.detail === 0 ? { x: 50, y: 50 } : spotAt(e));
  };

  const alt = (n: number) => `${title}. ${t("listing.photoLabel", { n: n + 1, total })}`;

  const onKeyDown = (e: KeyboardEvent) => {
    if (total < 2) return;
    // The next photo is on the end side: to the right in English, to the left in Hebrew.
    if (e.key === "ArrowRight") step(rtl ? -1 : 1);
    else if (e.key === "ArrowLeft") step(rtl ? 1 : -1);
    else return;
    e.preventDefault();
  };

  if (!current) {
    return (
      <div className="aspect-[3/4] rounded-control bg-pressed max-md:-mx-lg max-md:rounded-none lg:h-[min(78vh,720px)] lg:w-auto" />
    );
  }

  const arrow = (direction: 1 | -1) => (
    <button
      type="button"
      onClick={() => step(direction)}
      aria-label={direction === 1 ? t("web.item.nextPhoto") : t("web.item.previousPhoto")}
      className={cn(
        "absolute top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-background text-text-1 hover:bg-pressed",
        direction === 1 ? "end-sm" : "start-sm",
      )}
    >
      {direction === 1 ? (
        <ChevronRight size={22} aria-hidden className="rtl:-scale-x-100" />
      ) : (
        <ChevronLeft size={22} aria-hidden className="rtl:-scale-x-100" />
      )}
    </button>
  );

  return (
    <section
      aria-roledescription="carousel"
      aria-label={t("web.item.photosLabel")}
      // biome-ignore lint/a11y/noNoninteractiveTabindex: the arrow keys step through the photos once the group has focus
      tabIndex={0}
      onKeyDown={onKeyDown}
      className="flex flex-col gap-md rounded-control focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary lg:flex-row-reverse lg:justify-end"
    >
      <div
        className="relative aspect-[3/4] min-w-0 overflow-hidden rounded-control max-md:-mx-lg max-md:rounded-none lg:h-[min(78vh,720px)] lg:w-auto"
        onTouchStart={(e) => {
          touchStart.current = e.touches[0]?.clientX ?? null;
        }}
        onTouchEnd={(e) => {
          const from = touchStart.current;
          touchStart.current = null;
          const to = e.changedTouches[0]?.clientX;
          if (from === null || to === undefined || total < 2 || Math.abs(to - from) < 40) return;
          // Dragging toward the start side shows the next photo.
          step(to < from !== rtl ? 1 : -1);
        }}
      >
        <button
          type="button"
          onClick={() => viewer.current?.showModal()}
          aria-label={`${t("web.item.openPhoto")}. ${t("listing.photoLabel", { n: index + 1, total })}`}
          className="block h-full w-full cursor-zoom-in"
        >
          {/* biome-ignore lint/performance/noImgElement: listing photos come ready sized, no image optimisation on purpose */}
          <img
            src={current.url}
            width={current.width}
            height={current.height}
            alt={alt(index)}
            fetchPriority={index === 0 ? "high" : undefined}
            decoding="async"
            className="h-full w-full object-cover"
          />
        </button>
        {sold ? <div className="pointer-events-none absolute inset-0 bg-background opacity-60" /> : null}
        {total > 1 ? (
          <>
            {arrow(-1)}
            {arrow(1)}
            <span className="pointer-events-none absolute bottom-sm end-sm rounded-full bg-background px-sm py-px text-card-meta font-semibold text-text-2">
              {t("listing.photoCount", { n: index + 1, total })}
            </span>
          </>
        ) : null}
      </div>

      {total > 1 ? (
        <ul className="flex gap-sm overflow-x-auto lg:max-h-[min(78vh,720px)] lg:w-[72px] lg:shrink-0 lg:flex-col lg:overflow-y-auto lg:overflow-x-hidden">
          {photos.map((photo, n) => (
            <li key={photo.key} className="shrink-0">
              <button
                type="button"
                onClick={() => go(n)}
                aria-label={t("listing.photoLabel", { n: n + 1, total })}
                aria-current={n === index ? "true" : undefined}
                className={cn(
                  "block h-[96px] w-[72px] overflow-hidden rounded-control bg-pressed",
                  n === index
                    ? "outline outline-2 -outline-offset-2 outline-primary"
                    : "opacity-80 hover:opacity-100",
                )}
              >
                {/* biome-ignore lint/performance/noImgElement: listing photos come ready sized, no image optimisation on purpose */}
                <img
                  src={photo.url}
                  alt=""
                  loading={n === 0 ? undefined : "lazy"}
                  decoding="async"
                  className="h-full w-full object-cover"
                />
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <dialog
        ref={viewer}
        aria-label={t("web.item.photosLabel")}
        onClose={() => setZoom(null)}
        className="m-0 h-dvh max-h-none w-dvw max-w-none border-0 bg-background p-0 backdrop:bg-backdrop"
      >
        <div className="relative flex h-full w-full items-center justify-center overflow-hidden p-lg">
          <button
            type="button"
            onPointerDown={onZoomPointerDown}
            onPointerMove={onZoomPointerMove}
            onClick={onZoomClick}
            aria-label={zoom ? t("web.item.zoomOut") : t("web.item.zoomIn")}
            aria-pressed={zoom !== null}
            className={cn("block", zoom ? "cursor-zoom-out touch-none" : "cursor-zoom-in")}
          >
            {/* biome-ignore lint/performance/noImgElement: listing photos come ready sized, no image optimisation on purpose */}
            <img
              src={current.url}
              alt={alt(index)}
              draggable={false}
              style={
                zoom ? { transform: `scale(${ZOOM})`, transformOrigin: `${zoom.x}% ${zoom.y}%` } : undefined
              }
              className="max-h-[calc(100dvh-32px)] max-w-[calc(100dvw-32px)] select-none object-contain transition-transform duration-200 ease-out motion-reduce:transition-none"
            />
          </button>
          <button
            type="button"
            onClick={() => viewer.current?.close()}
            aria-label={t("web.item.closeViewer")}
            className="absolute end-md top-md z-10 flex h-11 w-11 items-center justify-center rounded-full bg-pressed text-text-1 hover:bg-border"
          >
            <X size={22} aria-hidden />
          </button>
          {total > 1 ? (
            <>
              {arrow(-1)}
              {arrow(1)}
            </>
          ) : null}
        </div>
      </dialog>
    </section>
  );
}

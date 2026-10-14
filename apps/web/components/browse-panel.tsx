"use client";

import { ChevronDown, LayoutGrid } from "lucide-react";
import { usePathname } from "next/navigation";
import { type ReactNode, useCallback, useEffect, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { FOCUS_RING } from "@/lib/utils";

/**
 * The top bar's Browse button (D-030). It opens a panel under the button with the photo tiles, which the server
 * page passes in as `children` (so the tile links are in the HTML even while the panel is closed). Clicking outside
 * or pressing Escape closes it, and so does going to another page.
 */
export function BrowsePanel({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  const pathname = usePathname();

  // biome-ignore lint/correctness/useExhaustiveDependencies: closing when the page changes is the point
  useEffect(() => setOpen(false), [pathname]);

  // The tile photos wait lazily inside the closed panel. Once the page is idle, or the pointer or keyboard nears the
  // button, switch them to eager so they are already there when the panel opens.
  const panel = useRef<HTMLElement>(null);
  const warm = useCallback(() => {
    for (const img of panel.current?.querySelectorAll<HTMLImageElement>('img[loading="lazy"]') ?? []) {
      img.loading = "eager";
    }
  }, []);
  useEffect(() => {
    if (typeof window.requestIdleCallback === "function") {
      const id = window.requestIdleCallback(warm, { timeout: 4000 });
      return () => window.cancelIdleCallback(id);
    }
    const id = window.setTimeout(warm, 2000);
    return () => window.clearTimeout(id);
  }, [warm]);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        button.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={root} className="relative">
      <button
        ref={button}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
        onPointerEnter={warm}
        onFocus={warm}
        className={`inline-flex h-10 items-center gap-sm rounded-control px-md text-body-sm font-semibold text-text-1 hover:text-primary ${FOCUS_RING}`}
      >
        <LayoutGrid size={16} aria-hidden />
        {t("tabs.browse")}
        <ChevronDown size={14} aria-hidden className={open ? "rotate-180" : undefined} />
      </button>
      <section
        ref={panel}
        id={panelId}
        hidden={!open}
        aria-label={t("web.nav.browseTitle")}
        className="absolute start-0 top-full z-50 mt-sm w-[min(calc(100vw-48px),720px)] rounded-window border border-border bg-background p-lg shadow-lg"
      >
        {children}
      </section>
    </div>
  );
}

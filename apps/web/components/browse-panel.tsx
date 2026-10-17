"use client";

import { ChevronDown, LayoutGrid } from "lucide-react";
import { usePathname } from "next/navigation";
import { type ReactNode, useCallback, useEffect, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Chip } from "@/components/chip";
import { FOCUS_RING } from "@/lib/utils";

type Gender = "women" | "men";
const GENDER_KEY = "yadii-browse-gender";

/**
 * The top bar's Browse button (D-030). It opens a panel under the button with a Women and Men switch and the photo
 * tiles of the chosen side. The server passes both sides in (`women`, `men`) so every tile link is in the HTML even
 * while the panel is closed, and the switch only shows one. The last choice is remembered in this browser (D-052).
 * Clicking outside or pressing Escape closes the panel, and so does going to another page.
 */
export function BrowsePanel({ women, men }: { women: ReactNode; men: ReactNode }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  const pathname = usePathname();
  const [gender, setGender] = useState<Gender>("women");

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(GENDER_KEY);
      if (saved === "women" || saved === "men") setGender(saved);
    } catch {
      // Storage can be blocked, the panel then starts on Women every time.
    }
  }, []);

  const choose = (next: Gender) => {
    setGender(next);
    try {
      window.localStorage.setItem(GENDER_KEY, next);
    } catch {
      // Not remembered, the switch still works for this visit.
    }
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: closing when the page changes is the point
  useEffect(() => setOpen(false), [pathname]);

  // The tile photos wait lazily inside the closed panel. Once the page is idle, or the pointer or keyboard nears the
  // button, switch them to eager so they are already there when the panel opens.
  const panel = useRef<HTMLElement>(null);
  const warm = useCallback(() => {
    const shown = panel.current?.querySelector(`[data-gender="${gender}"]`);
    for (const img of shown?.querySelectorAll<HTMLImageElement>('img[loading="lazy"]') ?? []) {
      img.loading = "eager";
    }
  }, [gender]);
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
        <fieldset aria-label={t("web.nav.browseGender")} className="m-0 mb-md flex gap-sm border-0 p-0">
          <Chip
            label={t("browse.groups.women")}
            selected={gender === "women"}
            onClick={() => choose("women")}
          />
          <Chip label={t("browse.groups.men")} selected={gender === "men"} onClick={() => choose("men")} />
        </fieldset>
        <div data-gender="women" hidden={gender !== "women"}>
          {women}
        </div>
        <div data-gender="men" hidden={gender !== "men"}>
          {men}
        </div>
      </section>
    </div>
  );
}

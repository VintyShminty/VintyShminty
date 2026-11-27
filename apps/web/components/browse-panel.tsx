"use client";

import { useQuery } from "@tanstack/react-query";
import { shopsForSchema } from "@vinty/shared";
import { ChevronDown, LayoutGrid } from "lucide-react";
import { usePathname } from "next/navigation";
import { type ReactNode, useCallback, useEffect, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { BrowseExpandProvider, BrowseRest } from "@/components/browse-more";
import { Chip } from "@/components/chip";
import { useViewer } from "@/components/site-context";
import { clientApi } from "@/lib/api-client";
import { cn, FOCUS_RING } from "@/lib/utils";

const SIDE_KEY = "basta-browse-gender";

/** One chip of the panel and what it shows. `rest` is what More opens (Women and Men only). */
export type BrowseSide = { key: string; label: string; tiles: ReactNode; rest?: ReactNode };

/**
 * The top bar's Explore button (D-030). It opens a panel under the button with a row of chips, Women, Men and the other
 * main categories (D-065), and the photo tiles of the chosen one. The server passes every side in so every tile link
 * is in the HTML even while the panel is closed, and the chips only show one. The last choice is remembered in this
 * browser (D-052). Men comes before Women when the account shops only for men ("What do you shop for?"), and that side
 * is also the first one shown until something is remembered.
 * More opens the rest of that side's categories inside the panel instead of leaving the page, and the panel scrolls
 * when it is taller than the window (D-054). The panel fades and slides in and out (D-065), and simply appears and disappears with reduced motion.
 * Clicking outside or pressing Escape closes the panel, and so does going to another page.
 */
export function BrowsePanel({ sides }: { sides: BrowseSide[] }) {
  const { t } = useTranslation();
  const viewer = useViewer();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  const pathname = usePathname();
  const [saved, setSaved] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const toggle = useCallback(() => setExpanded((v) => !v), []);

  const shopsFor = useQuery({
    queryKey: ["shops-for"],
    queryFn: () => clientApi("/v1/me/personalisation/shops-for", { schema: shopsForSchema }),
    enabled: viewer !== null,
    staleTime: 60_000,
  });
  const picks = shopsFor.data?.shopsFor ?? [];
  const menFirst = viewer !== null && picks.includes("men") && !picks.includes("women");
  const ordered = menFirst
    ? [...sides.filter((s) => s.key === "men"), ...sides.filter((s) => s.key !== "men")]
    : sides;
  const side = sides.some((s) => s.key === saved) ? (saved as string) : (ordered[0]?.key ?? "women");

  useEffect(() => {
    try {
      setSaved(window.localStorage.getItem(SIDE_KEY));
    } catch {
      // Storage can be blocked, the panel then starts on the first chip every time.
    }
  }, []);

  const choose = (next: string) => {
    setSaved(next);
    try {
      window.localStorage.setItem(SIDE_KEY, next);
    } catch {
      // Not remembered, the chips still work for this visit.
    }
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: closing when the page changes is the point
  useEffect(() => setOpen(false), [pathname]);

  // A closed panel opens again at its first tiles. Folded once the closing fade is over, so it does not jump.
  useEffect(() => {
    if (open) return;
    const id = window.setTimeout(() => setExpanded(false), 200);
    return () => window.clearTimeout(id);
  }, [open]);

  // The tile photos wait lazily inside the closed panel. Once the page is idle, or the pointer or keyboard nears the
  // button, switch them to eager so they are already there when the panel opens.
  const panel = useRef<HTMLElement>(null);
  const warm = useCallback(() => {
    const shown = panel.current?.querySelector(`[data-side="${side}"]`);
    for (const img of shown?.querySelectorAll<HTMLImageElement>('img[loading="lazy"]') ?? []) {
      img.loading = "eager";
    }
  }, [side]);
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
        <ChevronDown
          size={14}
          aria-hidden
          className={cn(
            "transition-transform duration-200 motion-reduce:transition-none",
            open && "rotate-180",
          )}
        />
      </button>
      <section
        ref={panel}
        id={panelId}
        inert={!open}
        aria-label={t("web.nav.browseTitle")}
        className={cn(
          "absolute start-0 top-full z-50 mt-sm max-h-[calc(100vh-96px)] w-[min(calc(100vw-48px),720px)] origin-top overflow-y-auto overscroll-contain rounded-window border border-border bg-background p-lg shadow-lg",
          "transition-[opacity,transform,visibility] duration-200 ease-out motion-reduce:transition-none",
          open
            ? "visible translate-y-0 scale-100 opacity-100"
            : "invisible -translate-y-sm scale-[0.98] opacity-0",
        )}
      >
        <BrowseExpandProvider expanded={expanded} toggle={toggle}>
          <fieldset
            aria-label={t("web.nav.browseGender")}
            className="m-0 mb-md flex flex-wrap gap-sm border-0 p-0"
          >
            {ordered.map((s) => (
              <Chip key={s.key} label={s.label} selected={side === s.key} onClick={() => choose(s.key)} />
            ))}
          </fieldset>
          {sides.map((s) => (
            <div key={s.key} data-side={s.key} hidden={side !== s.key}>
              {s.tiles}
              {s.rest ? <BrowseRest title={t("browse.moreTitle")}>{s.rest}</BrowseRest> : null}
            </div>
          ))}
        </BrowseExpandProvider>
      </section>
    </div>
  );
}

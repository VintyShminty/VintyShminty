"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { photoAssistStatusSchema, suggestionsSchema } from "@vinty/shared";
import { Loader2, Search } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { clientApi } from "@/lib/api-client";
import { ASKED_PARAM, readAsked, shouldUnderstand } from "@/lib/search-assist";
import { understandSearch } from "@/lib/understand-search";
import { useDebounced } from "@/lib/use-debounced";
import { cn } from "@/lib/utils";

/**
 * The top bar's search field. It is a real form (Enter opens `/[lang]/search?q=`, even before the page's scripts have
 * loaded). While typing, suggestions drop down under the field from GET /v1/search/suggestions: arrow keys move
 * through them, Enter picks one, Escape closes the list. A brand suggestion opens the search with that brand chosen.
 */
export function SearchField({ lang }: { lang: string }) {
  // Reading the address needs a Suspense boundary on pages built ahead of time. The fallback is the plain form.
  return (
    <Suspense fallback={<SearchFieldShell lang={lang} />}>
      <LiveSearchField lang={lang} />
    </Suspense>
  );
}

function SearchFieldShell({ lang }: { lang: string }) {
  const { t } = useTranslation();
  return (
    <form action={`/${lang}/search`} className="flex h-full w-full items-center gap-sm px-lg">
      <Search size={17} className="shrink-0 text-text-3" aria-hidden />
      <input
        type="search"
        name="q"
        placeholder={t("search.placeholder")}
        aria-label={t("search.placeholder")}
        className="min-w-0 flex-1 bg-transparent text-body-sm text-text-1 outline-none placeholder:text-text-3"
      />
    </form>
  );
}

function LiveSearchField({ lang }: { lang: string }) {
  const { t } = useTranslation();
  const router = useRouter();
  const queryClient = useQueryClient();
  const address = useSearchParams();
  // After a search in plain words the box keeps what the visitor typed, not the words left over.
  const current = readAsked(address.get(ASKED_PARAM)) || (address.get("q") ?? "");
  const [busy, setBusy] = useState(false);
  const [text, setText] = useState(current);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const root = useRef<HTMLFormElement>(null);
  const listId = useId();
  const typed = useDebounced(text.trim(), 200);

  // A new search from elsewhere (back button, a suggestion) updates the field.
  useEffect(() => setText(current), [current]);

  // The same status the sell form reads (the answer is shared and cached). Off or unknown means plain search.
  const assistStatus = useQuery({
    queryKey: ["photo-assist"],
    queryFn: () => clientApi("/v1/sell/assist", { schema: photoAssistStatusSchema }),
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
  const understandOn = Boolean(assistStatus.data?.searchAssist);

  const suggestions = useQuery({
    queryKey: ["suggestions", lang, typed],
    queryFn: () =>
      clientApi(`/v1/search/suggestions?q=${encodeURIComponent(typed)}`, { schema: suggestionsSchema, lang }),
    enabled: typed.length > 0 && open,
    staleTime: 5 * 60_000,
  });
  const items = typed.length > 0 && text.trim() === typed ? (suggestions.data?.suggestions ?? []) : [];
  const showList = open && items.length > 0;

  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
  }, [open]);

  const go = (params: URLSearchParams) => {
    setOpen(false);
    setActive(-1);
    const qs = params.toString();
    router.push(`/${lang}/search${qs ? `?${qs}` : ""}`);
  };

  const pick = (index: number) => {
    const s = items[index];
    if (!s) return;
    const params = new URLSearchParams();
    if (s.kind === "brand" && s.brandId) params.append("brand", `${s.brandId}~${s.text}`);
    else params.set("q", s.text);
    setText(s.kind === "brand" ? "" : s.text);
    go(params);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      if (items.length === 0) return;
      e.preventDefault();
      setOpen(true);
      setActive(
        e.key === "ArrowDown"
          ? active + 1 >= items.length
            ? -1
            : active + 1
          : active <= -1
            ? items.length - 1
            : active - 1,
      );
    } else if (e.key === "Escape" && open) {
      e.preventDefault();
      setOpen(false);
      setActive(-1);
    } else if (e.key === "Enter" && showList && active >= 0) {
      e.preventDefault();
      pick(active);
    }
  };

  return (
    <form
      ref={root}
      action={`/${lang}/search`}
      className="flex h-full w-full items-center gap-sm px-lg"
      aria-busy={busy}
      onSubmit={async (e) => {
        // Enter on plain words goes through the router, so the page does not reload.
        e.preventDefault();
        if (busy) return;
        const q = text.trim();
        if (q && shouldUnderstand(q, understandOn)) {
          // A sentence is read first and the results page opens once, already with its filters (no empty flash).
          setBusy(true);
          setOpen(false);
          setActive(-1);
          const href = await understandSearch(q, lang as "en" | "he", t("filters.brand"), queryClient);
          setBusy(false);
          if (href) return router.push(href);
        }
        go(q ? new URLSearchParams({ q }) : new URLSearchParams());
      }}
    >
      {busy ? (
        <Loader2 size={17} className="shrink-0 animate-spin text-text-3" aria-hidden />
      ) : (
        <Search size={17} className="shrink-0 text-text-3" aria-hidden />
      )}
      <input
        type="search"
        name="q"
        value={text}
        readOnly={busy}
        autoComplete="off"
        placeholder={t("search.placeholder")}
        aria-label={t("search.placeholder")}
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={showList && active >= 0 ? `${listId}-${active}` : undefined}
        onChange={(e) => {
          setText(e.target.value);
          setOpen(true);
          setActive(-1);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        className="min-w-0 flex-1 bg-transparent text-body-sm text-text-1 outline-none placeholder:text-text-3"
      />
      <ul
        id={listId}
        // biome-ignore lint/a11y/noNoninteractiveElementToInteractiveRole: the listbox of the combobox pattern
        role="listbox"
        aria-label={t("web.search.suggestions")}
        hidden={!showList}
        className="absolute inset-x-0 top-full z-50 mt-xs overflow-hidden rounded-window border border-border bg-background py-xs shadow-lg"
      >
        {items.map((s, i) => (
          // biome-ignore lint/a11y/useFocusableInteractive: focus stays on the input (aria-activedescendant)
          // biome-ignore lint/a11y/useKeyWithClickEvents: the keys are handled on the input (Arrow keys and Enter)
          <li
            key={`${s.kind}-${s.text}-${s.brandId ?? s.categoryId ?? i}`}
            id={`${listId}-${i}`}
            // biome-ignore lint/a11y/noNoninteractiveElementToInteractiveRole: an option of the combobox listbox, picked with the keys on the input
            role="option"
            aria-selected={i === active}
            // The mouse press must not take focus from the field before the pick.
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => pick(i)}
            onMouseEnter={() => setActive(i)}
            className={cn(
              "flex cursor-pointer items-center justify-between gap-md px-lg py-sm text-body-sm text-text-1",
              i === active && "text-primary",
            )}
          >
            <span className="truncate">{s.text}</span>
            {s.kind !== "query" ? (
              <span className="shrink-0 text-small-label text-text-3">
                {s.kind === "brand"
                  ? t("filters.brand")
                  : (s.categoryName?.[lang as "en" | "he"] ?? t("filters.category"))}
              </span>
            ) : null}
          </li>
        ))}
      </ul>
    </form>
  );
}

"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import {
  brandSchema,
  formatPrice,
  type ListingSort,
  pageSchema,
  personalisationSizesSchema,
  searchCountSchema,
} from "@vinty/shared";
import { Check, ChevronDown, ChevronUp, Search } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useOptimistic,
  useRef,
  useState,
  useTransition,
} from "react";
import { useTranslation } from "react-i18next";
import { Chip } from "@/components/chip";
import { useViewer } from "@/components/site-context";
import { clientApi } from "@/lib/api-client";
import {
  type BrandChoice,
  clearedFilters,
  type FilterOptions,
  type Filters,
  hasFilters,
  listingQuery,
  parseFilters,
  writeFilters,
} from "@/lib/filters";
import { useDebounced } from "@/lib/use-debounced";
import { cn } from "@/lib/utils";

const SORTS = [
  ["relevance", "filters.sortRelevance"],
  ["newest", "filters.sortNewest"],
  ["price_asc", "filters.sortPriceLow"],
  ["price_desc", "filters.sortPriceHigh"],
] as const;

/** Whole shekels. */
const PRICE_RANGES: { min?: number; max?: number }[] = [
  { max: 50 },
  { min: 50, max: 100 },
  { min: 100, max: 200 },
  { min: 200 },
];

type Nav = {
  /** The address query as the visitor sees it, already updated while the page is still loading. */
  params: URLSearchParams;
  navigate: (next: URLSearchParams) => void;
  pending: boolean;
};
const NavContext = createContext<Nav | null>(null);

function useNav(): Nav {
  const nav = useContext(NavContext);
  if (!nav) throw new Error("FilterProvider is missing");
  return nav;
}

/**
 * Wraps a results page. Filter clicks change the address with `router.replace` (no jump, no new history entry per
 * click), inside a transition so the old results stay on screen until the new page is ready. The address query is
 * also kept as an "optimistic" value, so the panels show a click at once. `PendingFade` dims the grid meanwhile.
 */
export function FilterProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const [pending, startTransition] = useTransition();
  const [query, setQuery] = useOptimistic(search, (_current, next: string) => next);
  const params = useMemo(() => new URLSearchParams(query), [query]);
  const navigate = useCallback(
    (next: URLSearchParams) => {
      const qs = next.toString();
      startTransition(() => {
        setQuery(qs);
        router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
      });
    },
    [pathname, router, setQuery],
  );
  return <NavContext.Provider value={{ params, navigate, pending }}>{children}</NavContext.Provider>;
}

/** The grid keeps the previous results while the next ones load, dimmed a little. */
export function PendingFade({ children }: { children: ReactNode }) {
  const { pending } = useNav();
  return (
    <div aria-busy={pending} className={cn("transition-opacity duration-200", pending && "opacity-50")}>
      {children}
    </div>
  );
}

type PillKey = "sort" | "size" | "brand" | "condition" | "price" | "colour";

const toggle = (list: string[], id: string) =>
  list.includes(id) ? list.filter((x) => x !== id) : [...list, id];

type Translate = (key: string, options?: Record<string, unknown>) => string;

function priceLabel(min: number | undefined, max: number | undefined, t: Translate) {
  const from = min === undefined ? "" : formatPrice(min * 100, "ILS");
  const to = max === undefined ? "" : formatPrice(max * 100, "ILS");
  if (min !== undefined && max !== undefined) return t("filters.priceRange", { from, to });
  return min !== undefined ? t("filters.priceFrom", { from }) : t("filters.priceUpTo", { to });
}

/**
 * The filter row (D-030, 12 to 14): optional `leading` chips (Women, Men, Kids), then the pills Sort, Size, Brand,
 * Condition, Price and Colour. A pill opens a floating panel under it, one at a time, closed by a click outside or
 * Escape. Every click changes the address and so the results, and the panel shows how many pieces match.
 * Under the row sit the applied choices as chips with a cross, and Clear all. Used by Browse and Search.
 */
export function FilterBar({
  defaultSort,
  options,
  categoryIds,
  q,
  leading,
}: {
  defaultSort: ListingSort;
  options: FilterOptions;
  /** The categories the page searches (Browse). */
  categoryIds?: string[];
  /** The typed words (Search). */
  q?: string;
  leading?: ReactNode;
}) {
  const { t } = useTranslation();
  const { params, navigate } = useNav();
  const filters = useMemo(() => parseFilters(params, defaultSort), [params, defaultSort]);
  const [open, setOpen] = useState<PillKey | null>(null);
  const root = useRef<HTMLDivElement>(null);

  const set = (patch: Partial<Filters>) =>
    navigate(writeFilters(params, { ...filters, ...patch }, defaultSort));
  const countQuery = listingQuery(filters, { categoryIds, q });

  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => {
      if (!(e.target as Element).closest("[data-filter-pill]")) setOpen(null);
    };
    const onEscape = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(null);
      root.current?.querySelector<HTMLElement>(`[data-pill-button="${open}"]`)?.focus();
    };
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", onEscape);
    return () => {
      document.removeEventListener("pointerdown", away);
      document.removeEventListener("keydown", onEscape);
    };
  }, [open]);

  const sortLabel = t(SORTS.find(([key]) => key === filters.sort)?.[1] ?? SORTS[0][1]);
  const priceCount = filters.min !== undefined || filters.max !== undefined ? 1 : 0;
  const pills: {
    key: PillKey;
    label: string;
    count: number;
    width: string;
    body: ReactNode;
    clear?: () => void;
  }[] = [
    {
      key: "sort",
      label: `${t("web.filters.sort")}: ${sortLabel}`,
      count: 0,
      width: "w-[min(340px,calc(100vw-2rem))]",
      body: <SortBody value={filters.sort} onPick={(sort) => set({ sort })} />,
    },
    ...(options.sizeGroups.length > 0
      ? [
          {
            key: "size" as const,
            label: t("filters.size"),
            count: filters.sizeIds.length,
            width: "w-[min(640px,calc(100vw-2rem))]",
            body: (
              <SizeBody options={options} value={filters.sizeIds} onChange={(sizeIds) => set({ sizeIds })} />
            ),
            clear: () => set({ sizeIds: [] }),
          },
        ]
      : []),
    {
      key: "brand",
      label: t("filters.brand"),
      count: filters.brands.length,
      width: "w-[min(520px,calc(100vw-2rem))]",
      body: <BrandBody value={filters.brands} onChange={(brands) => set({ brands })} />,
      clear: () => set({ brands: [] }),
    },
    {
      key: "condition",
      label: t("filters.condition"),
      count: filters.conditionIds.length,
      width: "w-[min(400px,calc(100vw-2rem))]",
      body: (
        <div className="flex flex-col">
          {options.conditions.map((c) => (
            <CheckRow
              key={c.id}
              label={c.name}
              on={filters.conditionIds.includes(c.id)}
              onToggle={() => set({ conditionIds: toggle(filters.conditionIds, c.id) })}
            />
          ))}
        </div>
      ),
      clear: () => set({ conditionIds: [] }),
    },
    {
      key: "price",
      label: t("filters.price"),
      count: priceCount,
      width: "w-[min(440px,calc(100vw-2rem))]",
      body: <PriceBody min={filters.min} max={filters.max} onChange={(min, max) => set({ min, max })} />,
      clear: () => set({ min: undefined, max: undefined }),
    },
    {
      key: "colour",
      label: t("filters.colour"),
      count: filters.colourIds.length,
      width: "w-[min(440px,calc(100vw-2rem))]",
      body: (
        <div className="grid grid-cols-2 gap-x-lg gap-y-xs sm:grid-cols-3">
          {options.colours.map((c) => {
            const on = filters.colourIds.includes(c.id);
            return (
              <button
                key={c.id}
                type="button"
                aria-pressed={on}
                onClick={() => set({ colourIds: toggle(filters.colourIds, c.id) })}
                className="flex items-center gap-sm rounded-control p-xs text-start text-body-sm text-text-1 hover:text-primary focus-visible:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary"
              >
                <span
                  aria-hidden
                  style={{ backgroundColor: c.swatch }}
                  className={cn(
                    "h-[26px] w-[26px] shrink-0 rounded-full border border-border",
                    on && "outline outline-2 outline-offset-2 outline-primary",
                  )}
                />
                {c.name}
              </button>
            );
          })}
        </div>
      ),
      clear: () => set({ colourIds: [] }),
    },
  ];

  // The applied choices, one chip each.
  const applied: { key: string; label: string; remove: () => void }[] = [
    ...filters.sizeIds.map((id) => ({
      key: `size-${id}`,
      label: options.sizeLabels[id] ?? t("filters.size"),
      remove: () => set({ sizeIds: filters.sizeIds.filter((x) => x !== id) }),
    })),
    ...filters.brands.map((b) => ({
      key: `brand-${b.id}`,
      label: b.name,
      remove: () => set({ brands: filters.brands.filter((x) => x.id !== b.id) }),
    })),
    ...filters.conditionIds.map((id) => ({
      key: `condition-${id}`,
      label: options.conditions.find((c) => c.id === id)?.name ?? t("filters.condition"),
      remove: () => set({ conditionIds: filters.conditionIds.filter((x) => x !== id) }),
    })),
    ...filters.colourIds.map((id) => ({
      key: `colour-${id}`,
      label: options.colours.find((c) => c.id === id)?.name ?? t("filters.colour"),
      remove: () => set({ colourIds: filters.colourIds.filter((x) => x !== id) }),
    })),
    ...(priceCount > 0
      ? [
          {
            key: "price",
            label: priceLabel(filters.min, filters.max, t),
            remove: () => set({ min: undefined, max: undefined }),
          },
        ]
      : []),
  ];

  return (
    <section ref={root} aria-label={t("filters.title")}>
      <div className="flex flex-wrap items-center gap-sm">
        {leading}
        {pills.map((pill) => (
          <FilterPill
            key={pill.key}
            id={pill.key}
            label={pill.label}
            count={pill.count}
            open={open === pill.key}
            onToggle={() => setOpen(open === pill.key ? null : pill.key)}
          >
            <Panel
              label={pill.label}
              width={pill.width}
              footer={
                <div className="mt-lg flex items-center justify-between gap-lg border-t border-border-subtle pt-md">
                  {pill.clear ? (
                    <button
                      type="button"
                      onClick={pill.clear}
                      disabled={pill.count === 0}
                      className="text-body-sm font-semibold text-primary underline underline-offset-4 disabled:pointer-events-none disabled:opacity-40"
                    >
                      {t("web.filters.clear")}
                    </button>
                  ) : (
                    <span />
                  )}
                  <PieceCount query={countQuery} />
                </div>
              }
            >
              {pill.body}
            </Panel>
          </FilterPill>
        ))}
      </div>
      {applied.length > 0 ? (
        <div className="mt-md flex flex-wrap items-center gap-sm">
          {applied.map((chip) => (
            <Chip
              key={chip.key}
              label={chip.label}
              applied
              onClick={chip.remove}
              ariaLabel={t("filters.removeFilter", { name: chip.label })}
            />
          ))}
          {hasFilters(filters) ? (
            <button
              type="button"
              onClick={() => navigate(writeFilters(params, clearedFilters(filters), defaultSort))}
              className="ms-xs text-body-sm font-semibold text-primary underline underline-offset-4"
            >
              {t("filters.clearAll")}
            </button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

/** One pill. The panel (its child) shows only while it is open. */
function FilterPill({
  id,
  label,
  count,
  open,
  onToggle,
  children,
}: {
  id: PillKey;
  label: string;
  count: number;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  const panelId = useId();
  const Chevron = open ? ChevronUp : ChevronDown;
  return (
    <div data-filter-pill className="relative">
      <button
        type="button"
        data-pill-button={id}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={onToggle}
        className={cn(
          "inline-flex h-[29px] items-center gap-xs whitespace-nowrap rounded-full border px-[13px] text-text-1 hover:bg-pressed",
          open
            ? "border-[1.5px] border-primary bg-pressed"
            : count > 0
              ? "border-[1.5px] border-primary bg-background"
              : "border-text-4 bg-background",
        )
          // After cn() on purpose: tailwind-merge would drop our type scale name as a clashing colour.
          .concat(" text-body-sm")}
      >
        {label}
        {count > 0 ? (
          <span className="inline-grid h-[18px] min-w-[18px] place-items-center rounded-full bg-primary px-[5px] text-[11px] font-bold text-primary-foreground">
            {count}
          </span>
        ) : null}
        <Chevron size={14} aria-hidden />
      </button>
      {open ? <div id={panelId}>{children}</div> : null}
    </div>
  );
}

/**
 * The floating panel: under its pill, starting at the pill's start edge (so it opens toward the end side, which is
 * the right in English and the left in Hebrew), nudged back inside the window if it would stick out.
 */
function Panel({
  label,
  width,
  footer,
  children,
}: {
  label: string;
  width: string;
  footer: ReactNode;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.transform = "";
    const rect = el.getBoundingClientRect();
    const margin = 16;
    const viewport = document.documentElement.clientWidth;
    let dx = 0;
    if (rect.right > viewport - margin) dx = viewport - margin - rect.right;
    if (rect.left + dx < margin) dx = margin - rect.left;
    if (dx) el.style.transform = `translateX(${Math.round(dx)}px)`;
  }, []);
  return (
    <div
      ref={ref}
      role="dialog"
      aria-label={label}
      className={cn(
        "absolute start-0 top-full z-30 mt-sm max-h-[70vh] overflow-y-auto rounded-window border border-border bg-background p-xl shadow-lg",
        width,
      )}
    >
      {children}
      {footer}
    </div>
  );
}

function PieceCount({ query }: { query: string }) {
  const { t, i18n } = useTranslation();
  const count = useQuery({
    queryKey: ["listing-count", i18n.language, query],
    queryFn: () =>
      clientApi(`/v1/listings/count?${query}`, { schema: searchCountSchema, lang: i18n.language }),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });
  return (
    <span className="text-body-sm text-text-3" aria-live="polite">
      {count.data ? (
        <b className="font-bold text-text-1">
          {count.data.totalCapped
            ? t("web.filters.piecesCapped", { count: count.data.total })
            : t("web.filters.pieces", { count: count.data.total })}
        </b>
      ) : null}
    </span>
  );
}

/** A checkbox row. */
function CheckRow({ label, on, onToggle }: { label: string; on: boolean; onToggle: () => void }) {
  return (
    // biome-ignore lint/a11y/useSemanticElements: a styled toggle row, the checkbox role is the right pattern
    <button
      type="button"
      role="checkbox"
      aria-checked={on}
      onClick={onToggle}
      className="flex items-center gap-md rounded-control px-xs py-[7px] text-start text-body-sm text-text-1 hover:text-primary focus-visible:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary"
    >
      <span
        aria-hidden
        className={cn(
          "grid h-[18px] w-[18px] shrink-0 place-items-center rounded-[5px] border-[1.5px]",
          on ? "border-primary bg-primary text-primary-foreground" : "border-text-4",
        )}
      >
        {on ? <Check size={12} strokeWidth={3} /> : null}
      </span>
      {label}
    </button>
  );
}

function SortBody({ value, onPick }: { value: ListingSort; onPick: (sort: ListingSort) => void }) {
  const { t } = useTranslation();
  return (
    <div role="radiogroup" className="flex flex-col">
      {SORTS.map(([key, text]) => {
        const on = value === key;
        return (
          // biome-ignore lint/a11y/useSemanticElements: styled radio rows, the radio role is the right pattern
          <button
            key={key}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onPick(key)}
            className="flex items-center gap-md rounded-control px-xs py-[7px] text-start text-body-sm text-text-1 hover:text-primary focus-visible:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary"
          >
            <span
              aria-hidden
              className={cn(
                "h-[18px] w-[18px] shrink-0 rounded-full",
                on ? "border-[6px] border-primary bg-background" : "border-[1.5px] border-text-4",
              )}
            />
            {t(text)}
          </button>
        );
      })}
    </div>
  );
}

function SizeBody({
  options,
  value,
  onChange,
}: {
  options: FilterOptions;
  value: string[];
  onChange: (next: string[]) => void;
}) {
  const { t, i18n } = useTranslation();
  const viewer = useViewer();
  const mine = useQuery({
    queryKey: ["my-sizes"],
    queryFn: () =>
      clientApi("/v1/me/personalisation/sizes", { schema: personalisationSizesSchema, lang: i18n.language }),
    enabled: Boolean(viewer),
    staleTime: 60_000,
  });
  const mineIds = viewer ? (mine.data?.sizeIds ?? []) : [];
  const mineOn = mineIds.length > 0 && mineIds.every((id) => value.includes(id));
  const mineText = mineIds
    .slice(0, 3)
    .map((id) => options.sizeLabels[id])
    .filter(Boolean)
    .join(", ");
  return (
    <div className="flex flex-col gap-lg">
      {mineIds.length > 0 ? (
        <div>
          <p className="mb-sm text-section-label font-bold uppercase text-text-3">
            {t("web.filters.mySizes")}
          </p>
          <Chip
            label={mineText ? `${t("web.filters.mySizes")} · ${mineText}` : t("web.filters.mySizes")}
            selected={mineOn}
            onClick={() =>
              onChange(
                mineOn ? value.filter((id) => !mineIds.includes(id)) : [...new Set([...value, ...mineIds])],
              )
            }
          />
        </div>
      ) : null}
      {options.sizeGroups.map((group) => (
        <div key={group.id}>
          <p className="mb-sm text-section-label font-bold uppercase text-text-3">{group.name}</p>
          <div className="flex flex-wrap gap-sm">
            {group.sizes.map((size) => (
              <Chip
                key={size.id}
                label={size.label}
                selected={value.includes(size.id)}
                onClick={() => onChange(toggle(value, size.id))}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

const brandsPageSchema = pageSchema(brandSchema);

function BrandBody({ value, onChange }: { value: BrandChoice[]; onChange: (next: BrandChoice[]) => void }) {
  const { t, i18n } = useTranslation();
  const [text, setText] = useState("");
  const q = useDebounced(text.trim(), 250);
  const brands = useQuery({
    queryKey: ["brands", q],
    queryFn: () =>
      clientApi(`/v1/brands?limit=40&q=${encodeURIComponent(q)}`, {
        schema: brandsPageSchema,
        lang: i18n.language,
      }),
    placeholderData: keepPreviousData,
    staleTime: 10 * 60_000,
  });
  const found: BrandChoice[] = (brands.data?.items ?? []).map((b) => ({ id: b.id, name: b.name }));
  // With no words typed, the chosen brands come first, then the popular ones.
  const rows = q === "" ? [...value, ...found.filter((b) => !value.some((v) => v.id === b.id))] : found;
  const inputId = useId();
  return (
    <div>
      <label
        htmlFor={inputId}
        className="flex h-10 items-center gap-sm rounded-control border border-border bg-surface px-md focus-within:border-primary"
      >
        <Search size={16} className="shrink-0 text-text-3" aria-hidden />
        <span className="sr-only">{t("filters.searchBrands")}</span>
        <input
          id={inputId}
          type="search"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={t("filters.searchBrands")}
          className="min-w-0 flex-1 bg-transparent text-body-sm text-text-1 outline-none placeholder:text-text-3"
        />
      </label>
      <p className="mb-xs mt-md text-section-label font-bold uppercase text-text-3">
        {q === "" ? t("filters.popularBrands") : t("filters.brand")}
      </p>
      {rows.length === 0 && !brands.isPending ? (
        <p className="py-md text-body-sm text-text-3">{t("filters.noBrands")}</p>
      ) : (
        <div className="grid max-h-[260px] grid-cols-1 overflow-y-auto sm:grid-cols-2">
          {rows.map((b) => {
            const on = value.some((v) => v.id === b.id);
            return (
              <CheckRow
                key={b.id}
                label={b.name}
                on={on}
                onToggle={() => onChange(on ? value.filter((v) => v.id !== b.id) : [...value, b])}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

function PriceBody({
  min,
  max,
  onChange,
}: {
  min: number | undefined;
  max: number | undefined;
  onChange: (min: number | undefined, max: number | undefined) => void;
}) {
  const { t } = useTranslation();
  const [from, setFrom] = useState(min === undefined ? "" : String(min));
  const [to, setTo] = useState(max === undefined ? "" : String(max));
  // A range chip or a removed chip changes the address, so the fields follow it.
  useEffect(() => {
    setFrom(min === undefined ? "" : String(min));
    setTo(max === undefined ? "" : String(max));
  }, [min, max]);

  const parse = (s: string) => (/^\d{1,7}$/.test(s.trim()) ? Number(s) : undefined);
  const nextMin = parse(from);
  const nextMax = parse(to);
  const invalid = nextMin !== undefined && nextMax !== undefined && nextMin > nextMax;
  const commit = () => {
    if (invalid || (nextMin === min && nextMax === max)) return;
    onChange(nextMin, nextMax);
  };
  // Typing applies after a pause, so the results follow without a button.
  const settled = useDebounced(`${from}|${to}`, 600);
  // biome-ignore lint/correctness/useExhaustiveDependencies: only the settled text should trigger it
  useEffect(commit, [settled]);

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
          onChange={(e) => set(e.target.value.replace(/[^\d]/g, ""))}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
          }}
          aria-invalid={invalid}
          className="min-w-0 flex-1 bg-transparent text-body-sm text-text-1 outline-none"
        />
      </span>
    </label>
  );

  return (
    <div>
      <div className="flex flex-wrap gap-sm">
        {PRICE_RANGES.map((range) => {
          const on = range.min === min && range.max === max;
          return (
            <Chip
              key={`${range.min ?? ""}-${range.max ?? ""}`}
              label={priceLabel(range.min, range.max, t)}
              selected={on}
              onClick={() => (on ? onChange(undefined, undefined) : onChange(range.min, range.max))}
            />
          );
        })}
      </div>
      <div className="mt-lg flex items-end gap-md">
        {field(from, setFrom, t("filters.priceMin"))}
        {field(to, setTo, t("filters.priceMax"))}
      </div>
      {invalid ? (
        <p role="alert" className="mt-sm text-body-sm text-error">
          {t("filters.priceInvalid")}
        </p>
      ) : null}
    </div>
  );
}

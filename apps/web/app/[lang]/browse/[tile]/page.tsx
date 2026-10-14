import { findBrowseTile, searchPageSchema, type TileGroup, tileGroups } from "@vinty/shared";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CategoryVisit } from "@/components/category-visit";
import { Chip } from "@/components/chip";
import { EmptyState } from "@/components/empty-state";
import { FilterBar, FilterProvider, PendingFade } from "@/components/filter-bar";
import { InfiniteItemGrid } from "@/components/infinite-item-grid";
import { PhotoTile } from "@/components/photo-tile";
import { serverApi } from "@/lib/api";
import { pagePath } from "@/lib/feed-url";
import { buildFilterOptions, isGroup, listingQuery, paramValue, parseFilters } from "@/lib/filters";
import { getT, isLang, type Lang } from "@/lib/i18n";
import { getReference } from "@/lib/reference";
import { alternatesFor } from "@/lib/seo";
import { pageCategoryIds, type SubType, sizeGroupIdsFor, subTypeIds, subTypesOf } from "@/lib/tile-types";

type SearchParams = Record<string, string | string[] | undefined>;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string; tile: string }>;
}): Promise<Metadata> {
  const { lang, tile } = await params;
  const found = findBrowseTile(tile);
  if (!isLang(lang) || !found) return { title: "Vinty" };
  const t = getT(lang);
  const name = t(`browse.tiles.${found.key}`);
  return {
    title: `${name} | Vinty`,
    description: t("web.browse.tileMetaDescription", { name }),
    // Filters and types in the address are views of the same page, so the canonical address has none of them.
    alternates: alternatesFor(lang, `/browse/${found.key}`),
  };
}

function toParams(sp: SearchParams): URLSearchParams {
  const out = new URLSearchParams();
  for (const [key, value] of Object.entries(sp)) {
    for (const v of Array.isArray(value) ? value : value === undefined ? [] : [value]) out.append(key, v);
  }
  return out;
}

/** The cover of the newest active item in a type, for its tile in the strip. Cached for five minutes. */
async function coverOf(lang: Lang, ids: string[]): Promise<string | null> {
  const page = await serverApi(`/v1/listings?sort=newest&categoryIds=${ids.join(",")}&limit=1`, {
    lang,
    schema: searchPageSchema,
    anonymous: true,
    revalidate: 300,
  }).catch(() => null);
  return page?.items[0]?.cover?.url ?? null;
}

/**
 * One Browse tile's results (D-030, 12 to 14): the breadcrumb, the title and count, a strip of photo tiles for its
 * types, Women/Men/Kids chips and the filter pills, then the item grid. Everything chosen lives in the address
 * (`?group=`, `?type=`, `?size=`...), so the server builds the first page for Google and a shared link opens the same view.
 */
export default async function TilePage({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string; tile: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { lang, tile: tileKey } = await params;
  if (!isLang(lang)) notFound();
  const tile = findBrowseTile(tileKey);
  if (!tile) notFound();
  // The address parts and the (cached) reference data are asked at once.
  const [sp, reference] = await Promise.all([searchParams, getReference(lang).catch(() => null)]);
  const t = getT(lang);
  const tileName = t(`browse.tiles.${tile.key}`);

  if (!reference) {
    return (
      <main className="mx-auto max-w-[1280px] px-lg pb-2xl pt-xl md:px-xl lg:px-[48px] xl:px-[80px]">
        <h1 className="text-title font-bold text-text-1">{tileName}</h1>
        <EmptyState title={t("errors.general")} />
      </main>
    );
  }

  const groups = tileGroups(tile);
  const groupParam = paramValue(sp, "group");
  const group: TileGroup | undefined =
    isGroup(groupParam) && groups.length > 1 && groups.includes(groupParam) ? groupParam : undefined;
  const allSubs = subTypesOf(reference.categories, tile);
  const subs = allSubs.filter((s) => subTypeIds(s, group).length > 0);
  const showStrip = subs.length > 1;
  const typeParam = paramValue(sp, "type");
  const sub: SubType | undefined = showStrip ? subs.find((s) => s.key === typeParam) : undefined;
  const subName = sub?.name[lang];

  const categoryIds = pageCategoryIds(reference.categories, tile, group, sub);
  const filters = parseFilters(sp, "newest");
  const endpoint = `/v1/listings?${listingQuery(filters, { categoryIds })}`;
  const [firstPage, covers] = await Promise.all([
    serverApi(pagePath(endpoint), { lang, schema: searchPageSchema }).catch(() => null),
    showStrip ? Promise.all(subs.map((s) => coverOf(lang, s.ids))) : Promise.resolve([]),
  ]);

  const options = buildFilterOptions(
    reference,
    lang,
    sizeGroupIdsFor(reference.categories, pageCategoryIds(reference.categories, tile, group, undefined)),
  );

  const base = `/${lang}/browse/${tile.key}`;
  const href = (change: (next: URLSearchParams) => void) => {
    const next = toParams(sp);
    change(next);
    const qs = next.toString();
    return qs ? `${base}?${qs}` : base;
  };
  const groupHref = (g: TileGroup | undefined) =>
    href((next) => {
      next.delete("type");
      if (g) next.set("group", g);
      else next.delete("group");
    });
  const typeHref = (key: string | undefined) =>
    href((next) => {
      if (key) next.set("type", key);
      else next.delete("type");
    });

  const total = firstPage?.total ?? 0;
  const count = firstPage
    ? firstPage.totalCapped
      ? t("search.resultsCapped", { count: total })
      : t("search.results", { count: total })
    : null;

  return (
    <main className="mx-auto max-w-[1280px] px-lg pb-2xl pt-xl md:px-xl lg:px-[48px] xl:px-[80px]">
      <CategoryVisit key={tile.key} categoryIds={categoryIds} />
      <nav aria-label={t("web.browse.breadcrumb")} className="text-body-sm text-text-3">
        <ol className="flex flex-wrap items-center gap-xs">
          <li>
            <Link href={`/${lang}/browse`} className="underline underline-offset-4 hover:text-text-1">
              {t("tabs.browse")}
            </Link>
          </li>
          <li aria-hidden>›</li>
          <li>
            {subName ? (
              <Link href={typeHref(undefined)} className="underline underline-offset-4 hover:text-text-1">
                {tileName}
              </Link>
            ) : (
              <span aria-current="page">{tileName}</span>
            )}
          </li>
          {subName ? (
            <>
              <li aria-hidden>›</li>
              <li aria-current="page">{subName}</li>
            </>
          ) : null}
        </ol>
      </nav>

      <div className="mt-xs flex flex-wrap items-baseline gap-x-md gap-y-xs">
        <h1 className="text-title font-bold text-text-1">{subName ?? tileName}</h1>
        {count ? (
          <p className="text-body-sm text-text-3" aria-live="polite">
            {count}
          </p>
        ) : null}
      </div>

      {showStrip ? (
        <nav
          aria-label={t("web.browse.typesLabel")}
          className="-mx-lg mt-lg flex gap-md overflow-x-auto px-lg pb-xs md:mx-0 md:px-0"
        >
          <PhotoTile
            href={typeHref(undefined)}
            replace
            scroll={false}
            plain
            selected={!sub}
            label={t("filters.allIn", { name: tileName })}
            className="h-[100px] w-[150px] shrink-0"
          />
          {subs.map((s, i) => (
            <PhotoTile
              key={s.key}
              href={typeHref(s.key)}
              replace
              scroll={false}
              selected={sub?.key === s.key}
              label={s.name[lang]}
              imageUrl={covers[i] ?? undefined}
              className="h-[100px] w-[150px] shrink-0"
            />
          ))}
        </nav>
      ) : null}

      <div className="mt-lg">
        <FilterProvider>
          <FilterBar
            defaultSort="newest"
            options={options}
            categoryIds={categoryIds}
            leading={
              groups.length > 1 ? (
                <>
                  <Chip
                    href={groupHref(undefined)}
                    replace
                    scroll={false}
                    selected={!group}
                    label={t("browse.all")}
                  />
                  {groups.map((g) => (
                    <Chip
                      key={g}
                      href={groupHref(g)}
                      replace
                      scroll={false}
                      selected={group === g}
                      label={t(`browse.groups.${g}`)}
                    />
                  ))}
                  <span aria-hidden className="mx-xs h-6 w-px bg-border" />
                </>
              ) : null
            }
          />
          <div className="mt-xl">
            <PendingFade>
              <InfiniteItemGrid
                key={endpoint}
                endpoint={endpoint}
                kind="listings"
                firstPage={firstPage}
                empty={<EmptyState title={t("search.noResults")} message={t("search.noResultsHint")} />}
              />
            </PendingFade>
          </div>
        </FilterProvider>
      </div>
    </main>
  );
}

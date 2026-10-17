const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Where tapping a brand name leads: the search page with that brand as the filter (`?brand=<id>~Zara`, the same
 * address the filter bar writes, so the brand shows as a chip). A brand the seller only typed has no id, so it
 * becomes a search for the name as words instead.
 */
export function brandSearchHref(lang: string, brand: { id?: string | null; name: string }): string {
  const p = new URLSearchParams();
  if (brand.id && UUID.test(brand.id)) p.set("brand", `${brand.id}~${brand.name}`);
  else p.set("q", brand.name);
  return `/${lang}/search?${p.toString()}`;
}

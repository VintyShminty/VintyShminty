import { notFound } from "next/navigation";
import { PlaceholderPage } from "@/components/placeholder-page";
import { getT, isLang } from "@/lib/i18n";

// A placeholder: the search results page (filters, sort, Items and Sellers) is built next.
export default async function SearchPage({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string }>;
  searchParams: Promise<{ q?: string | string[] }>;
}) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  const { q } = await searchParams;
  const query = (Array.isArray(q) ? q[0] : q)?.trim() ?? "";
  const t = getT(lang);
  return (
    <PlaceholderPage
      lang={lang}
      title={t("web.search.resultsFor", { q: query })}
      note={t("web.search.soon")}
    />
  );
}

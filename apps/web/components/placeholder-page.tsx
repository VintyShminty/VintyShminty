import { getT, type Lang } from "@/lib/i18n";

/** A page that is not built yet: a heading and one line saying it comes soon. Later steps replace the page that uses it. */
export function PlaceholderPage({
  lang,
  title,
  note,
}: {
  lang: Lang;
  title: string;
  /** Replaces the default "This page is coming soon." line. */
  note?: string;
}) {
  const t = getT(lang);
  return (
    <div className="mx-auto max-w-[1400px] px-lg pb-2xl pt-xl md:px-xl">
      <h1 className="text-item-name font-bold text-text-1">{title}</h1>
      <p className="mt-md text-body text-text-3">{note ?? t("web.soon")}</p>
    </div>
  );
}

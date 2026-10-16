import { hiddenListSchema, personalisationSizesSchema, shopsForSchema } from "@vinty/shared";
import { notFound } from "next/navigation";
import { SettingsPage } from "@/components/settings/page-head";
import { ShoppingPreferences } from "@/components/settings/shopping-preferences";
import { serverApi } from "@/lib/api";
import { buildFilterOptions } from "@/lib/filters";
import { getT, isLang } from "@/lib/i18n";
import { getReference } from "@/lib/reference";

export default async function Page({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  const t = getT(lang);
  const [reference, sizes, hidden, shopsFor] = await Promise.all([
    getReference(lang).catch(() => null),
    serverApi("/v1/me/personalisation/sizes", { lang, schema: personalisationSizesSchema }).catch(() => null),
    serverApi("/v1/feed/hidden", { lang, schema: hiddenListSchema }).catch(() => null),
    serverApi("/v1/me/personalisation/shops-for", { lang, schema: shopsForSchema }).catch(() => null),
  ]);
  return (
    <SettingsPage title={t("shopping.title")}>
      {reference && sizes && hidden && shopsFor ? (
        <ShoppingPreferences
          lang={lang}
          groups={buildFilterOptions(reference, lang, null).sizeGroups.filter((g) => g.sizes.length > 0)}
          initialSizeIds={sizes.sizeIds}
          initialHidden={hidden.items}
          initialShopsFor={shopsFor.shopsFor}
        />
      ) : (
        <p className="text-body-sm text-error">{t("errors.loadFailed")}</p>
      )}
    </SettingsPage>
  );
}

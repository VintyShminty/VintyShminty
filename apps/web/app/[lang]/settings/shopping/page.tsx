import { hiddenListSchema, personalisationSizesSchema } from "@vinty/shared";
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
  const [reference, sizes, hidden] = await Promise.all([
    getReference(lang).catch(() => null),
    serverApi("/v1/me/personalisation/sizes", { lang, schema: personalisationSizesSchema }).catch(() => null),
    serverApi("/v1/feed/hidden", { lang, schema: hiddenListSchema }).catch(() => null),
  ]);
  return (
    <SettingsPage title={t("shopping.title")}>
      {reference && sizes && hidden ? (
        <ShoppingPreferences
          lang={lang}
          groups={buildFilterOptions(reference, lang, null).sizeGroups.filter((g) => g.sizes.length > 0)}
          initialSizeIds={sizes.sizeIds}
          initialHidden={hidden.items}
        />
      ) : (
        <p className="text-body-sm text-error">{t("errors.loadFailed")}</p>
      )}
    </SettingsPage>
  );
}

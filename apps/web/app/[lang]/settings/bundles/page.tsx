import { bundleLadderSchema } from "@vinty/shared";
import { notFound } from "next/navigation";
import { BundleLadderForm } from "@/components/settings/bundle-ladder-form";
import { SettingsPage } from "@/components/settings/page-head";
import { serverApi } from "@/lib/api";
import { getT, isLang } from "@/lib/i18n";

export default async function Page({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  const t = getT(lang);
  const ladder = await serverApi("/v1/me/bundle-ladder", { lang, schema: bundleLadderSchema }).catch(
    () => null,
  );
  return (
    <SettingsPage title={t("bundleSettings.title")}>
      {ladder ? (
        <BundleLadderForm initial={ladder} />
      ) : (
        <p className="text-body-sm text-error">{t("bundleSettings.loadFailed")}</p>
      )}
    </SettingsPage>
  );
}

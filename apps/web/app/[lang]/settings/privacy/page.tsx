import { userSettingsSchema } from "@vinty/shared";
import { notFound } from "next/navigation";
import { SettingsPage } from "@/components/settings/page-head";
import { PrivacySwitches } from "@/components/settings/privacy-switches";
import { serverApi } from "@/lib/api";
import { getT, isLang } from "@/lib/i18n";

export default async function Page({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  const t = getT(lang);
  const settings = await serverApi("/v1/me/settings", { lang, schema: userSettingsSchema }).catch(() => null);
  return (
    <SettingsPage title={t("privacy.title")}>
      {settings ? (
        <PrivacySwitches initial={settings} />
      ) : (
        <p className="text-body-sm text-error">{t("errors.loadFailed")}</p>
      )}
    </SettingsPage>
  );
}

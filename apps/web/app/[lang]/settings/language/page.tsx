import { notFound } from "next/navigation";
import { LanguagePicker } from "@/components/settings/language-picker";
import { SettingsPage } from "@/components/settings/page-head";
import { getT, isLang } from "@/lib/i18n";

export default async function Page({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  const t = getT(lang);
  return (
    <SettingsPage title={t("settings.language")}>
      <LanguagePicker lang={lang} />
    </SettingsPage>
  );
}

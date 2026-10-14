import { notFound } from "next/navigation";
import { SettingsPage } from "@/components/settings/page-head";
import { SecurityList } from "@/components/settings/security-list";
import { getT, isLang } from "@/lib/i18n";

export default async function Page({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  const t = getT(lang);
  return (
    <SettingsPage title={t("security.title")}>
      <h2 className="mb-sm text-section-label font-bold uppercase text-text-3">{t("security.sessions")}</h2>
      <SecurityList />
    </SettingsPage>
  );
}

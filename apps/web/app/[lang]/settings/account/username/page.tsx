import { notFound } from "next/navigation";
import { ChangeUsernameForm } from "@/components/settings/account-forms";
import { SettingsPage } from "@/components/settings/page-head";
import { getT, isLang } from "@/lib/i18n";
import { requireViewer } from "@/lib/require-viewer";

export default async function Page({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  const me = await requireViewer(lang, `/${lang}/settings/account/username`);
  const t = getT(lang);
  return (
    <SettingsPage title={t("fields.username")} intro={t("account.usernameIntro")}>
      <ChangeUsernameForm lang={lang} username={me.username ?? ""} />
    </SettingsPage>
  );
}

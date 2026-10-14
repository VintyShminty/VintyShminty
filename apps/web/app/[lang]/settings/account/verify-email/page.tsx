import { notFound } from "next/navigation";
import { VerifyEmailFlow } from "@/components/settings/account-forms";
import { SettingsPage } from "@/components/settings/page-head";
import { getT, isLang } from "@/lib/i18n";
import { requireViewer } from "@/lib/require-viewer";

export default async function Page({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  const me = await requireViewer(lang, `/${lang}/settings/account/verify-email`);
  const t = getT(lang);
  return (
    <SettingsPage title={t("account.verifyEmail")}>
      <VerifyEmailFlow lang={lang} email={me.email} />
    </SettingsPage>
  );
}

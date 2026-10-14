import { notFound } from "next/navigation";
import { AwayForm } from "@/components/settings/away-form";
import { SettingsPage } from "@/components/settings/page-head";
import { getT, isLang } from "@/lib/i18n";
import { requireViewer } from "@/lib/require-viewer";

export default async function Page({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  const me = await requireViewer(lang, `/${lang}/settings/away-mode`);
  const t = getT(lang);
  return (
    <SettingsPage title={t("away.title")}>
      <AwayForm initial={{ enabled: me.profile.holidayMode, endsAt: me.profile.holidayEndsAt }} />
    </SettingsPage>
  );
}

import { notificationPreferenceSchema, userSettingsSchema } from "@vinty/shared";
import { notFound } from "next/navigation";
import { z } from "zod";
import { EmailAlerts } from "@/components/settings/email-alerts";
import { SettingsPage } from "@/components/settings/page-head";
import { serverApi } from "@/lib/api";
import { getT, isLang } from "@/lib/i18n";

export default async function Page({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  const t = getT(lang);
  const [settings, prefs] = await Promise.all([
    serverApi("/v1/me/settings", { lang, schema: userSettingsSchema }).catch(() => null),
    serverApi("/v1/me/notification-preferences", {
      lang,
      schema: z.array(notificationPreferenceSchema),
    }).catch(() => null),
  ]);
  return (
    <SettingsPage title={t("settings.notifications")}>
      {settings && prefs ? (
        <EmailAlerts initialSettings={settings} initialPrefs={prefs} />
      ) : (
        <p className="text-body-sm text-error">{t("errors.loadFailed")}</p>
      )}
    </SettingsPage>
  );
}

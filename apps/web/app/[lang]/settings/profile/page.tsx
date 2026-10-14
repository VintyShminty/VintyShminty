import { notFound } from "next/navigation";
import { EditProfileForm } from "@/components/settings/edit-profile-form";
import { SettingsPage } from "@/components/settings/page-head";
import { getT, isLang } from "@/lib/i18n";
import { requireViewer } from "@/lib/require-viewer";

export default async function Page({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  const me = await requireViewer(lang, `/${lang}/settings/profile`);
  const t = getT(lang);
  return (
    <SettingsPage title={t("editProfile.title")}>
      <EditProfileForm
        lang={lang}
        initial={{
          name: me.name,
          bio: me.profile.bio ?? "",
          city: me.profile.city ?? "",
          username: me.username,
          avatarUrl: me.profile.avatarUrl,
        }}
      />
    </SettingsPage>
  );
}

import { AlertTriangle, AtSign, Check, ChevronRight, KeyRound, Mail, Trash2 } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/badge";
import { SectionLabel, SettingsPage } from "@/components/settings/page-head";
import { getT, isLang } from "@/lib/i18n";
import { requireViewer } from "@/lib/require-viewer";

/** Settings, Your account: email, username, password and closing the account (like the app). */
export default async function Page({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  const me = await requireViewer(lang, `/${lang}/settings/account`);
  const t = getT(lang);
  const base = `/${lang}/settings/account`;
  const row =
    "flex min-h-14 items-center gap-md border-b border-border-subtle text-body-sm text-text-1 hover:bg-pressed";
  const chevron = <ChevronRight size={16} aria-hidden className="text-text-4 rtl:-scale-x-100" />;
  return (
    <SettingsPage title={t("account.title")}>
      <Link href={`${base}/email`} className={row}>
        <Mail size={18} aria-hidden className="text-text-3" />
        <span className="font-semibold">{t("fields.email")}</span>
        <span className="min-w-0 flex-1 truncate text-end text-text-3" dir="auto">
          {me.email}
        </span>
        {chevron}
      </Link>
      {me.emailVerified ? (
        <div className={row.replace("hover:bg-pressed", "")}>
          <span className="w-[18px]" />
          <span className="flex-1 font-semibold">{t("account.emailStatus")}</span>
          <Badge variant="success" icon={Check} label={t("account.verified")} />
        </div>
      ) : (
        <Link href={`${base}/verify-email`} className={row}>
          <span className="w-[18px]" />
          <span className="flex-1 font-semibold">{t("account.verifyEmail")}</span>
          <Badge variant="warning" icon={AlertTriangle} label={t("account.notVerified")} />
          {chevron}
        </Link>
      )}
      <Link href={`${base}/username`} className={row}>
        <AtSign size={18} aria-hidden className="text-text-3" />
        <span className="font-semibold">{t("fields.username")}</span>
        <span className="min-w-0 flex-1 truncate text-end text-text-3" dir="auto">
          {me.username}
        </span>
        {chevron}
      </Link>
      <Link href={`${base}/password`} className={row}>
        <KeyRound size={18} aria-hidden className="text-text-3" />
        <span className="flex-1 font-semibold">{t("account.changePassword")}</span>
        {chevron}
      </Link>
      <SectionLabel>{t("account.dangerZone")}</SectionLabel>
      <Link href={`${base}/delete`} className={`${row} text-error`}>
        <Trash2 size={18} aria-hidden />
        <span className="flex-1 font-semibold">{t("account.delete")}</span>
        {chevron}
      </Link>
    </SettingsPage>
  );
}

import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { AuthShell } from "@/components/auth/fields";
import { LogInForm } from "@/components/auth/log-in-form";
import { getViewer } from "@/lib/api";
import { getT, isLang } from "@/lib/i18n";
import { safeNext } from "@/lib/login-links";

export const metadata: Metadata = { robots: { index: false } };

/** Log in. `?next=` says where to land afterwards. Someone already logged in goes straight to that place. */
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string }>;
  searchParams: Promise<{ next?: string; reset?: string }>;
}) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  const { next, reset } = await searchParams;
  if (await getViewer(lang)) redirect(safeNext(next) ?? `/${lang}`);
  const t = getT(lang);
  return (
    <AuthShell title={t("logIn.title")} subtitle={t("logIn.subtitle")}>
      <LogInForm lang={lang} next={next} reset={reset === "1"} />
    </AuthShell>
  );
}

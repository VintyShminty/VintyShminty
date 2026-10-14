import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { AuthShell } from "@/components/auth/fields";
import { LogInForm } from "@/components/auth/log-in-form";
import { getAuthProviders, getViewer } from "@/lib/api";
import { getT, isLang } from "@/lib/i18n";
import { safeNext } from "@/lib/login-links";
import { socialErrorKeyFromCode } from "@/lib/social-errors";

export const metadata: Metadata = { robots: { index: false } };

/** Log in. `?next=` says where to land afterwards. Someone already logged in goes straight to that place. */
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string }>;
  searchParams: Promise<{ next?: string; reset?: string; error?: string; social?: string }>;
}) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  const { next, reset, error, social } = await searchParams;
  if (await getViewer(lang)) redirect(safeNext(next) ?? `/${lang}`);
  const t = getT(lang);
  const providers = await getAuthProviders(lang);
  // A refused Apple or Google login comes back here with ?error=... and ?social=apple|google.
  const errorKey = socialErrorKeyFromCode(error);
  const socialError = errorKey
    ? t(errorKey, { provider: t(social === "apple" ? "social.appleName" : "social.googleName") })
    : undefined;
  return (
    <AuthShell title={t("logIn.title")} subtitle={t("logIn.subtitle")}>
      <LogInForm
        lang={lang}
        next={next}
        reset={reset === "1"}
        providers={providers}
        initialError={socialError}
      />
    </AuthShell>
  );
}

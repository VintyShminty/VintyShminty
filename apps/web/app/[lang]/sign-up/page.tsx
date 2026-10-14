import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { SignUpFlow } from "@/components/auth/sign-up-flow";
import { getViewer } from "@/lib/api";
import { isLang } from "@/lib/i18n";
import { safeNext } from "@/lib/login-links";

export const metadata: Metadata = { robots: { index: false } };

/** Sign up with email and password (D-020). `?next=` says where to land after the welcome questions. */
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string }>;
  searchParams: Promise<{ next?: string }>;
}) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  const { next } = await searchParams;
  if (await getViewer(lang)) redirect(safeNext(next) ?? `/${lang}`);
  return <SignUpFlow lang={lang} next={next} />;
}

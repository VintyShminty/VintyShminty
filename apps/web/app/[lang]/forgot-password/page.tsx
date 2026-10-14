import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { ForgotFlow } from "@/components/auth/forgot-flow";
import { getViewer } from "@/lib/api";
import { isLang } from "@/lib/i18n";

export const metadata: Metadata = { robots: { index: false } };

export default async function Page({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  if (await getViewer(lang)) redirect(`/${lang}`);
  return <ForgotFlow lang={lang} />;
}

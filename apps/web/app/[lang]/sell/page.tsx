import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SellForm } from "@/components/sell/sell-form";
import { isLang } from "@/lib/i18n";
import { getFreshReference } from "@/lib/reference";
import { requireViewer } from "@/lib/require-viewer";

export const metadata: Metadata = { robots: { index: false } };

/** The sell form for a new listing (D-015). Logged out visitors are sent to log in first and come back here. */
export default async function SellPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  await requireViewer(lang, `/${lang}/sell`);
  const reference = await getFreshReference(lang);
  return <SellForm lang={lang} reference={reference} />;
}

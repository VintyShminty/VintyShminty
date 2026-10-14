import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { SettingsFrame } from "@/components/settings/frame";
import { isLang } from "@/lib/i18n";
import { requireViewer } from "@/lib/require-viewer";

export const metadata: Metadata = { robots: { index: false } };

/** Every settings page needs a login. The frame holds the list of sections and the page beside it (laptop) or instead of it (phone). */
export default async function SettingsLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  await requireViewer(lang, `/${lang}/settings`);
  return <SettingsFrame lang={lang}>{children}</SettingsFrame>;
}

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BalanceView } from "@/components/balance/balance-view";
import { isLang } from "@/lib/i18n";
import { requireViewer } from "@/lib/require-viewer";

export const metadata: Metadata = { robots: { index: false } };

/** Your balance (pretend money): available, pending, the ledger by month and a pretend withdrawal. Needs a login. */
export default async function BalancePage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  await requireViewer(lang, `/${lang}/balance`);
  return <BalanceView lang={lang} />;
}

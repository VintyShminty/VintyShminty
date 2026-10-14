import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { OrdersList } from "@/components/orders/orders-list";
import { isLang } from "@/lib/i18n";
import { requireViewer } from "@/lib/require-viewer";

export const metadata: Metadata = { robots: { index: false } };

/** My orders. Needs a login. */
export default async function OrdersPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  await requireViewer(lang, `/${lang}/orders`);
  return <OrdersList lang={lang} />;
}

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { OrderView } from "@/components/orders/order-view";
import { isLang } from "@/lib/i18n";
import { requireViewer } from "@/lib/require-viewer";

export const metadata: Metadata = { robots: { index: false } };

/** One order. Needs a login, and the server only shows it to the buyer and (once paid) the seller. */
export default async function OrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string; id: string }>;
  searchParams: Promise<{ placed?: string }>;
}) {
  const { lang, id } = await params;
  if (!isLang(lang)) notFound();
  const { placed } = await searchParams;
  await requireViewer(lang, `/${lang}/orders/${id}`);
  return <OrderView lang={lang} id={id} placed={placed === "1"} />;
}

import { listingDetailSchema } from "@vinty/shared";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SellForm } from "@/components/sell/sell-form";
import { ApiClientError, serverApi } from "@/lib/api";
import { isLang } from "@/lib/i18n";
import { getFreshReference } from "@/lib/reference";
import { requireViewer } from "@/lib/require-viewer";

export const metadata: Metadata = { robots: { index: false } };

/** The sell form filled in with one of your drafts or listings. Someone else's listing is a not found page. */
export default async function EditListingPage({ params }: { params: Promise<{ lang: string; id: string }> }) {
  const { lang, id } = await params;
  if (!isLang(lang)) notFound();
  await requireViewer(lang, `/${lang}/sell/${id}`);
  const [reference, listing] = await Promise.all([
    getFreshReference(lang),
    serverApi(`/v1/me/listings/${encodeURIComponent(id)}`, { lang, schema: listingDetailSchema }).catch(
      (error) => {
        if (error instanceof ApiClientError && error.status < 500 && error.status !== 0) return null;
        throw error;
      },
    ),
  ]);
  if (!listing) notFound();
  return <SellForm key={listing.id} lang={lang} reference={reference} existing={listing} />;
}

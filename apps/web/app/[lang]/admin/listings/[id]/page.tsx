import { listingDetailSchema } from "@vinty/shared";
import { notFound } from "next/navigation";
import { AdminListingStatus } from "@/components/admin/listing-status";
import { SellForm } from "@/components/sell/sell-form";
import { ApiClientError, serverApi } from "@/lib/api";
import { isLang } from "@/lib/i18n";
import { getFreshReference } from "@/lib/reference";

/** The sell form filled in with any listing, saved through the admin routes. The admin layout already checked the role. */
export default async function AdminEditListingPage({
  params,
}: {
  params: Promise<{ lang: string; id: string }>;
}) {
  const { lang, id } = await params;
  if (!isLang(lang)) notFound();
  const [reference, listing] = await Promise.all([
    getFreshReference(lang),
    serverApi(`/v1/admin/listings/${encodeURIComponent(id)}`, { lang, schema: listingDetailSchema }).catch(
      (error) => {
        if (error instanceof ApiClientError && error.status < 500 && error.status !== 0) return null;
        throw error;
      },
    ),
  ]);
  if (!listing) notFound();
  return (
    <>
      <AdminListingStatus listing={listing} />
      <SellForm key={listing.id} lang={lang} reference={reference} existing={listing} admin />
    </>
  );
}

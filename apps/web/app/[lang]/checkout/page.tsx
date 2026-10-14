import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CheckoutView } from "@/components/checkout/checkout-view";
import { getT, isLang } from "@/lib/i18n";
import { requireViewer } from "@/lib/require-viewer";

type Params = Promise<{ lang: string }>;
type Search = Promise<{ listing?: string; offer?: string; bundle?: string; order?: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { lang } = await params;
  if (!isLang(lang)) return { title: "Vinty" };
  return { title: getT(lang)("checkout.title"), robots: { index: false } };
}

/** Checkout needs a login. A visitor comes back here (with the same item) after logging in. */
export default async function CheckoutPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: Search;
}) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  const search = await searchParams;
  const query = new URLSearchParams(
    Object.entries(search).filter((e): e is [string, string] => typeof e[1] === "string"),
  ).toString();
  await requireViewer(lang, `/${lang}/checkout${query ? `?${query}` : ""}`);
  return (
    <CheckoutView
      lang={lang}
      listingId={search.listing}
      offerId={search.offer}
      bundleId={search.bundle}
      orderId={search.order}
    />
  );
}

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BundleView } from "@/components/bundle/bundle-view";
import { getT, isLang } from "@/lib/i18n";
import { requireViewer } from "@/lib/require-viewer";

type Params = Promise<{ lang: string; sellerId: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { lang } = await params;
  if (!isLang(lang)) return { title: "Yadii" };
  return { title: getT(lang)("bundle.title"), robots: { index: false } };
}

/** Closet deal with one seller: pick items, see the discount, go to checkout. Needs a login. */
export default async function BundlePage({ params }: { params: Params }) {
  const { lang, sellerId } = await params;
  if (!isLang(lang)) notFound();
  await requireViewer(lang, `/${lang}/bundle/${sellerId}`);
  return <BundleView lang={lang} sellerId={sellerId} />;
}

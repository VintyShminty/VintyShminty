import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PlaceholderPage } from "@/components/placeholder-page";
import { getT, isLang } from "@/lib/i18n";
import { alternatesFor } from "@/lib/seo";

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params;
  if (!isLang(lang)) return { title: "Vinty" };
  return { title: `${getT(lang)("web.footer.about")} | Vinty`, alternates: alternatesFor(lang, "/about") };
}

// A placeholder until the real page is written (step W2 round 2 or W7).
export default async function Page({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  return <PlaceholderPage lang={lang} title={getT(lang)("web.footer.about")} />;
}

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LegalPage } from "@/components/legal-page";
import { isLang } from "@/lib/i18n";
import { getLegalDoc } from "@/lib/legal";
import { alternatesFor } from "@/lib/seo";

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params;
  if (!isLang(lang)) return { title: "Yadii" };
  const doc = getLegalDoc(lang, "privacy");
  return {
    title: `${doc.title} | Yadii`,
    description: doc.description,
    alternates: alternatesFor(lang, "/privacy"),
  };
}

export default async function Page({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  return <LegalPage lang={lang} page="privacy" />;
}

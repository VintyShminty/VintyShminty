import { notFound } from "next/navigation";
import { PlaceholderPage } from "@/components/placeholder-page";
import { getT, isLang } from "@/lib/i18n";

// A placeholder until the real page is written (step W2 round 2 or W7).
export default async function Page({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  return <PlaceholderPage lang={lang} title={getT(lang)("web.footer.about")} />;
}

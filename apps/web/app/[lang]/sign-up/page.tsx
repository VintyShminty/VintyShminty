import { notFound } from "next/navigation";
import { PlaceholderPage } from "@/components/placeholder-page";
import { getT, isLang } from "@/lib/i18n";

// A placeholder until step W3 (accounts) builds the real page. `?next=` will say where to land after.
export default async function Page({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  const t = getT(lang);
  return <PlaceholderPage lang={lang} title={t("welcome.signUp")} note={t("web.accountSoon")} />;
}

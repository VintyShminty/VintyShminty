import { notFound } from "next/navigation";
import { TopBar } from "@/components/top-bar";
import { getT, isLang } from "@/lib/i18n";

export default async function HomePage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  const t = getT(lang);
  return (
    <>
      <TopBar lang={lang} />
      <main className="mx-auto max-w-[1400px] px-lg pb-2xl pt-xl md:px-xl">
        <h1 className="text-display font-light text-text-1">{t("home.greetingGuest")}</h1>
        <p className="mt-md text-body text-text-3">{t("web.home.comingSoon")}</p>
      </main>
    </>
  );
}

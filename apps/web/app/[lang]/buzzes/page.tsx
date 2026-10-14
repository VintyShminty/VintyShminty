import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BuzzList } from "@/components/item/buzz-list";
import { getT, isLang } from "@/lib/i18n";
import { requireViewer } from "@/lib/require-viewer";

export const metadata: Metadata = { robots: { index: false } };

/** Your buzzes: every time you gave an item buzz, with the day it ends. Buzz is free for now. */
export default async function BuzzesPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  await requireViewer(lang, `/${lang}/buzzes`);
  const t = getT(lang);
  return (
    <main className="mx-auto max-w-[760px] px-lg pb-2xl pt-xl md:px-xl">
      <h1 className="text-title font-bold text-text-1">{t("buzz.yourBuzzes")}</h1>
      <div className="mt-lg">
        <BuzzList lang={lang} />
      </div>
    </main>
  );
}

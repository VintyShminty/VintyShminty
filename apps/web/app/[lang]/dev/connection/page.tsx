import { notFound } from "next/navigation";
import { ConnectionCheck } from "@/components/dev/connection-check";
import { I18nProvider } from "@/components/i18n-provider";
import { clientResources, isLang } from "@/lib/i18n";

// A test page for the team. It does not exist online.
export default async function ConnectionPage({ params }: { params: Promise<{ lang: string }> }) {
  if (process.env.NODE_ENV === "production") notFound();
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  return (
    <I18nProvider lang={lang} resources={clientResources(lang)}>
      <ConnectionCheck />
    </I18nProvider>
  );
}

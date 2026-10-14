import type { Metadata } from "next";
import type { ReactNode } from "react";
import "../globals.css";
import { notFound } from "next/navigation";
import { Footer } from "@/components/footer";
import { I18nProvider } from "@/components/i18n-provider";
import { LoginPromptProvider } from "@/components/login-prompt";
import { QueryProvider } from "@/components/query-provider";
import { SiteProvider } from "@/components/site-context";
import { TopBar } from "@/components/top-bar";
import { getViewer } from "@/lib/api";
import { aileron, heebo } from "@/lib/fonts";
import { clientResources, dirOf, isLang, LANGUAGES } from "@/lib/i18n";
import { getConditionNames } from "@/lib/reference";
import { toViewer } from "@/lib/viewer";

export const dynamicParams = false;

export function generateStaticParams() {
  return LANGUAGES.map((lang) => ({ lang }));
}

export const metadata: Metadata = { title: "Vinty" };

/**
 * The frame of every page: fonts, language and direction, the providers client components need (wording, TanStack Query,
 * who is logged in, the login prompt), the top bar and the footer. The page asks the server who the visitor is once here.
 */
export default async function LangLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  const [me, conditions] = await Promise.all([getViewer(lang), getConditionNames(lang)]);
  const viewer = toViewer(me);
  return (
    <html lang={lang} dir={dirOf(lang)} className={`${aileron.variable} ${heebo.variable}`}>
      <body className="flex min-h-dvh flex-col">
        <I18nProvider lang={lang} resources={clientResources(lang)}>
          <QueryProvider>
            <SiteProvider viewer={viewer} conditions={conditions}>
              <LoginPromptProvider lang={lang}>
                <TopBar lang={lang} viewer={viewer} />
                <div className="flex-1">{children}</div>
                <Footer lang={lang} />
              </LoginPromptProvider>
            </SiteProvider>
          </QueryProvider>
        </I18nProvider>
      </body>
    </html>
  );
}

import type { Metadata } from "next";
import type { ReactNode } from "react";
import "../globals.css";
import { notFound } from "next/navigation";
import { aileron, heebo } from "@/lib/fonts";
import { dirOf, isLang, LANGUAGES } from "@/lib/i18n";

export const dynamicParams = false;

export function generateStaticParams() {
  return LANGUAGES.map((lang) => ({ lang }));
}

export const metadata: Metadata = { title: "Vinty" };

export default async function LangLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  return (
    <html lang={lang} dir={dirOf(lang)} className={`${aileron.variable} ${heebo.variable}`}>
      <body>{children}</body>
    </html>
  );
}

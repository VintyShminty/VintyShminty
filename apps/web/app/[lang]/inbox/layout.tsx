import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { type ReactNode, Suspense } from "react";
import { InboxShell } from "@/components/inbox/inbox-shell";
import { getT, isLang } from "@/lib/i18n";
import { requireViewer } from "@/lib/require-viewer";

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params;
  if (!isLang(lang)) return {};
  return { title: `${getT(lang)("tabs.inbox")} | Vinty`, robots: { index: false } };
}

/** The inbox for a logged in person: the chat list stays put while the chat on its side changes. */
export default async function InboxLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  await requireViewer(lang, `/${lang}/inbox`);
  return (
    <Suspense>
      <InboxShell lang={lang}>{children}</InboxShell>
    </Suspense>
  );
}

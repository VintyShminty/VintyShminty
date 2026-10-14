import { personalisationSizesSchema, SIZE_STEPS } from "@vinty/shared";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { WelcomeQuestions } from "@/components/auth/welcome-questions";
import { serverApi } from "@/lib/api";
import { isLang } from "@/lib/i18n";
import { safeNext } from "@/lib/login-links";
import { getReference } from "@/lib/reference";
import { requireViewer } from "@/lib/require-viewer";

export const metadata: Metadata = { robots: { index: false } };

const SLUGS = new Set(
  Object.values(SIZE_STEPS).flatMap((steps) => steps.flatMap((step) => step.groups.map((g) => g.slug))),
);

/** The two short questions after sign up (D-022): what do you shop for, then your sizes (D-029). Both can be skipped. */
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string }>;
  searchParams: Promise<{ next?: string }>;
}) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  const { next } = await searchParams;
  const me = await requireViewer(lang, `/${lang}/welcome-questions`);
  const [reference, saved] = await Promise.all([
    getReference(lang),
    serverApi("/v1/me/personalisation/sizes", { lang, schema: personalisationSizesSchema }).catch(() => null),
  ]);
  // Only the size groups of the questions, with their names in the page language.
  const groups = Object.fromEntries(
    reference.sizeGroups
      .filter((group) => SLUGS.has(group.slug))
      .map((group) => [group.slug, group.sizes.map((size) => ({ id: size.id, label: size.name[lang] }))]),
  );
  return (
    <WelcomeQuestions
      lang={lang}
      userId={me.id}
      next={safeNext(next) ?? `/${lang}`}
      groups={groups}
      savedSizeIds={saved?.sizeIds ?? []}
    />
  );
}

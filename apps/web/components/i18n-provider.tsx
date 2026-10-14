"use client";

import { type ReactNode, useState } from "react";
import { I18nextProvider } from "react-i18next";
import { createClientI18n, type Lang } from "@/lib/i18n";

/** Gives client components `useTranslation()`. The wording comes from the server page that renders it. */
export function I18nProvider({
  lang,
  resources,
  children,
}: {
  lang: Lang;
  resources: Record<string, unknown>;
  children: ReactNode;
}) {
  const [i18n] = useState(() => createClientI18n(lang, resources));
  return <I18nextProvider i18n={i18n}>{children}</I18nextProvider>;
}

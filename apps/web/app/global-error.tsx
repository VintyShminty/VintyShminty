"use client";

import en from "@vinty/locales/en.json";
import he from "@vinty/locales/he.json";
import { useEffect, useState } from "react";
import "./globals.css";

/**
 * The last resort, for when the page frame itself fails. It brings its own html and body and reads the wording
 * straight from the two language files.
 */
export default function GlobalError({ retry }: { error: unknown; retry: () => void }) {
  // The language comes from the address (/he/...), English until the browser can tell. The translation provider is not available here.
  const [lang, setLang] = useState<"en" | "he">("en");
  useEffect(() => {
    if (window.location.pathname.split("/")[1] === "he") setLang("he");
  }, []);
  const words = lang === "he" ? he : en;
  return (
    <html lang={lang} dir={lang === "he" ? "rtl" : "ltr"}>
      <body className="flex min-h-dvh items-center justify-center bg-background text-text-1">
        <main className="flex flex-col items-center gap-sm px-lg text-center">
          <h1 className="text-heading font-semibold">{words.web.error.title}</h1>
          <p className="text-subtitle text-text-3">{words.web.error.body}</p>
          <div className="mt-md flex flex-wrap items-center justify-center gap-md">
            <button
              type="button"
              onClick={() => retry()}
              className="inline-flex h-11 items-center rounded-control bg-primary px-lg text-body-sm font-semibold text-on-accent hover:opacity-90"
            >
              {words.common.tryAgain}
            </button>
            <a
              href={`/${lang}`}
              className="inline-flex h-11 items-center rounded-control px-lg text-body-sm font-semibold text-text-1 hover:bg-pressed"
            >
              {words.web.error.home}
            </a>
          </div>
        </main>
      </body>
    </html>
  );
}

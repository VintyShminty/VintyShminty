import { SUPPORT_EMAIL } from "@vinty/shared";
import type { ReactNode } from "react";
import { getT, type Lang } from "@/lib/i18n";
import { getLegalDoc, type LegalBlock, type LegalPage as PageId } from "@/lib/legal";

/** Turns a sentence into pieces: [Lawyer: ...] notes get a visible highlight, the support address becomes a link. */
function inline(text: string): ReactNode[] {
  let offset = 0;
  return text.split(new RegExp(`(\\[[^\\]]+\\]|${SUPPORT_EMAIL.replace(".", "\\.")})`)).map((part) => {
    const key = offset;
    offset += part.length;
    if (part === SUPPORT_EMAIL) {
      return (
        <a
          key={key}
          href={`mailto:${SUPPORT_EMAIL}`}
          dir="ltr"
          className="underline underline-offset-4 hover:text-primary"
        >
          {part}
        </a>
      );
    }
    if (part.startsWith("[") && part.endsWith("]")) {
      return (
        <mark
          key={key}
          className="rounded-control bg-accent-tint px-xs text-body-sm font-semibold text-text-1"
        >
          {part}
        </mark>
      );
    }
    return part;
  });
}

function Block({ block }: { block: LegalBlock }) {
  if (typeof block === "string") return <p className="text-body text-text-2">{inline(block)}</p>;
  return (
    <ul className="list-disc space-y-xs ps-lg text-body text-text-2 marker:text-text-4">
      {block.map((item) => (
        <li key={item}>{inline(item)}</li>
      ))}
    </ul>
  );
}

/** Terms, Privacy or About: a draft line, the intro, a contents list on wide screens and numbered-free sections. */
export function LegalPage({ lang, page, draft = true }: { lang: Lang; page: PageId; draft?: boolean }) {
  const t = getT(lang);
  const doc = getLegalDoc(lang, page);
  const long = doc.sections.length > 6;
  return (
    <main className="mx-auto max-w-[1000px] px-lg pb-2xl pt-xl md:px-xl">
      <div className={long ? "lg:grid lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-2xl" : ""}>
        {long ? (
          <nav aria-label={t("web.legal.contents")} className="hidden lg:block">
            <div className="sticky top-xl">
              <p className="pb-sm text-section-label font-semibold uppercase tracking-wide text-text-3">
                {t("web.legal.contents")}
              </p>
              <ul className="space-y-xs border-s border-border-subtle ps-md">
                {doc.sections.map((section) => (
                  <li key={section.id}>
                    <a href={`#${section.id}`} className="text-body-sm text-text-3 hover:text-text-1">
                      {section.heading}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </nav>
        ) : null}
        <div className="max-w-[70ch]">
          <h1 className="text-title font-bold text-text-1">{doc.title}</h1>
          {draft ? (
            <div className="mt-sm">
              <p className="text-body-sm font-semibold text-text-1">
                {t("web.legal.draftLine", { date: t("web.legal.updated") })}
              </p>
              <p className="mt-xs text-body-sm text-text-3">{t("web.legal.draftNote")}</p>
            </div>
          ) : null}
          <p className="mt-lg text-body text-text-1">{doc.intro}</p>
          {doc.sections.map((section) => (
            <section key={section.id} id={section.id} className="mt-xl scroll-mt-xl">
              <h2 className="text-heading font-bold text-text-1">{section.heading}</h2>
              <div className="mt-sm flex flex-col gap-md">
                {section.blocks.map((block) => (
                  <Block key={typeof block === "string" ? block : block.join()} block={block} />
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </main>
  );
}

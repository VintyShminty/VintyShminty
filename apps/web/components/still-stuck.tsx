import { SUPPORT_EMAIL } from "@vinty/shared";
import { getT, type Lang } from "@/lib/i18n";

/** "Still stuck? Write to us": an email link with the same address and subject as the app. */
export function StillStuck({ lang, outline = false }: { lang: Lang; outline?: boolean }) {
  const t = getT(lang);
  return (
    <section className="mt-2xl flex flex-col gap-sm rounded-control bg-surface p-lg">
      <h2 className="text-body font-bold text-text-1">{t("help.stillStuck.title")}</h2>
      <p className="text-body-sm text-text-2">{t("help.stillStuck.note")}</p>
      <a
        href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(t("help.stillStuck.subject"))}`}
        className={
          outline
            ? "mt-xs inline-flex h-10 items-center self-start rounded-control border border-primary px-lg text-body-sm font-semibold text-primary hover:bg-accent-tint"
            : "mt-xs inline-flex h-10 items-center self-start rounded-control bg-primary px-lg text-body-sm font-semibold text-on-accent hover:opacity-90"
        }
      >
        {t("help.stillStuck.button")}
      </a>
    </section>
  );
}

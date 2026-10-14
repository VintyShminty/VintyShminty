import type { ReactNode } from "react";

/** The title of a settings page, an optional line under it, then the page body. */
export function SettingsPage({
  title,
  intro,
  children,
}: {
  title: string;
  intro?: string;
  children: ReactNode;
}) {
  return (
    <section className="max-w-[560px]">
      <h1 className="text-title font-bold text-text-1">{title}</h1>
      {intro ? <p className="mt-sm text-subtitle text-text-3">{intro}</p> : null}
      <div className="mt-xl">{children}</div>
    </section>
  );
}

/** A small caps label above a group of rows. */
export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <h2 className="mb-sm mt-xl text-section-label font-bold uppercase text-text-3 first:mt-0">{children}</h2>
  );
}

/** One line with a switch at its end: the label, an optional hint under it, and the switch. */
export function SwitchRow({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="flex items-start gap-md border-b border-border-subtle py-md">
      <div className="min-w-0 flex-1">
        <p className="text-body text-text-1">{label}</p>
        {hint ? <p className="mt-xs text-body-sm text-text-3">{hint}</p> : null}
      </div>
      {children}
    </div>
  );
}

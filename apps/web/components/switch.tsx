"use client";

import { cn } from "@/lib/utils";

/**
 * A switch: a pill with a round knob that sits at the start when off and at the end when on (so it mirrors in Hebrew
 * with no extra work). Espresso when on, a grey outline when off. Always give it a `label` for screen readers.
 */
export function Switch({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "flex h-[28px] w-[48px] shrink-0 items-center rounded-full px-[3px] disabled:opacity-40",
        checked ? "justify-end bg-primary" : "justify-start bg-text-4",
      )}
    >
      <span aria-hidden className="h-[22px] w-[22px] rounded-full bg-background" />
    </button>
  );
}

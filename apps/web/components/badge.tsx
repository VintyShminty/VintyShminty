import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const VARIANTS = {
  accent: "border-primary text-primary",
  success: "border-success text-success",
  warning: "border-warning text-warning",
  error: "border-error text-error",
  neutral: "border-text-2 text-text-2",
} as const;

/**
 * A status badge (D-008): 22px tall outline pill on a white fill, an icon and a label. Status is never colour alone.
 * Used on the photo of an item card (Sold, Price drop, Buzzing) and anywhere a status shows.
 */
export function Badge({
  variant = "accent",
  icon: Icon,
  label,
  className,
}: {
  variant?: keyof typeof VARIANTS;
  icon: LucideIcon;
  label: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-[22px] shrink-0 items-center justify-center gap-xs rounded-full border bg-background px-sm text-badge font-semibold uppercase",
        VARIANTS[variant],
        className,
      )}
    >
      <Icon size={11} aria-hidden />
      {label}
    </span>
  );
}

import { X } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type ChipProps = {
  label: string;
  /** Shown after a dot, for example "All · 19". */
  count?: number;
  /** The chosen one of a group: filled espresso with white text. */
  selected?: boolean;
  /** An applied filter (D-030, row 13): 1.5px espresso outline with a cross. Clicking it takes the filter off. */
  applied?: boolean;
  /** Makes the chip a link. Without it the chip is a button. With both, a plain click calls `onClick` and the link only serves as the address. */
  href?: string;
  onClick?: () => void;
  disabled?: boolean;
  /** Spoken name when the visible words are not enough (for example "Remove Zara" on an applied chip). */
  ariaLabel?: string;
  /** A link chip changes the address without adding a history entry. */
  replace?: boolean;
  /** Leaves the scroll position alone when the chip is a link. */
  scroll?: boolean;
  children?: ReactNode;
  className?: string;
};

/**
 * The chip (D-008): 29px tall pill (10% under D-008, D-035), 13px side padding, 14px text, 1px outline in text-4 on white. `selected` fills it
 * with espresso, `applied` draws the 1.5px espresso outline with a cross. A link when it has `href`, else a button.
 */
export function Chip({
  label,
  count,
  selected = false,
  applied = false,
  href,
  onClick,
  disabled,
  ariaLabel,
  replace,
  scroll,
  className,
}: ChipProps) {
  const text = count === undefined ? label : `${label} · ${count}`;
  const classes = cn(
    "inline-flex h-[29px] shrink-0 items-center justify-center gap-xs whitespace-nowrap rounded-full border px-[13px] text-body-sm",
    selected
      ? "border-primary bg-primary text-primary-foreground"
      : applied
        ? "border-[1.5px] border-primary bg-background text-primary hover:bg-pressed"
        : "border-text-4 bg-background text-text-1 hover:bg-pressed",
    disabled && "pointer-events-none opacity-40",
    className,
  );
  const content = (
    <>
      {text}
      {applied ? <X size={14} aria-hidden /> : null}
    </>
  );
  if (href && !disabled) {
    return (
      <Link
        href={href}
        scroll={scroll}
        replace={replace}
        // A chip with its own click handler never needs the server's copy of the page it points to.
        prefetch={onClick ? false : undefined}
        aria-label={ariaLabel}
        aria-current={selected ? "true" : undefined}
        // With an onClick the link still has its address (crawlers, open in new tab), but a plain click is handled in the page.
        onClick={
          onClick
            ? (e) => {
                if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey)
                  return;
                e.preventDefault();
                onClick();
              }
            : undefined
        }
        className={classes}
      >
        {content}
      </Link>
    );
  }
  return (
    <button
      type="button"
      aria-pressed={selected}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={onClick}
      className={classes}
    >
      {content}
    </button>
  );
}

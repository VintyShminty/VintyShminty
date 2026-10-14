import { typeScale } from "@vinty/design/tokens";
import { type ClassValue, clsx } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// Teach tailwind-merge our custom names, like the app does (apps/mobile/lib/utils.ts). Otherwise "text-card-meta" (a
// size) is taken for a colour and silently dropped next to "text-text-3", and the text renders at the default size.
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [{ text: Object.keys(typeScale) }],
      rounded: [{ rounded: ["control", "window", "bar"] }],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** The keyboard focus ring (D-035): a 2px espresso outline, only for keyboard focus. */
export const FOCUS_RING =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

/**
 * Menus and lists (D-035): no filled hover. Text and icon turn espresso, and keyboard focus gets a ring drawn inside the
 * row so a scrolling list does not clip it. The current item shows a check or bold text, never a fill.
 */
export const MENU_ROW =
  "hover:text-primary focus-visible:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary";

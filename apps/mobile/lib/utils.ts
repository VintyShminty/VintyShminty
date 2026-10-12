import { type ClassValue, clsx } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";
import { typeScale } from "@/theme";

// Teach tailwind-merge our custom names, otherwise "text-body" (a size) would be treated as a colour
// and wrongly dropped next to "text-foreground".
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

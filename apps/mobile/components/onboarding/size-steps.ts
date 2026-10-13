import type { FigureKind, Highlight } from "@/components/onboarding/body-paths";

/** The three people the sizes step can show. They are the same as the "What do you shop for?" picks. */
export type SizeFigure = "women" | "men" | "kids";

export const FIGURE_KIND: Record<SizeFigure, FigureKind> = { women: "woman", men: "man", kids: "kid" };

export type SizeStep = {
  /** Part of the sentence key, for example "upper" gives onboarding.sizes.upper.title. */
  id: "upper" | "full" | "lower" | "waist" | "feet" | "kidsAge" | "kidsFeet";
  lit: Highlight;
  /** Size groups of the reference data that are shown in this step, by their slug. */
  groups: string[];
};

/**
 * Which size groups sit on which part of the body. Only groups that exist in the reference data (packages/db seed sizes).
 * "One size" is left out on purpose, nobody has that as a personal size.
 */
export const SIZE_STEPS: Record<SizeFigure, SizeStep[]> = {
  women: [
    { id: "upper", lit: "upper", groups: ["clothing-letter"] },
    { id: "full", lit: "body", groups: ["women-numeric"] },
    { id: "lower", lit: "lower", groups: ["women-waist"] },
    { id: "waist", lit: "waist", groups: ["belt"] },
    { id: "feet", lit: "feet", groups: ["shoes-women"] },
  ],
  men: [
    { id: "upper", lit: "upper", groups: ["clothing-letter"] },
    { id: "lower", lit: "lower", groups: ["men-waist"] },
    { id: "waist", lit: "waist", groups: ["belt"] },
    { id: "feet", lit: "feet", groups: ["shoes-men"] },
  ],
  kids: [
    { id: "kidsAge", lit: "body", groups: ["kids-age"] },
    { id: "kidsFeet", lit: "feet", groups: ["shoes-kids"] },
  ],
};

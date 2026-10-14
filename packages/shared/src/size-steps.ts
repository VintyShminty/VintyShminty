/** The three people the sizes step can show. They are the same as the "What do you shop for?" picks. */
export type SizeFigure = "women" | "men" | "kids";

/** Which ink picture belongs to which person (the file name starts with this). */
export const FIGURE_FILE: Record<SizeFigure, "woman" | "man" | "kid"> = {
  women: "woman",
  men: "man",
  kids: "kid",
};

export type SizeStep = {
  /** Part of the sentence key, for example "tops" gives onboarding.sizes.tops.title. */
  id: "tops" | "bottoms" | "belts" | "shoes" | "kidsClothes" | "kidsShoes";
  /** The end of the picture file name, for example "tops" gives woman-tops. */
  picture: "tops" | "bottoms" | "belts" | "shoes" | "whole";
  /** Size groups of the reference data that are shown in this step, by their slug, each as its own row of chips. */
  groups: { slug: string; label?: "letters" | "euNumbers" | "waistLabel" }[];
};

/**
 * Which size groups sit on which step. Only groups that exist in the reference data (packages/db seed sizes).
 * "One size" is left out on purpose, nobody has that as a personal size.
 */
export const SIZE_STEPS: Record<SizeFigure, SizeStep[]> = {
  women: [
    {
      id: "tops",
      picture: "tops",
      groups: [
        { slug: "clothing-letter", label: "letters" },
        { slug: "women-numeric", label: "euNumbers" },
      ],
    },
    { id: "bottoms", picture: "bottoms", groups: [{ slug: "women-waist", label: "waistLabel" }] },
    { id: "belts", picture: "belts", groups: [{ slug: "belt" }] },
    { id: "shoes", picture: "shoes", groups: [{ slug: "shoes-women" }] },
  ],
  men: [
    { id: "tops", picture: "tops", groups: [{ slug: "clothing-letter" }] },
    { id: "bottoms", picture: "bottoms", groups: [{ slug: "men-waist", label: "waistLabel" }] },
    { id: "belts", picture: "belts", groups: [{ slug: "belt" }] },
    { id: "shoes", picture: "shoes", groups: [{ slug: "shoes-men" }] },
  ],
  kids: [
    { id: "kidsClothes", picture: "whole", groups: [{ slug: "kids-age" }] },
    { id: "kidsShoes", picture: "shoes", groups: [{ slug: "shoes-kids" }] },
  ],
};

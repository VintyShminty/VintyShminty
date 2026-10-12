import type { AttributeMode } from "@vinty/shared";

export interface Named {
  en: string;
  he: string;
}

export interface CategoryRules {
  brand?: AttributeMode;
  size?: AttributeMode;
  condition?: AttributeMode;
  colour?: AttributeMode;
  material?: AttributeMode;
  pattern?: AttributeMode;
}

/**
 * One node of the category tree. `sizes`, `rules` and `parcel` are inherited by every child
 * unless the child sets its own. `slug` is the local part, the full slug joins the parents with "-".
 */
export interface CategorySeed {
  slug: string;
  en: string;
  he: string;
  /** Lucide icon name. A node without one uses its parent's icon. */
  icon?: string;
  /** Size group slugs that apply. An empty array switches sizes off for this branch. */
  sizes?: string[];
  rules?: CategoryRules;
  /** Parcel size slug recommended by default. */
  parcel?: string;
  children?: CategorySeed[];
}

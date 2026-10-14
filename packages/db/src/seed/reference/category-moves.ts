/**
 * How the clothing categories moved in the new tree (D-033). Used once per database by `moveCategories` in
 * `../category-moves.ts`: it moves every listing from the old category to the new one, then removes the old rows.
 * Slugs are the full slugs. The list is kept after the move so a database that is still on the old tree can be
 * brought up to date at any time, and running it again changes nothing.
 */
export type CategoryMove = {
  from: string;
  to: string;
  /** Material the old category implied. Applied only to listings that have no material yet. */
  material?: "linen" | "denim";
};

const w = "women-clothing-";
const m = "men-clothing-";

const kidsMoves = (who: "girls" | "boys"): CategoryMove[] => {
  const k = `kids-${who}-`;
  return [
    { from: `${k}tops`, to: `${k}tops-t-shirts` },
    { from: `${k}trousers`, to: `${k}trousers-trousers` },
    { from: `${k}outerwear`, to: `${k}outerwear-coats` },
    ...(who === "boys" ? [{ from: `${k}hoodies`, to: `${k}sweatshirts-sweatshirts` }] : []),
  ];
};

export const categoryMoves: CategoryMove[] = [
  // Women
  { from: `${w}dresses-evening`, to: `${w}dresses-gowns` },
  { from: `${w}dresses-casual`, to: `${w}dresses-other` },
  { from: `${w}knitwear-pullovers`, to: `${w}knitwear-jumpers` },
  { from: `${w}knitwear-hoodies`, to: `${w}sweatshirts-sweatshirts` },
  { from: `${w}knitwear-turtlenecks`, to: `${w}knitwear-roll-necks` },
  { from: `${w}jeans-boyfriend`, to: `${w}jeans-relaxed` },
  { from: `${w}jeans-denim-shorts`, to: `${w}shorts`, material: "denim" },
  { from: `${w}trousers-wide-trousers`, to: `${w}trousers-wide-leg` },
  { from: `${w}trousers-chinos`, to: `${w}trousers-tailored` },
  { from: `${w}trousers-shorts`, to: `${w}shorts` },
  { from: `${w}outerwear-coats`, to: `${w}coats-wool` },
  { from: `${w}outerwear-jackets`, to: `${w}jackets-other` },
  { from: `${w}outerwear-blazers`, to: `${w}blazers` },
  { from: `${w}outerwear-trench`, to: `${w}coats-trench` },
  { from: `${w}outerwear-puffer`, to: `${w}coats-puffer` },
  { from: `${w}outerwear-denim-jackets`, to: `${w}jackets-denim` },
  { from: `${w}outerwear-gilets`, to: `${w}vests` },
  { from: `${w}jumpsuits`, to: `${w}jumpsuits-jumpsuits` },
  { from: `${w}lingerie-bras`, to: `${w}underwear-bras` },
  { from: `${w}lingerie-pyjamas`, to: `${w}underwear-pyjamas` },
  { from: `${w}lingerie-underwear`, to: `${w}underwear-knickers` },
  { from: `${w}activewear-sports-bras`, to: `${w}sportswear-sports-bras` },
  { from: `${w}activewear-gym-leggings`, to: `${w}sportswear-sports-leggings` },
  { from: `${w}activewear-sports-tops`, to: `${w}sportswear-sports-tops` },
  // Men
  { from: `${m}t-shirts-t-shirts`, to: `${m}tops-t-shirts` },
  { from: `${m}t-shirts-polos`, to: `${m}tops-polos` },
  { from: `${m}t-shirts-tank-tops`, to: `${m}tops-tank-tops` },
  { from: `${m}shirts-casual`, to: `${m}shirts-button-up` },
  { from: `${m}shirts-formal`, to: `${m}shirts-button-up` },
  { from: `${m}shirts-linen`, to: `${m}shirts-button-up`, material: "linen" },
  { from: `${m}knitwear-hoodies`, to: `${m}sweatshirts-sweatshirts` },
  { from: `${m}knitwear-pullovers`, to: `${m}knitwear-jumpers` },
  { from: `${m}trousers-shorts`, to: `${m}shorts` },
  { from: `${m}outerwear-coats`, to: `${m}coats-wool` },
  { from: `${m}outerwear-jackets`, to: `${m}jackets-other` },
  { from: `${m}outerwear-puffer`, to: `${m}coats-puffer` },
  { from: `${m}outerwear-denim-jackets`, to: `${m}jackets-denim` },
  { from: `${m}outerwear-raincoats`, to: `${m}coats-raincoats` },
  { from: `${m}activewear-sports-tops`, to: `${m}sportswear-sports-tops` },
  { from: `${m}activewear-sports-shorts`, to: `${m}sportswear-sports-shorts` },
  { from: `${m}activewear-tracksuits`, to: `${m}sportswear-tracksuits` },
  { from: `${m}swimwear`, to: `${m}swimwear-swim-shorts` },
  { from: `${m}underwear`, to: `${m}underwear-underwear` },
  { from: `${m}pyjamas`, to: `${m}underwear-pyjamas` },
  // Kids
  ...kidsMoves("girls"),
  ...kidsMoves("boys"),
  { from: "kids-baby-sleepwear", to: "kids-baby-sleepsuits" },
];

/**
 * Old group rows that go away, and the groups that now hold what they held. Groups never carry listings, but
 * saved searches, hidden categories and taste scores can point at them.
 */
export const retiredGroups: Record<string, string[]> = {
  [`${w}outerwear`]: [`${w}coats`, `${w}jackets`, `${w}blazers`, `${w}vests`],
  [`${w}lingerie`]: [`${w}underwear`],
  [`${w}activewear`]: [`${w}sportswear`],
  [`${m}t-shirts`]: [`${m}tops`],
  [`${m}outerwear`]: [`${m}coats`, `${m}jackets`],
  [`${m}activewear`]: [`${m}sportswear`],
};

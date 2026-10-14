import kidShoes from "@vinty/design/sizes/kid-shoes.jpg";
import kidWhole from "@vinty/design/sizes/kid-whole.jpg";
import manBelts from "@vinty/design/sizes/man-belts.jpg";
import manBottoms from "@vinty/design/sizes/man-bottoms.jpg";
import manShoes from "@vinty/design/sizes/man-shoes.jpg";
import manTops from "@vinty/design/sizes/man-tops.jpg";
import womanBelts from "@vinty/design/sizes/woman-belts.jpg";
import womanBottoms from "@vinty/design/sizes/woman-bottoms.jpg";
import womanShoes from "@vinty/design/sizes/woman-shoes.jpg";
import womanTops from "@vinty/design/sizes/woman-tops.jpg";
import type { StaticImageData } from "next/image";

/** The hand-drawn ink pictures of the sizes step (D-029) by file name without the ending, for example `woman-tops`. */
export const SIZE_PICTURES: Record<string, StaticImageData> = {
  "woman-tops": womanTops,
  "woman-bottoms": womanBottoms,
  "woman-belts": womanBelts,
  "woman-shoes": womanShoes,
  "man-tops": manTops,
  "man-bottoms": manBottoms,
  "man-belts": manBelts,
  "man-shoes": manShoes,
  "kid-whole": kidWhole,
  "kid-shoes": kidShoes,
};

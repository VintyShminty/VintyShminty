import type { SizeKind } from "@vinty/shared";
import type { Named } from "./types.js";

export interface SizeGroupSeed extends Named {
  slug: string;
  kind: SizeKind;
  sizes: (Named & { slug: string; label: string })[];
}

const same = (label: string) => ({
  slug: label.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
  label,
  en: label,
  he: label,
});

const range = (from: number, to: number, step = 1) => {
  const out: number[] = [];
  for (let n = from; n <= to; n += step) out.push(n);
  return out;
};

const letters = ["XXS", "XS", "S", "M", "L", "XL", "XXL", "XXXL", "4XL", "5XL"];

const kidsAges: (Named & { label: string })[] = [
  { label: "0-3m", en: "0 to 3 months", he: "0 עד 3 חודשים" },
  { label: "3-6m", en: "3 to 6 months", he: "3 עד 6 חודשים" },
  { label: "6-9m", en: "6 to 9 months", he: "6 עד 9 חודשים" },
  { label: "9-12m", en: "9 to 12 months", he: "9 עד 12 חודשים" },
  { label: "12-18m", en: "12 to 18 months", he: "12 עד 18 חודשים" },
  { label: "18-24m", en: "18 to 24 months", he: "18 עד 24 חודשים" },
  ...range(2, 14).map((y) => ({
    label: `${y}y`,
    en: `${y} years`,
    he: y === 2 ? "שנתיים" : y <= 10 ? `${y} שנים` : `${y} שנה`,
  })),
];

export const sizeGroupSeed: SizeGroupSeed[] = [
  {
    slug: "clothing-letter",
    en: "Clothing sizes (letters)",
    he: "מידות בגדים (אותיות)",
    kind: "letter",
    sizes: letters.map(same),
  },
  {
    slug: "women-numeric",
    en: "Women's sizes (EU numbers)",
    he: "מידות נשים (מספרים אירופיים)",
    kind: "numeric",
    sizes: range(32, 54, 2).map((n) => ({ slug: String(n), label: String(n), en: `EU ${n}`, he: `${n}` })),
  },
  {
    slug: "women-waist",
    en: "Women's jeans (waist)",
    he: "ג'ינס נשים (מותן)",
    kind: "waist",
    sizes: range(24, 36).map((n) => ({ slug: `w${n}`, label: `W${n}`, en: `W${n}`, he: `מותן ${n}` })),
  },
  {
    slug: "men-waist",
    en: "Men's trousers and jeans (waist)",
    he: "מכנסי גברים וג'ינס (מותן)",
    kind: "waist",
    sizes: range(28, 44, 2).map((n) => ({ slug: `w${n}`, label: `W${n}`, en: `W${n}`, he: `מותן ${n}` })),
  },
  {
    slug: "shoes-women",
    en: "Women's shoes (EU and IL)",
    he: "נעליים לנשים (מידה אירופית וישראלית)",
    kind: "shoe",
    sizes: range(35, 42).map((n) => ({ slug: String(n), label: String(n), en: `EU ${n}`, he: `${n}` })),
  },
  {
    slug: "shoes-men",
    en: "Men's shoes (EU and IL)",
    he: "נעליים לגברים (מידה אירופית וישראלית)",
    kind: "shoe",
    sizes: range(39, 48).map((n) => ({ slug: String(n), label: String(n), en: `EU ${n}`, he: `${n}` })),
  },
  {
    slug: "shoes-kids",
    en: "Kids' shoes (EU and IL)",
    he: "נעליים לילדים (מידה אירופית וישראלית)",
    kind: "shoe",
    sizes: range(16, 38).map((n) => ({ slug: String(n), label: String(n), en: `EU ${n}`, he: `${n}` })),
  },
  {
    slug: "kids-age",
    en: "Kids' sizes (age)",
    he: "מידות ילדים (גיל)",
    kind: "kids_age",
    sizes: kidsAges.map((a) => ({ slug: a.label, label: a.label, en: a.en, he: a.he })),
  },
  {
    slug: "belt",
    en: "Belt sizes (cm)",
    he: "מידות חגורה (ס״מ)",
    kind: "numeric",
    sizes: range(70, 120, 5).map((n) => ({ slug: String(n), label: `${n}`, en: `${n} cm`, he: `${n} ס״מ` })),
  },
  {
    slug: "one-size",
    en: "One size",
    he: "מידה אחת",
    kind: "one_size",
    sizes: [{ slug: "one-size", label: "One size", en: "One size", he: "מידה אחת" }],
  },
];

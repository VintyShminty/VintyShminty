import { z } from "zod";
import { idSchema, localisedNameSchema } from "./common.js";
import { ATTRIBUTE_MODES, SIZE_KINDS } from "./enums.js";

export const categoryNodeSchema: z.ZodType<CategoryNode> = z.lazy(
  () =>
    z.object({
      id: idSchema,
      slug: z.string(),
      path: z.string(),
      name: localisedNameSchema,
      icon: z.string().nullable(),
      isLeaf: z.boolean(),
      rules: z.object({
        brand: z.enum(ATTRIBUTE_MODES),
        size: z.enum(ATTRIBUTE_MODES),
        condition: z.enum(ATTRIBUTE_MODES),
        colour: z.enum(ATTRIBUTE_MODES),
        material: z.enum(ATTRIBUTE_MODES),
        pattern: z.enum(ATTRIBUTE_MODES),
      }),
      sizeGroupIds: z.array(idSchema),
      defaultParcelSizeId: idSchema.nullable(),
      children: z.array(categoryNodeSchema),
    }),
  // The cast keeps Vercel's build check happy, it runs without strict and then reads nullable as optional.
) as z.ZodType<CategoryNode>;
export interface CategoryNode {
  id: string;
  slug: string;
  path: string;
  name: { en: string; he: string };
  icon: string | null;
  isLeaf: boolean;
  rules: Record<
    "brand" | "size" | "condition" | "colour" | "material" | "pattern",
    (typeof ATTRIBUTE_MODES)[number]
  >;
  sizeGroupIds: string[];
  defaultParcelSizeId: string | null;
  children: CategoryNode[];
}

export const sizeGroupSchema = z.object({
  id: idSchema,
  slug: z.string(),
  name: localisedNameSchema,
  kind: z.enum(SIZE_KINDS),
  sizes: z.array(z.object({ id: idSchema, slug: z.string(), label: z.string(), name: localisedNameSchema })),
});

export const conditionSchema = z.object({
  id: idSchema,
  slug: z.string(),
  name: localisedNameSchema,
  description: localisedNameSchema,
  rank: z.number().int(),
  /** The same level in reading words, shown for books and magazines ("Well read" instead of "Well loved"). */
  forBooks: z.object({ name: localisedNameSchema, description: localisedNameSchema }).optional(),
});

export const colourSchema = z.object({
  id: idSchema,
  slug: z.string(),
  name: localisedNameSchema,
  swatchHex: z.string(),
});
export const materialSchema = z.object({ id: idSchema, slug: z.string(), name: localisedNameSchema });
export const patternSchema = materialSchema;
export const brandSchema = z.object({
  id: idSchema,
  slug: z.string(),
  name: z.string(),
  logoUrl: z.string().url().nullable(),
});

export const parcelSizeSchema = z.object({
  id: idSchema,
  slug: z.string(),
  name: localisedNameSchema,
  description: localisedNameSchema,
  maxWeightGrams: z.number().int(),
  priceMinor: z.number().int(),
  currency: z.string().length(3),
});

export const feeRuleResponseSchema = z.object({
  currency: z.string().length(3),
  buyerFeeBasisPoints: z.number().int(),
  buyerFeeFixedMinor: z.number().int(),
});

/** GET /v1/reference. Everything the sell form and the filters need, in one cacheable response. */
export const referenceDataSchema = z.object({
  version: z.string(),
  categories: z.array(categoryNodeSchema),
  sizeGroups: z.array(sizeGroupSchema),
  conditions: z.array(conditionSchema),
  colours: z.array(colourSchema),
  materials: z.array(materialSchema),
  patterns: z.array(patternSchema),
  parcelSizes: z.array(parcelSizeSchema),
  currencies: z.array(
    z.object({ code: z.string().length(3), symbol: z.string(), minorUnitExponent: z.number().int() }),
  ),
  feeRules: z.array(feeRuleResponseSchema),
  settings: z.record(z.string(), z.unknown()),
});
export type ReferenceData = z.infer<typeof referenceDataSchema>;
export type Brand = z.infer<typeof brandSchema>;
export type Condition = z.infer<typeof conditionSchema>;
export type ParcelSize = z.infer<typeof parcelSizeSchema>;

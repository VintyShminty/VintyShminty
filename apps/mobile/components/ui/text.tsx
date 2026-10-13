import { Slot } from "@rn-primitives/slot";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { useTranslation } from "react-i18next";
import { Text as RNText } from "react-native";
import { cn } from "@/lib/utils";

/**
 * The one text component. Every variant is a named style of the type scale (docs/design.md).
 * Size, line height and tracking come from Tailwind (theme/tokens.js). The weight is a separate
 * font family because React Native needs one family name per weight. Latin text uses Aileron,
 * Hebrew uses Heebo (D-011), chosen from the current language.
 */
const textVariants = cva("text-foreground", {
  variants: {
    variant: {
      display: "text-display",
      title: "text-title",
      subtitle: "text-subtitle text-text-2",
      itemName: "text-item-name",
      heading: "text-heading",
      sectionLabel: "text-section-label uppercase text-text-3",
      smallLabel: "text-small-label uppercase text-text-3",
      cardBrand: "text-card-brand",
      cardDesc: "text-card-desc text-text-2",
      cardMeta: "text-card-meta text-text-3",
      pill: "text-pill",
      button: "text-body-sm",
      badge: "text-badge uppercase",
      body: "text-body",
      bodySmall: "text-body-sm",
    },
  },
  defaultVariants: { variant: "body" },
});

type Variant = NonNullable<VariantProps<typeof textVariants>["variant"]>;
type Weight = 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800;

const DEFAULT_WEIGHT: Record<Variant, Weight> = {
  display: 300,
  title: 700,
  subtitle: 400,
  itemName: 800,
  heading: 700,
  sectionLabel: 600,
  smallLabel: 500,
  cardBrand: 800,
  cardDesc: 400,
  cardMeta: 400,
  pill: 500,
  button: 500,
  badge: 600,
  body: 400,
  bodySmall: 400,
};

// Full class names written out so Tailwind can see them.
const AILERON: Record<Weight, string> = {
  100: "font-aileron-100",
  200: "font-aileron-200",
  300: "font-aileron-300",
  400: "font-aileron-400",
  500: "font-aileron-500",
  600: "font-aileron-600",
  700: "font-aileron-700",
  800: "font-aileron-800",
};
const HEEBO: Record<Weight, string> = {
  100: "font-heebo-100",
  200: "font-heebo-200",
  300: "font-heebo-300",
  400: "font-heebo-400",
  500: "font-heebo-500",
  600: "font-heebo-600",
  700: "font-heebo-700",
  800: "font-heebo-800",
};

/** Lets a parent (Button, Badge, Chip) set the text style and colour of the Text inside it. */
type TextStyleContextValue = { variant?: Variant; className?: string; weight?: Weight };
const TextStyleContext = React.createContext<TextStyleContextValue>({});

type TextProps = React.ComponentProps<typeof RNText> & {
  variant?: Variant;
  weight?: Weight;
  /** Force a typeface. Normally chosen from the current language. */
  font?: "aileron" | "heebo";
  asChild?: boolean;
};

function Text({ className, variant, weight, font, asChild = false, ...props }: TextProps) {
  const ctx = React.useContext(TextStyleContext);
  const { i18n } = useTranslation();
  const resolvedVariant: Variant = variant ?? ctx.variant ?? "body";
  const resolvedWeight = weight ?? (variant ? undefined : ctx.weight) ?? DEFAULT_WEIGHT[resolvedVariant];
  const family = font ?? (i18n.language === "he" ? "heebo" : "aileron");
  const Component = asChild ? Slot : RNText;
  return (
    <Component
      className={cn(
        textVariants({ variant: resolvedVariant }),
        // Start edge of the layout. React Native swaps "left" and "right" in text when the layout direction is
        // right to left, so "text-left" means the start edge in both languages (right in Hebrew, left in English).
        // className can still override (text-center).
        "text-left",
        family === "heebo" ? HEEBO[resolvedWeight] : AILERON[resolvedWeight],
        ctx.className,
        className,
      )}
      {...props}
    />
  );
}

export type { TextProps, TextStyleContextValue };
export { Text, TextStyleContext, textVariants };

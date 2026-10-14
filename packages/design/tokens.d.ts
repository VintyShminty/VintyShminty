export const colors: Record<
  | "background"
  | "surface"
  | "pressed"
  | "border"
  | "borderSubtle"
  | "text1"
  | "text2"
  | "text3"
  | "text4"
  | "accent"
  | "onAccent"
  | "accentTint"
  | "chipSelected"
  | "onChip"
  | "success"
  | "successTint"
  | "warning"
  | "warningTint"
  | "error"
  | "errorTint"
  | "destructive"
  | "window"
  | "backdrop",
  string
>;
export const opacity: { window: number; backdrop: number };
export const radii: { control: number; window: number; bar: number };
export const spacing: Record<"xs" | "sm" | "md" | "lg" | "xl" | "2xl", number>;
export const typeScale: Record<string, { fontSize: number; lineHeight: number; letterSpacing?: number }>;
export function cssVariables(): Record<string, string>;
export function hexToHslTriplet(hex: string): string;
export const brand: Record<"googleBlue" | "googleGreen" | "googleYellow" | "googleRed", string>;

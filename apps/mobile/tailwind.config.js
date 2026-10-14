const plugin = require("tailwindcss/plugin");
const { opacity, radii, spacing, typeScale, cssVariables } = require("@vinty/design/tokens");
const { fontFamilies } = require("@vinty/design/fonts");

const v = (name) => `hsl(var(--${name}))`;

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        // Reusables semantic names (mapping documented in CLAUDE.md)
        border: v("border"),
        input: v("input"),
        ring: v("ring"),
        background: v("background"),
        foreground: v("foreground"),
        primary: { DEFAULT: v("primary"), foreground: v("primary-foreground") },
        secondary: { DEFAULT: v("secondary"), foreground: v("secondary-foreground") },
        destructive: { DEFAULT: v("destructive"), foreground: v("destructive-foreground") },
        muted: { DEFAULT: v("muted"), foreground: v("muted-foreground") },
        accent: { DEFAULT: v("accent"), foreground: v("accent-foreground"), tint: v("accent-tint") },
        popover: { DEFAULT: v("popover"), foreground: v("popover-foreground") },
        card: { DEFAULT: v("card"), foreground: v("card-foreground") },
        // Our own design tokens (design.md Colour table)
        surface: v("surface"),
        pressed: v("pressed"),
        "border-subtle": v("border-subtle"),
        text: { 1: v("text-1"), 2: v("text-2"), 3: v("text-3"), 4: v("text-4") },
        "on-accent": v("on-accent"),
        "chip-selected": v("chip-selected"),
        "on-chip": v("on-chip"),
        success: { DEFAULT: v("success"), tint: v("success-tint") },
        warning: { DEFAULT: v("warning"), tint: v("warning-tint") },
        error: { DEFAULT: v("error"), tint: v("error-tint") },
        window: `hsl(var(--window) / ${opacity.window})`,
        backdrop: `hsl(var(--backdrop) / ${opacity.backdrop})`,
      },
      borderRadius: {
        control: `${radii.control}px`,
        window: `${radii.window}px`,
        bar: `${radii.bar}px`,
      },
      spacing: Object.fromEntries(Object.entries(spacing).map(([k, n]) => [k, `${n}px`])),
      fontSize: Object.fromEntries(
        Object.entries(typeScale).map(([name, { fontSize, lineHeight, letterSpacing }]) => [
          name,
          [
            `${fontSize}px`,
            {
              lineHeight: `${lineHeight}px`,
              ...(letterSpacing ? { letterSpacing: `${letterSpacing}px` } : {}),
            },
          ],
        ]),
      ),
      fontFamily: fontFamilies,
      borderWidth: { hairline: "0.5px" },
    },
  },
  plugins: [
    require("tailwindcss-animate"),
    plugin(({ addBase }) => {
      addBase({ ":root": cssVariables() });
    }),
  ],
};

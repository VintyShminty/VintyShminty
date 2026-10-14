// Single source of truth for design tokens (docs/design.md, D-006 Espresso and cream).
// Plain CommonJS so tailwind.config.js can read it. The mobile app imports it through apps/mobile/theme/index.ts.
// Light mode only (D-002). Tokens are named by role so a dark set can be added later.

/** Hex values, named by role (design.md Colour table). */
const colors = {
  background: "#FFFFFF",
  surface: "#FBF8F2",
  pressed: "#F1E9DA",
  border: "#E4DACA",
  borderSubtle: "#F0EADF",
  text1: "#241811",
  text2: "#54443A",
  text3: "#695A4F",
  text4: "#7A6B60",
  accent: "#4B2E22",
  onAccent: "#FFFFFF",
  accentTint: "#F7EEDC",
  chipSelected: "#EFE0C3",
  onChip: "#3A2218",
  success: "#1B7A43",
  successTint: "#E6F4EA",
  warning: "#8A4F00",
  warningTint: "#FFEFC2",
  error: "#B3261E",
  errorTint: "#FDECEA",
  destructive: "#B3261E",
  // Derived values, see D-006
  window: "#FFFFFF", // used at 96% opacity
  backdrop: "#241811", // used at 25% opacity
};

const opacity = { window: 0.96, backdrop: 0.25 };

/** Radii in px: window 20, buttons and photos 12, search bar 32, pills fully rounded. */
const radii = { control: 12, window: 20, bar: 32 };

/** Spacing steps in px (8px base grid). */
const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, "2xl": 40 };

/**
 * Type scale. Sizes in px, letterSpacing in px (React Native has no em).
 * Weight is applied separately through a font family (see fonts.ts), because React Native
 * needs one family name per weight.
 */
const typeScale = {
  display: { fontSize: 40, lineHeight: 40, letterSpacing: -1.4 },
  title: { fontSize: 32, lineHeight: 38, letterSpacing: -0.5 },
  subtitle: { fontSize: 14, lineHeight: 20 },
  "item-name": { fontSize: 28, lineHeight: 32, letterSpacing: -0.3 },
  heading: { fontSize: 18, lineHeight: 24 },
  "section-label": { fontSize: 12, lineHeight: 16, letterSpacing: 1.2 },
  "small-label": { fontSize: 10, lineHeight: 14, letterSpacing: 1.2 },
  "card-brand": { fontSize: 13.5, lineHeight: 18 },
  "card-desc": { fontSize: 12, lineHeight: 16 },
  "card-meta": { fontSize: 11, lineHeight: 14 },
  pill: { fontSize: 13, lineHeight: 16 },
  badge: { fontSize: 10, lineHeight: 12, letterSpacing: 0.8 },
  body: { fontSize: 16, lineHeight: 22 },
  "body-sm": { fontSize: 14, lineHeight: 20 },
};

// ---- helpers that turn hex into the HSL triplets Reusables expects ----
function hexToHslTriplet(hex) {
  const n = parseInt(hex.slice(1), 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  let h = 0;
  let s = 0;
  if (d !== 0) {
    s = d / (1 - Math.abs(2 * l - 1));
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  const f = (x) => Number((x * 100).toFixed(1));
  return `${Number(h.toFixed(1))} ${f(s)}% ${f(l)}%`;
}

const kebab = (s) => s.replace(/[A-Z]|\d+/g, (m) => `-${m.toLowerCase()}`);

/**
 * CSS variables (light only). Our own token names plus the Reusables semantic names,
 * which point at our tokens. Mapping is documented in CLAUDE.md.
 */
function cssVariables() {
  const vars = {};
  // Our own tokens. "accent" is skipped: Reusables uses --accent for something else, our accent is --primary.
  for (const [name, hex] of Object.entries(colors)) {
    if (name === "accent") continue;
    vars[`--${kebab(name)}`] = hexToHslTriplet(hex);
  }
  // Reusables semantic names -> our tokens
  const reusables = {
    background: "background",
    foreground: "text1",
    card: "background",
    "card-foreground": "text1",
    popover: "background",
    "popover-foreground": "text1",
    primary: "accent",
    "primary-foreground": "onAccent",
    secondary: "surface",
    "secondary-foreground": "text1",
    muted: "surface",
    "muted-foreground": "text3",
    accent: "pressed",
    "accent-foreground": "text1",
    destructive: "destructive",
    "destructive-foreground": "onAccent",
    border: "border",
    input: "border",
    ring: "accent",
  };
  for (const [semantic, token] of Object.entries(reusables)) {
    vars[`--${semantic}`] = hexToHslTriplet(colors[token]);
  }
  return vars;
}

/** Colours of third party brand marks that must not be recoloured (the Google "G", Apple's black). Never used for our own UI. */
const brand = {
  appleBlack: "#000000",
  googleBlue: "#4285F4",
  googleGreen: "#34A853",
  googleYellow: "#FBBC05",
  googleRed: "#EA4335",
};

module.exports = { brand, colors, opacity, radii, spacing, typeScale, cssVariables, hexToHslTriplet };

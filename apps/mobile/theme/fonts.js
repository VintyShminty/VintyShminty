// Font families, one per weight (React Native needs a separate family name per weight).
// Shipped files: Aileron 100, 300, 400, 600, 700, 800 (CC0). Heebo 300 to 800 (OFL).
// Missing weights map to the nearest shipped file:
//   Aileron 200 -> Light 300, Aileron 500 -> SemiBold 600, Heebo 200 and 100 -> Light 300.
// Tailwind classes: font-aileron-<weight> and font-heebo-<weight>, weight 100 to 800.

const aileronFiles = [100, 300, 400, 600, 700, 800];
const heeboFiles = [300, 400, 500, 600, 700, 800];

const aileronMap = { 100: 100, 200: 300, 300: 300, 400: 400, 500: 600, 600: 600, 700: 700, 800: 800 };
const heeboMap = { 100: 300, 200: 300, 300: 300, 400: 400, 500: 500, 600: 600, 700: 700, 800: 800 };

const fontFamilies = {};
for (const [w, file] of Object.entries(aileronMap)) fontFamilies[`aileron-${w}`] = [`Aileron-${file}`];
for (const [w, file] of Object.entries(heeboMap)) fontFamilies[`heebo-${w}`] = [`Heebo-${file}`];

module.exports = { aileronFiles, heeboFiles, aileronMap, heeboMap, fontFamilies };

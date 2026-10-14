import localFont from "next/font/local";

// Aileron for English, Heebo for Hebrew (D-011). The files live in packages/design/fonts, shared with the app.
// next/font needs literal paths, so every file is written out.

export const aileron = localFont({
  src: [
    { path: "../../../packages/design/fonts/Aileron-300.ttf", weight: "300", style: "normal" },
    { path: "../../../packages/design/fonts/Aileron-400.ttf", weight: "400", style: "normal" },
    { path: "../../../packages/design/fonts/Aileron-600.ttf", weight: "600", style: "normal" },
    { path: "../../../packages/design/fonts/Aileron-700.ttf", weight: "700", style: "normal" },
    { path: "../../../packages/design/fonts/Aileron-800.ttf", weight: "800", style: "normal" },
  ],
  variable: "--font-aileron",
  display: "swap",
});

export const heebo = localFont({
  src: [
    { path: "../../../packages/design/fonts/Heebo-300.ttf", weight: "300", style: "normal" },
    { path: "../../../packages/design/fonts/Heebo-400.ttf", weight: "400", style: "normal" },
    { path: "../../../packages/design/fonts/Heebo-500.ttf", weight: "500", style: "normal" },
    { path: "../../../packages/design/fonts/Heebo-600.ttf", weight: "600", style: "normal" },
    { path: "../../../packages/design/fonts/Heebo-700.ttf", weight: "700", style: "normal" },
    { path: "../../../packages/design/fonts/Heebo-800.ttf", weight: "800", style: "normal" },
  ],
  variable: "--font-heebo",
  display: "swap",
});

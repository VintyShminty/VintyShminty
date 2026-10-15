import { colors } from "@vinty/design/tokens";
import { ImageResponse } from "next/og";

export const alt = "Yadii";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** The preview picture for every page that has no photo of its own (item pages use the listing photo): the tag mark (D-046) and the wordmark. */
export default function OpenGraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: colors.accentTint,
        color: colors.accent,
        fontSize: 220,
        fontWeight: 800,
        letterSpacing: -6,
        gap: 36,
      }}
    >
      <svg
        viewBox="20 2 66 92"
        width={198}
        height={276}
        fill="none"
        stroke={colors.accent}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M47 30 Q50 8 78 8" strokeWidth="4" />
        <g transform="rotate(-8 50 54)">
          <path d="M30 36 L50 20 L70 36 V82 a4 4 0 0 1 -4 4 H34 a4 4 0 0 1 -4 -4 Z" strokeWidth="5" />
          <circle cx="50" cy="34" r="4" strokeWidth="5" />
          <path d="M40 50 L50 63 L60 50 M50 63 V75" strokeWidth="7" />
        </g>
      </svg>
      Yadii
    </div>,
    size,
  );
}

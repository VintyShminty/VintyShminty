import { colors } from "@vinty/design/tokens";
import { ImageResponse } from "next/og";

export const alt = "Vinty";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** The preview picture for every page that has no photo of its own (item pages use the listing photo): the wordmark. */
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
      }}
    >
      Vinty
    </div>,
    size,
  );
}

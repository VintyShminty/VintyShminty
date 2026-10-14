import type { PhotoTipKind } from "@vinty/shared";

/** The most tip lines shown under the photos at once. */
export const MAX_TIP_LINES = 2;

export type TipLine = { key: string; n: number; kind: PhotoTipKind };

/**
 * Which tips to show: one line per photo that is still in the listing and has a tip the seller has not closed, in photo
 * order, at most two. `n` is the photo's place now (1-based), so moving photos around keeps the tip on the right one.
 * The kinds are already ordered most important first, so the first kind is the one shown.
 */
export function visibleTips(
  photoKeys: (string | undefined)[],
  tips: Record<string, PhotoTipKind[]>,
  dismissed: string[],
): TipLine[] {
  const lines: TipLine[] = [];
  photoKeys.forEach((key, i) => {
    if (!key || dismissed.includes(key)) return;
    const kind = tips[key]?.[0];
    if (kind) lines.push({ key, n: i + 1, kind });
  });
  return lines.slice(0, MAX_TIP_LINES);
}

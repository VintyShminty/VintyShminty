import {
  PHOTO_ASSIST_MAX_PHOTOS,
  PHOTO_TIP_KINDS,
  type PhotoTipKind,
  TEXT_ASSIST_MIN_CHARS,
} from "@vinty/shared";

/** At most this many text reads per sell form (D-036). */
export const MAX_TEXT_ASSIST_CALLS = 5;
/** At most this many tip lines under the photos. */
export const MAX_TIP_LINES = 2;

/** The text is long enough and not the same as the last text sent. */
export function shouldAskText(title: string, description: string, last: string): boolean {
  if (`${title}${description}`.trim().length < TEXT_ASSIST_MIN_CHARS) return false;
  return `${title}\n${description}`.trim() !== last;
}

/** Photos never checked before, oldest first, up to the most the server reads in one go. */
export function nextCheckKeys(photoKeys: string[], checked: ReadonlySet<string>): string[] {
  return photoKeys.filter((k) => !checked.has(k)).slice(0, PHOTO_ASSIST_MAX_PHOTOS);
}

export type TipLine = { key: string; n: number; kind: PhotoTipKind };

/**
 * One line per photo that still has a tip, in photo order. `n` is the photo's current place (1-based), the first kind
 * in the app's order of importance is the one shown.
 */
export function tipLines(
  order: (string | null)[],
  tips: Record<string, PhotoTipKind[]>,
  dismissed: string[],
): TipLine[] {
  const lines: TipLine[] = [];
  order.forEach((key, i) => {
    const kinds = key ? tips[key] : undefined;
    if (!key || !kinds || kinds.length === 0 || dismissed.includes(key)) return;
    const kind = PHOTO_TIP_KINDS.find((k) => kinds.includes(k));
    if (kind) lines.push({ key, n: i + 1, kind });
  });
  return lines.slice(0, MAX_TIP_LINES);
}

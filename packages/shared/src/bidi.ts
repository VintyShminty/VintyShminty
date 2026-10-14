const HEBREW = /[֐-׿]/;
const LATIN = /[A-Za-z]/;

/** True when text holds Hebrew letters. */
export const hasHebrew = (value: string) => HEBREW.test(value);

/**
 * Keeps a name or item title of the other script from scrambling the sentence around it. An English sentence with a
 * Hebrew title (or a Hebrew sentence with a Latin one) puts the title in an isolated run, so the words stay in order.
 */
export function isolate(value: string, sentenceIsHebrew: boolean): string {
  const clash = sentenceIsHebrew ? LATIN.test(value) && !HEBREW.test(value) : HEBREW.test(value);
  return clash ? `⁨${value}⁩` : value;
}

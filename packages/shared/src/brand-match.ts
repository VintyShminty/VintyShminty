/**
 * Matching a brand written in Hebrew letters against its English name when we have no Hebrew name for it. Both sides
 * are boiled down to a "sound skeleton": the consonants only, similar sounds merged, doubles collapsed. "Michael Kors"
 * and "מייקל קורס" both come out as mklkrs, "Levi's" and "ליוויס" as lbs. It is a fallback that guesses, so callers
 * use it only after exact names and aliases found nothing.
 */

import { hasHebrew } from "./bidi.js";

const HEBREW_SOUNDS: Record<string, string> = {
  א: "",
  ב: "b",
  ג: "g",
  ד: "d",
  ה: "",
  ו: "",
  ז: "s",
  ח: "k",
  ט: "t",
  י: "",
  כ: "k",
  ך: "k",
  ל: "l",
  מ: "m",
  ם: "m",
  נ: "n",
  ן: "n",
  ס: "s",
  ע: "",
  פ: "p",
  ף: "p",
  צ: "s",
  ץ: "s",
  ק: "k",
  ר: "r",
  ש: "s",
  ת: "t",
};

const collapse = (text: string) => text.replace(/(.)\1+/g, "$1");

/** The sound skeleton of a text written in Hebrew letters. Letters from other alphabets are ignored. */
export function hebrewSkeleton(text: string): string {
  // A doubled letter in the source counts once (the vowels between letters are not written, so only real doubles).
  const letters = text
    .normalize("NFC")
    .replace(/[֑-ׇ]/g, "")
    .replace(/([א-ת])\1+/g, (run, c: string) => (c === "ו" ? run : c));
  let out = "";
  for (let i = 0; i < letters.length; i++) {
    const ch = letters[i] as string;
    const next = letters[i + 1];
    const marked = next === "'" || next === "’" || next === "׳";
    if (ch === "ו" && next === "ו") {
      out += "b"; // וו is a v
      i += 1;
    } else if (marked && (ch === "ג" || ch === "ז")) {
      out += "j";
    } else if (marked && (ch === "צ" || ch === "ש")) {
      out += "k"; // צ' is "ch" (Chicco) and merges with k like the Latin ch below
    } else if (ch === "ת" && marked) {
      out += "t";
    } else {
      out += HEBREW_SOUNDS[ch] ?? "";
    }
  }
  return out;
}

function latinOnce(text: string, chSound: string): string {
  let s = text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z]/g, "");
  s = collapse(s)
    .replace(/tch|ch/g, chSound)
    .replace(/sh|tz|ts/g, "s")
    .replace(/ph/g, "p")
    .replace(/th/g, "t")
    .replace(/ck|q/g, "k")
    .replace(/x/g, "ks")
    .replace(/c(?=[eiy])/g, "s")
    .replace(/c/g, "k")
    .replace(/[wv]/g, "b")
    .replace(/f/g, "p")
    .replace(/z/g, "s")
    .replace(/[aeiouyh]/g, "");
  return s;
}

/** The sound skeletons of a Latin text. "ch" can sound like k (Michael) or sh (Chanel), so there are two. */
export function latinSkeletons(text: string): string[] {
  return [...new Set([latinOnce(text, "k"), latinOnce(text, "s")])].filter(Boolean);
}

/** All skeletons of a text in either alphabet. */
export function skeletonsOf(text: string): string[] {
  if (hasHebrew(text)) {
    const s = hebrewSkeleton(text);
    return s ? [s] : [];
  }
  return latinSkeletons(text);
}

/** At most one letter apart, and only for skeletons long enough that this is not a coincidence. */
function oneApart(a: string, b: string): boolean {
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i += 1;
  if (a.length === b.length) return a.slice(i + 1) === b.slice(i + 1);
  const [long, short] = a.length > b.length ? [a, b] : [b, a];
  return long.slice(i + 1) === short.slice(i);
}

/** Two skeletons are the same sound: equal (two letters or more) or, from six letters, one letter apart. */
export function skeletonsMatch(a: string, b: string): boolean {
  if (a.length < 2 || b.length < 2) return false;
  if (a === b) return true;
  return a.length >= 6 && b.length >= 6 && oneApart(a, b);
}

/** True when any skeleton of one text matches any skeleton of the other. */
export function soundsAlike(a: string, b: string): boolean {
  const left = skeletonsOf(a);
  const right = skeletonsOf(b);
  return left.some((x) => right.some((y) => skeletonsMatch(x, y)));
}

import { randomInt } from "node:crypto";
import { USERNAME_MAX, USERNAME_MIN } from "@vinty/shared";

const trimEnds = (text: string) => text.replace(/^[._]+|[._]+$/g, "");

/**
 * The starting point for a generated username: the part of the email before the @, lowercase, with only
 * letters, numbers, dots and underscores kept, no dots or underscores at the ends, at most USERNAME_MAX long.
 * It can come back short or empty. generateUsername pads it.
 */
export function usernameBase(email: string): string {
  const at = email.lastIndexOf("@");
  const local = at >= 0 ? email.slice(0, at) : email;
  return trimEnds(local.toLowerCase().replace(/[^a-z0-9._]/g, "")).slice(0, USERNAME_MAX);
}

const digits = (count: number) => {
  let out = "";
  for (let i = 0; i < count; i++) out += String(randomInt(0, 10));
  return out;
};

/** The base plus a suffix, cut so the whole thing fits, never ending in a dot or underscore before the suffix. */
function withSuffix(base: string, suffix: string): string {
  const room = USERNAME_MAX - suffix.length;
  return `${trimEnds(base.slice(0, room))}${suffix}`;
}

/**
 * A free username for a new account. `isTaken` must compare case insensitively (usernames are stored lowercase).
 * 1. The cleaned email start as it is, if it is long enough and free.
 * 2. Otherwise the start plus a few random digits (2, then 4, then 6 as it keeps colliding).
 * 3. A start that is too short is padded with digits to USERNAME_MIN, and an empty one becomes "user" plus digits.
 */
export async function generateUsername(
  email: string,
  isTaken: (username: string) => Promise<boolean>,
): Promise<string> {
  const base = usernameBase(email) || "user";
  if (base.length >= USERNAME_MIN && !(await isTaken(base))) return base;
  for (const count of [2, 2, 2, 4, 4, 4, 6, 6, 6, 8]) {
    const candidate = withSuffix(base, digits(count));
    if (candidate.length >= USERNAME_MIN && !(await isTaken(candidate))) return candidate;
  }
  throw new Error("Could not find a free username");
}

/** Apple's "hide my email" gives a random address. A name made of it would be gibberish, so use the person's name. */
const RELAY_DOMAIN = "@privaterelay.appleid.com";

/** What to make the username from: the email, or the name when the email is an Apple relay address. */
export function usernameSource(email: string, name?: unknown): string {
  if (!email.toLowerCase().endsWith(RELAY_DOMAIN)) return email;
  const first = typeof name === "string" ? name.trim().split(/\s+/)[0] : "";
  return `${first ?? ""}@relay`;
}

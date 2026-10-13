import { create } from "zustand";
import { readPref, writePref } from "@/lib/secure-prefs";

// The two sign up questions (what do you shop for, your sizes) are shown once, right after a new account is made.
// Sign up marks the person as pending, the app layout opens the screen, finishing or skipping marks it done.
// Kept on the phone per person. Logging in to an existing account never starts it.

const key = (userId: string) => `vinty.onboarding.${userId}`;

// Bumped whenever a mark changes so screens read the saved value again.
const useVersion = create<{ version: number }>(() => ({ version: 0 }));
const bump = () => useVersion.setState((s) => ({ version: s.version + 1 }));

export function markOnboardingPending(userId: string) {
  writePref(key(userId), "pending");
  bump();
}

export function finishOnboarding(userId: string) {
  writePref(key(userId), "done");
  bump();
}

export function isOnboardingPending(userId: string | undefined): boolean {
  return Boolean(userId) && readPref(key(userId as string)) === "pending";
}

/** True while this person still has the sign up questions to go through. */
export function useOnboardingPending(userId: string | undefined): boolean {
  useVersion((s) => s.version);
  return isOnboardingPending(userId);
}

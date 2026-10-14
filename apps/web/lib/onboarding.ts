"use client";

// The two sign up questions are shown once, right after a new account is made (D-022). Like the app, sign up marks the
// person as pending, finishing or skipping marks it done. Kept in this browser per person. Logging in to an existing
// account never starts it.

const key = (userId: string) => `vinty.onboarding.${userId}`;

function read(userId: string): string | null {
  try {
    return window.localStorage.getItem(key(userId));
  } catch {
    return null;
  }
}

function write(userId: string, value: "pending" | "done") {
  try {
    window.localStorage.setItem(key(userId), value);
  } catch {
    // Private windows can refuse storage, the questions are then simply not remembered.
  }
}

export const markOnboardingPending = (userId: string) => write(userId, "pending");
export const finishOnboarding = (userId: string) => write(userId, "done");
export const isOnboardingPending = (userId: string) => read(userId) === "pending";

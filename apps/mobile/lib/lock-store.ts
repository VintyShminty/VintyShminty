import { create } from "zustand";
import { LOCK_AFTER_MS } from "@/lib/config";
import { readPref, writePref } from "@/lib/secure-prefs";

// Face ID unlock is a feature of this phone, so the switch lives in secure storage on the phone and not on the server.
// It is kept per person: if someone else logs in on this phone, they get their own choice.

const enabledKey = (userId: string) => `vinty.faceid.enabled.${userId}`;
const offeredKey = (userId: string) => `vinty.faceid.offered.${userId}`;

export const isFaceIdEnabled = (userId: string) => readPref(enabledKey(userId)) === "1";
export const wasFaceIdOffered = (userId: string) => readPref(offeredKey(userId)) === "1";
export const markFaceIdOffered = (userId: string) => writePref(offeredKey(userId), "1");

type LockState = {
  /** Switches changed during this run. Reading from here (not only secure storage) makes screens redraw. */
  changed: Record<string, boolean>;
  /** True once the person has got past Face ID (or just logged in) in this run of the app. */
  unlocked: boolean;
  backgroundedAt: number | null;
  setFaceIdEnabled: (userId: string, enabled: boolean) => void;
  unlock: () => void;
  noteBackground: () => void;
  /** Called when the app comes back. Locks again if it was away for more than the allowed time. */
  noteForeground: (userId: string | undefined) => void;
};

export const useLockStore = create<LockState>((set, get) => ({
  changed: {},
  unlocked: false,
  backgroundedAt: null,
  setFaceIdEnabled: (userId, enabled) => {
    writePref(enabledKey(userId), enabled ? "1" : "0");
    set((s) => ({ changed: { ...s.changed, [userId]: enabled }, unlocked: true }));
  },
  unlock: () => set({ unlocked: true }),
  noteBackground: () => set({ backgroundedAt: Date.now() }),
  noteForeground: (userId) => {
    const { backgroundedAt } = get();
    set({ backgroundedAt: null });
    if (
      userId &&
      isFaceIdEnabled(userId) &&
      backgroundedAt !== null &&
      Date.now() - backgroundedAt > LOCK_AFTER_MS
    ) {
      set({ unlocked: false });
    }
  },
}));

/** Is Face ID on for this person? Redraws the screen when it changes. */
export function useFaceIdEnabled(userId: string | undefined): boolean {
  return useLockStore((s) => (userId ? (s.changed[userId] ?? isFaceIdEnabled(userId)) : false));
}

/** Should the lock screen cover the app right now? */
export function useIsLocked(userId: string | undefined): boolean {
  const unlocked = useLockStore((s) => s.unlocked);
  const enabled = useFaceIdEnabled(userId);
  return Boolean(userId) && enabled && !unlocked;
}

import * as SecureStore from "expo-secure-store";
import { create } from "zustand";
import { isExpoGoOnIos, promptBiometric } from "@/lib/biometrics";
import { readPref, writePref } from "@/lib/secure-prefs";

// Log in with Face ID. Once you are logged in you stay logged in (no lock when the app opens). Face ID is for the
// moment you have to log in again: the email and password are kept in the phone's keychain behind Face ID, so
// reading them back makes iOS ask for your face first. Only this phone has them, they never leave it.
//
// Two entries: the email and password behind Face ID, and a plain note of whose they are, so the app can show
// the button and the Security switch without asking for Face ID.

const SECRET_KEY = "vinty.facelogin.secret";
const NOTE_KEY = "vinty.facelogin.note";
const offeredKey = (userId: string) => `vinty.facelogin.offered.${userId}`;

type Note = { email: string; userId: string };
type Secret = { email: string; password: string };

// Expo Go cannot show the real Face ID sheet (see lib/biometrics.ts), so there the keychain entry is a plain one and
// our simulated prompt stands in front of it. Real builds let iOS itself guard the entry.
const guarded = (prompt: string): SecureStore.SecureStoreOptions =>
  isExpoGoOnIos
    ? {}
    : {
        requireAuthentication: true,
        authenticationPrompt: prompt,
        keychainAccessible: SecureStore.WHEN_PASSCODE_SET_THIS_DEVICE_ONLY,
      };

function readNote(): Note | null {
  const raw = readPref(NOTE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Note;
  } catch {
    return null;
  }
}

type SavedLoginState = {
  /** Whose login is saved on this phone. Kept here so screens redraw when it changes. */
  note: Note | null;
  set: (note: Note | null) => void;
};

const useSavedLoginStore = create<SavedLoginState>((set) => ({
  note: readNote(),
  set: (note) => set({ note }),
}));

/** Whose login is saved for Face ID on this phone, if any. */
export const useSavedLogin = () => useSavedLoginStore((s) => s.note);

export function hasSavedLoginFor(userId: string | undefined) {
  return Boolean(userId) && useSavedLoginStore.getState().note?.userId === userId;
}

/** Keep this email and password behind Face ID. Asks for Face ID first, so nobody saves one they cannot open. */
export async function saveLogin(
  login: { email: string; password: string; userId: string },
  prompt: string,
  cancelLabel: string,
): Promise<boolean> {
  const check = await promptBiometric(prompt, cancelLabel);
  if (!check.success) return false;
  return storeLogin(login, prompt);
}

/** Replace the saved password without asking (a new password for someone who already chose Face ID). */
export async function storeLogin(login: { email: string; password: string; userId: string }, prompt: string) {
  try {
    const secret: Secret = { email: login.email, password: login.password };
    await SecureStore.setItemAsync(SECRET_KEY, JSON.stringify(secret), guarded(prompt));
  } catch (err) {
    if (__DEV__) console.warn("Could not save the login for Face ID:", err);
    return false;
  }
  const note = { email: login.email, userId: login.userId };
  writePref(NOTE_KEY, JSON.stringify(note));
  useSavedLoginStore.getState().set(note);
  return true;
}

/** Asks for Face ID and hands back the saved email and password, or null when Face ID was refused or failed. */
export async function readSavedLogin(prompt: string, cancelLabel: string): Promise<Secret | null> {
  try {
    if (isExpoGoOnIos) {
      const check = await promptBiometric(prompt, cancelLabel);
      if (!check.success) return null;
    }
    const raw = await SecureStore.getItemAsync(SECRET_KEY, guarded(prompt));
    if (!raw) {
      forgetLogin();
      return null;
    }
    return JSON.parse(raw) as Secret;
  } catch (err) {
    // Cancelled, or the faces on the phone changed (iOS then throws the entry away).
    if (__DEV__) console.warn("Face ID login did not open:", err);
    return null;
  }
}

export function forgetLogin() {
  SecureStore.deleteItemAsync(SECRET_KEY, guarded("")).catch(() => {});
  writePref(NOTE_KEY, null);
  useSavedLoginStore.getState().set(null);
}

// The offer after a password login. The password is held in memory only until the offer closes.
let pending: { email: string; password: string; userId: string } | null = null;

export function notePasswordLogin(
  login: { email: string; password: string; userId: string },
  prompt: string,
) {
  // Someone who already chose Face ID gets the newest password saved quietly. Anyone else may be offered it.
  if (hasSavedLoginFor(login.userId)) {
    void storeLogin(login, prompt);
    pending = null;
    return;
  }
  pending = login;
}

export const pendingLoginFor = (userId: string | undefined) =>
  pending && pending.userId === userId ? pending : null;

export function closeOffer(userId: string) {
  writePref(offeredKey(userId), "1");
  pending = null;
}

export const wasOffered = (userId: string) => readPref(offeredKey(userId)) === "1";

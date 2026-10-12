import * as SecureStore from "expo-secure-store";

// Small on-device preferences (language, Face ID). SecureStore can throw (for example in a simulator
// without a keychain), so every call is wrapped and the app works without it.

export function readPref(key: string): string | null {
  try {
    return SecureStore.getItem(key);
  } catch (err) {
    if (__DEV__) console.warn("Could not read a preference:", key, err);
    return null;
  }
}

export function writePref(key: string, value: string | null) {
  try {
    if (value === null) SecureStore.deleteItemAsync(key).catch(() => {});
    else SecureStore.setItem(key, value);
  } catch (err) {
    // Not saved. The setting simply resets next launch.
    if (__DEV__) console.warn("Could not save a preference:", key, err);
  }
}

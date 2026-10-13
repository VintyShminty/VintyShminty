import * as AppleAuthentication from "expo-apple-authentication";
import { uuid } from "expo-modules-core";
import { authClient } from "@/lib/auth-client";
import { useLockStore } from "@/lib/lock-store";
import { markOnboardingPending } from "@/lib/onboarding";
import { socialErrorKey } from "@/lib/social-errors";

export type SocialProvider = "apple" | "google";
/** `key` is a translation key and `provider` is the name to put in it. */
export type SocialResult =
  | { status: "ok" }
  | { status: "cancelled" }
  | { status: "error"; key: string; provider: SocialProvider };

/** An account made less than this long ago is new: it gets the two short questions once (lib/onboarding.ts). */
const NEW_ACCOUNT_MS = 2 * 60 * 1000;

type SignedInUser = { id?: string; createdAt?: string | number | Date } | null | undefined;

/** Unlocks the app and starts the sign up questions for a brand new account. */
export function finishSocialSignIn(user: SignedInUser) {
  if (user?.id && user.createdAt) {
    const age = Date.now() - new Date(user.createdAt).getTime();
    if (age >= 0 && age < NEW_ACCOUNT_MS) markOnboardingPending(user.id);
  }
  useLockStore.getState().unlock();
}

/** Apple's sheet gives an ID token, the server checks it and signs the person in. Name and email only come the first time. */
export async function signInWithApple(): Promise<SocialResult> {
  let credential: AppleAuthentication.AppleAuthenticationCredential;
  // Apple puts this value inside the signed token, so a stolen token cannot be replayed with another request.
  const nonce = uuid.v4();
  try {
    credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
      nonce,
    });
  } catch (err) {
    if ((err as { code?: string }).code === "ERR_REQUEST_CANCELED") return { status: "cancelled" };
    return { status: "error", key: "errors.socialFailed", provider: "apple" };
  }
  if (!credential.identityToken) return { status: "error", key: "errors.socialFailed", provider: "apple" };

  const { givenName, familyName } = credential.fullName ?? {};
  try {
    const { data, error } = await authClient.signIn.social({
      provider: "apple",
      idToken: {
        token: credential.identityToken,
        nonce,
        user: {
          ...(givenName || familyName
            ? { name: { firstName: givenName ?? undefined, lastName: familyName ?? undefined } }
            : {}),
          ...(credential.email ? { email: credential.email } : {}),
        },
      },
    });
    if (error) return { status: "error", key: socialErrorKey(error), provider: "apple" };
    finishSocialSignIn((data as { user?: SignedInUser } | null)?.user);
    return { status: "ok" };
  } catch {
    return { status: "error", key: "errors.network", provider: "apple" };
  }
}

/**
 * Google opens the system browser sheet, the person picks an account, and the server sends them back to the app
 * (address vinty://). The browser flow needs only the web client, no extra native library.
 */
export async function signInWithGoogle(): Promise<SocialResult> {
  try {
    const { error } = await authClient.signIn.social({ provider: "google", callbackURL: "/" });
    if (error) return { status: "error", key: socialErrorKey(error), provider: "google" };
    // Closing the sheet is not an error. Signed in means the session now exists.
    const session = await authClient.getSession();
    const user = session.data?.user as SignedInUser;
    if (!user) return { status: "cancelled" };
    finishSocialSignIn(user);
    return { status: "ok" };
  } catch {
    return { status: "error", key: "errors.network", provider: "google" };
  }
}

/** Turns a Better Auth error into a translation key and, when it fits one field, which field. Shared by the app and the website. */
export type AuthError = { code?: string; message?: string; status?: number } | null | undefined;

/** Translation keys for the errors Better Auth can send back. Anything unknown becomes a general message. */
const CODE_TO_KEY: Record<string, string> = {
  INVALID_EMAIL_OR_PASSWORD: "errors.wrongLogin",
  INVALID_PASSWORD: "errors.wrongPassword",
  USER_NOT_FOUND: "errors.wrongLogin",
  USER_ALREADY_EXISTS: "errors.emailTaken",
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: "errors.emailTaken",
  USERNAME_IS_ALREADY_TAKEN: "validation.username.taken",
  INVALID_USERNAME: "validation.username.characters",
  USERNAME_TOO_SHORT: "validation.username.tooShort",
  USERNAME_TOO_LONG: "validation.username.tooLong",
  PASSWORD_TOO_SHORT: "validation.password.tooShort",
  PASSWORD_TOO_LONG: "validation.password.tooLong",
  INVALID_EMAIL: "validation.email.invalid",
  INVALID_OTP: "errors.wrongCode",
  OTP_EXPIRED: "errors.codeExpired",
  TOO_MANY_ATTEMPTS: "errors.tooManyAttempts",
  EMAIL_NOT_VERIFIED: "errors.emailNotVerified",
  BANNED_USER: "errors.banned",
  CAPTCHA_FAILED: "errors.botCheck",
};

/** Where a server problem belongs on a form: under one field, or in the banner at the top. */
export function describeAuthError(error: AuthError): {
  key: string;
  field?: "email" | "username" | "password" | "otp";
} {
  if (!error) return { key: "errors.general" };
  if (error.status === 429) return { key: "errors.tooManyRequests" };
  if (
    error.status === 0 ||
    error.message === "Network request failed" ||
    error.message === "Failed to fetch"
  ) {
    return { key: "errors.network" };
  }
  const key =
    (error.code && CODE_TO_KEY[error.code]) ||
    (error.message?.toLowerCase().includes("already in use") ? "errors.emailTaken" : "errors.general");
  const field = key.startsWith("validation.username")
    ? "username"
    : key === "errors.emailTaken" || key === "validation.email.invalid"
      ? "email"
      : key.startsWith("validation.password")
        ? "password"
        : key === "errors.wrongCode" || key === "errors.codeExpired"
          ? "otp"
          : undefined;
  return { key, field };
}

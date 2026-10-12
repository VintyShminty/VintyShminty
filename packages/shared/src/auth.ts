import { z } from "zod";

/**
 * Validation for sign up, log in and password screens. Shared by the app (react-hook-form) and the server.
 * Every message is a translation key, not English text, so the app can show it in Hebrew or English.
 * The keys live under `validation` in the app's locale files. A test keeps both languages complete.
 */

export const VALIDATION_MESSAGES = [
  "validation.email.required",
  "validation.email.invalid",
  "validation.username.required",
  "validation.username.tooShort",
  "validation.username.tooLong",
  "validation.username.characters",
  "validation.username.taken",
  "validation.password.required",
  "validation.password.tooShort",
  "validation.password.tooLong",
  "validation.password.mismatch",
  "validation.password.same",
  "validation.code.invalid",
  "validation.name.tooLong",
  "validation.bio.tooLong",
  "validation.city.tooLong",
] as const;
export type ValidationMessage = (typeof VALIDATION_MESSAGES)[number];

export const USERNAME_MIN = 3;
export const USERNAME_MAX = 24;
export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 128;
export const OTP_LENGTH = 6;
export const BIO_MAX = 500;
export const NAME_MAX = 50;
export const CITY_MAX = 80;

export const emailSchema = z
  .string()
  .trim()
  .min(1, "validation.email.required")
  .max(254, "validation.email.invalid")
  .email("validation.email.invalid");

export const usernameSchema = z
  .string()
  .trim()
  .min(1, "validation.username.required")
  .min(USERNAME_MIN, "validation.username.tooShort")
  .max(USERNAME_MAX, "validation.username.tooLong")
  .regex(/^[a-zA-Z0-9_.]+$/, "validation.username.characters");

export const passwordSchema = z
  .string()
  .min(1, "validation.password.required")
  .min(PASSWORD_MIN, "validation.password.tooShort")
  .max(PASSWORD_MAX, "validation.password.tooLong");

export const otpSchema = z
  .string()
  .trim()
  .regex(new RegExp(`^\\d{${OTP_LENGTH}}$`), "validation.code.invalid");

/** Sign up with email, username and password. */
export const signUpInputSchema = z.object({
  email: emailSchema,
  username: usernameSchema,
  password: passwordSchema,
});
export type SignUpInput = z.infer<typeof signUpInputSchema>;

/** Log in. The password rule is only "not empty": an old or odd password must still be tried. */
export const signInInputSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "validation.password.required"),
});
export type SignInInput = z.infer<typeof signInInputSchema>;

export const forgotPasswordInputSchema = z.object({ email: emailSchema });
export type ForgotPasswordInput = z.infer<typeof forgotPasswordInputSchema>;

/** Second step of the reset: the 6 digit code from the email plus the new password. */
export const resetPasswordInputSchema = z.object({
  email: emailSchema,
  otp: otpSchema,
  password: passwordSchema,
});
export type ResetPasswordInput = z.infer<typeof resetPasswordInputSchema>;

/** The form on the phone adds a repeat field. The server only needs the first two. */
export const changePasswordFormSchema = z
  .object({
    currentPassword: z.string().min(1, "validation.password.required"),
    newPassword: passwordSchema,
    confirmPassword: z.string().min(1, "validation.password.required"),
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    path: ["confirmPassword"],
    message: "validation.password.mismatch",
  })
  .refine((v) => v.newPassword !== v.currentPassword, {
    path: ["newPassword"],
    message: "validation.password.same",
  });
export type ChangePasswordForm = z.infer<typeof changePasswordFormSchema>;

export const verifyCodeInputSchema = z.object({ otp: otpSchema });

export const changeEmailInputSchema = z.object({ email: emailSchema });

/** DELETE /v1/me. Accounts without a password (Google or Apple only) send no password. */
export const deleteAccountInputSchema = z.object({
  password: z.string().min(1).max(PASSWORD_MAX).optional(),
});
export type DeleteAccountInput = z.infer<typeof deleteAccountInputSchema>;

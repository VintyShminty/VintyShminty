import { describe, expect, it } from "vitest";
import {
  changePasswordFormSchema,
  editProfileFormSchema,
  resetPasswordInputSchema,
  signInInputSchema,
  signUpInputSchema,
  VALIDATION_MESSAGES,
} from "./auth.js";

const messages = (result: { success: boolean; error?: { issues: { message: string }[] } }) =>
  result.error?.issues.map((i) => i.message) ?? [];

describe("account validation", () => {
  it("accepts a good sign up", () => {
    expect(
      signUpInputSchema.safeParse({ email: "a@b.co", username: "dana_l", password: "longenough" }).success,
    ).toBe(true);
  });

  it("explains each sign up problem with a translation key", () => {
    const result = signUpInputSchema.safeParse({ email: "nope", username: "a b", password: "short" });
    expect(messages(result)).toEqual(
      expect.arrayContaining([
        "validation.email.invalid",
        "validation.username.characters",
        "validation.password.tooShort",
      ]),
    );
  });

  it("only uses keys listed in VALIDATION_MESSAGES", () => {
    const results = [
      signUpInputSchema.safeParse({ email: "", username: "", password: "" }),
      signInInputSchema.safeParse({ email: "x", password: "" }),
      resetPasswordInputSchema.safeParse({ email: "x", otp: "12", password: "1" }),
      editProfileFormSchema.safeParse({ name: "", bio: "x".repeat(600), city: "y".repeat(90) }),
      changePasswordFormSchema.safeParse({ currentPassword: "", newPassword: "short", confirmPassword: "" }),
    ];
    for (const key of results.flatMap(messages)) expect(VALIDATION_MESSAGES).toContain(key);
  });

  it("log in only needs a password to be present, so old passwords still work", () => {
    expect(signInInputSchema.safeParse({ email: "a@b.co", password: "x" }).success).toBe(true);
  });

  it("wants a 6 digit reset code", () => {
    const base = { email: "a@b.co", password: "longenough" };
    expect(resetPasswordInputSchema.safeParse({ ...base, otp: "123456" }).success).toBe(true);
    expect(resetPasswordInputSchema.safeParse({ ...base, otp: "12345" }).success).toBe(false);
    expect(resetPasswordInputSchema.safeParse({ ...base, otp: "12345a" }).success).toBe(false);
  });

  it("checks the repeat password and that the password changed", () => {
    const base = {
      currentPassword: "old-password",
      newPassword: "new-password",
      confirmPassword: "new-password",
    };
    expect(changePasswordFormSchema.safeParse(base).success).toBe(true);
    expect(messages(changePasswordFormSchema.safeParse({ ...base, confirmPassword: "other-one" }))).toContain(
      "validation.password.mismatch",
    );
    expect(
      messages(
        changePasswordFormSchema.safeParse({
          ...base,
          newPassword: "old-password",
          confirmPassword: "old-password",
        }),
      ),
    ).toContain("validation.password.same");
  });
});

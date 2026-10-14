/**
 * Better Auth sends a refused Google or Apple login back to the log in page with `?error=<code>`. This turns the code
 * into the same words the app uses (apps/mobile/lib/social-errors.ts). Cancelling is not an error, so it says nothing.
 */
export function socialErrorKeyFromCode(code: string | null | undefined): string | null {
  if (!code) return null;
  switch (code.toLowerCase()) {
    case "access_denied":
    case "user_cancelled_authorize":
    case "user_cancelled_login":
    case "user_cancelled":
      return null;
    case "email_not_found":
      return "errors.socialNoEmail";
    case "unable_to_link_account":
    case "account_not_linked":
    case "email_not_verified":
    case "oauth_link_error":
      return "errors.socialBlocked";
    case "oauth_provider_not_found":
    case "provider_not_found":
      return "errors.socialUnavailable";
    case "banned_user":
    case "banned":
      return "errors.banned";
    default:
      return "errors.socialFailed";
  }
}

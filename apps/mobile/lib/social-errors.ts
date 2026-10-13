type ErrorLike = { code?: string; status?: number; message?: string } | null | undefined;

/** What went wrong in words the person can use. */
export function socialErrorKey(error: ErrorLike): string {
  if (error?.status === 0 || error?.message === "Network request failed") return "errors.network";
  if (error?.status === 429) return "errors.tooManyRequests";
  if (error?.code === "USER_EMAIL_NOT_FOUND") return "errors.socialNoEmail";
  if (error?.code === "PROVIDER_NOT_FOUND" || error?.status === 404) return "errors.socialUnavailable";
  if (error?.code === "BANNED_USER") return "errors.banned";
  if (error?.code === "OAUTH_LINK_ERROR" || error?.code === "EMAIL_NOT_VERIFIED")
    return "errors.socialBlocked";
  return "errors.socialFailed";
}

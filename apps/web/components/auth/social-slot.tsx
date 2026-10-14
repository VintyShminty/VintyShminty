/**
 * The place for "Continue with Apple" and "Continue with Google" under an "or" line (D-023). They come in round 2 of
 * W3 and show only when GET /v1/auth/providers says a provider is on. Until then the slot renders nothing, so the
 * pages already have the right gap and the buttons only need to be dropped in here.
 */
export function SocialSlot() {
  return null;
}

import { normaliseInviteCode } from "@vinty/shared";
import { PAGE_STYLE } from "./auth-error-page.js";

/**
 * The page behind an invite link (`/invite/<code>`). It shows the code and says how to use it, in English and
 * Hebrew, in the same look as the sign in error page and under the same policy (nothing loads, one style block).
 * Only a code made of the allowed characters is ever printed. Anything else gets the page without a code, so
 * nothing from the address can reach the HTML. The real domain comes later, the link uses BETTER_AUTH_URL.
 */

const VALID = /^[A-Z0-9]{4,20}$/;

/** Returns the clean code, or null when the text is not a possible code. */
export function cleanInviteCode(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const code = normaliseInviteCode(raw);
  return VALID.test(code) ? code : null;
}

/** Keeps a configured scheme from breaking out of the attribute. */
function safeScheme(scheme: string): string {
  return /^[a-z][a-z0-9+.-]*$/i.test(scheme) ? scheme : "vinty";
}

export function invitePage(raw: unknown, appScheme: string): string {
  const code = cleanInviteCode(raw);
  const href = `${safeScheme(appScheme)}://`;
  const codeBox = code ? `<p class="code">${code}</p>` : "";
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Yadii</title>
<style>${PAGE_STYLE}</style>
</head>
<body>
<main>
<p class="brand">Yadii</p>
<section lang="en"><h1>A friend invited you to Yadii</h1><p>Get the Yadii app, create your account, then open Profile, Invite friends and enter this code. When your first order is done, you both get a voucher.</p>${codeBox}<a class="btn" href="${href}">Open Yadii</a></section>
<section lang="he" dir="rtl"><h1>חבר/ה הזמינו אתכם ל-Yadii</h1><p>הורידו את האפליקציה, פתחו חשבון, ואז היכנסו לפרופיל, הזמנת חבר/ה, והזינו את הקוד. כשההזמנה הראשונה שלכם תושלם, שניכם תקבלו שובר.</p>${codeBox}<a class="btn" href="${href}">פתיחת Yadii</a></section>
</main>
</body>
</html>`;
}

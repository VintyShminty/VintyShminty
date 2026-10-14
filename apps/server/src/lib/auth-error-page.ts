import { createHash } from "node:crypto";

/**
 * The page shown inside the browser sheet when Google or Apple sign in is refused (Better Auth redirects to
 * /v1/auth/error?error=<code>, see onAPIError.errorURL in lib/auth.ts).
 *
 * Only fixed messages are ever written into the page. The code from the address is used as a lookup key and
 * never printed, so nothing from the query can reach the HTML. Colours are copied from
 * packages/design/tokens.js (the hard coded colour rule covers the mobile app folders only).
 */

type Message = { title: string; body: string };
type Pair = { en: Message; he: Message };

const GENERIC: Pair = {
  en: {
    title: "Something went wrong",
    body: "We could not finish logging you in. Please go back to Vinty and try again.",
  },
  he: {
    title: "משהו השתבש",
    body: "לא הצלחנו להשלים את ההתחברות. חזרו לאפליקציה ונסו שוב.",
  },
};

const MESSAGES = new Map<string, Pair>([
  [
    "account_not_linked",
    {
      en: {
        title: "This email already has a Vinty account",
        body: "Log in with your email and password, then confirm your email with the code we send you. After that, Google or Apple will connect to the same account.",
      },
      he: {
        title: "לכתובת האימייל הזו כבר יש חשבון Vinty",
        body: "התחברו עם האימייל והסיסמה, ואשרו את האימייל עם הקוד שנשלח אליכם. אחרי זה גוגל או אפל יתחברו לאותו חשבון.",
      },
    },
  ],
  [
    "account_already_linked_to_different_user",
    {
      en: {
        title: "This login belongs to another account",
        body: "That Google or Apple login is already connected to a different Vinty account. Log in with the email you used for that account.",
      },
      he: {
        title: "ההתחברות הזו שייכת לחשבון אחר",
        body: "ההתחברות עם גוגל או אפל כבר מחוברת לחשבון Vinty אחר. התחברו עם האימייל שבו השתמשתם בחשבון הזה.",
      },
    },
  ],
  [
    "email_not_found",
    {
      en: {
        title: "We need your email address",
        body: "Google or Apple did not share your email, and we need it to set up your account. Please try again and allow sharing your email.",
      },
      he: {
        title: "אנחנו צריכים את כתובת האימייל שלכם",
        body: "גוגל או אפל לא שיתפו את האימייל שלכם, ואנחנו צריכים אותו כדי לפתוח חשבון. נסו שוב ואשרו שיתוף של האימייל.",
      },
    },
  ],
  [
    "access_denied",
    {
      en: {
        title: "Login cancelled",
        body: "No problem. Go back to Vinty and try again whenever you are ready.",
      },
      he: {
        title: "ההתחברות בוטלה",
        body: "אין בעיה. חזרו לאפליקציה ונסו שוב כשיהיה לכם נוח.",
      },
    },
  ],
]);

/** The known error codes, for tests. */
export const KNOWN_AUTH_ERROR_CODES = [...MESSAGES.keys()];

export const PAGE_STYLE = `
*{box-sizing:border-box}
body{margin:0;background:#FBF8F2;color:#241811;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;line-height:1.5;-webkit-text-size-adjust:100%}
main{max-width:480px;margin:0 auto;padding:32px 16px}
.brand{font-size:28px;font-weight:300;letter-spacing:-0.5px;margin:0 0 24px;color:#4B2E22}
section{background:#FFFFFF;border:1px solid #E4DACA;border-radius:20px;padding:24px;margin:0 0 16px}
h1{font-size:22px;line-height:1.25;margin:0 0 8px;font-weight:700}
p{margin:0 0 20px;color:#54443A;font-size:16px}
a.btn{display:block;text-align:center;background:#4B2E22;color:#FFFFFF;text-decoration:none;font-weight:600;font-size:16px;padding:14px 16px;border-radius:12px}
a.btn:active{opacity:.85}
.code{font-size:32px;font-weight:700;letter-spacing:4px;text-align:center;background:#F1E9DA;border-radius:12px;padding:16px;margin:0 0 20px;color:#4B2E22;direction:ltr}
`.trim();

/** Hash of the inline style, so the page's policy allows exactly this style and nothing else. */
export const AUTH_ERROR_STYLE_HASH = `sha256-${createHash("sha256").update(PAGE_STYLE).digest("base64")}`;

/** The policy for this one route: nothing loads from anywhere, only the page's own style block applies. */
export const AUTH_ERROR_CSP = [
  "default-src 'none'",
  `style-src '${AUTH_ERROR_STYLE_HASH}'`,
  "base-uri 'none'",
  "form-action 'none'",
  "frame-ancestors 'none'",
].join("; ");

/** Keeps a configured scheme from breaking out of the attribute. */
function safeScheme(scheme: string): string {
  return /^[a-z][a-z0-9+.-]*$/i.test(scheme) ? scheme : "vinty";
}

function block(lang: "en" | "he", message: Message, href: string): string {
  const he = lang === "he";
  return `<section lang="${lang}"${he ? ' dir="rtl"' : ""}><h1>${message.title}</h1><p>${message.body}</p><a class="btn" href="${href}">${he ? "חזרה לאפליקציה" : "Back to Vinty"}</a></section>`;
}

/** Builds the page. `code` is only a lookup key, unknown codes (and anything hostile) get the generic message. */
export function authErrorPage(code: unknown, appScheme: string): string {
  const pair = (typeof code === "string" && MESSAGES.get(code)) || GENERIC;
  const href = `${safeScheme(appScheme)}://`;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Vinty</title>
<style>${PAGE_STYLE}</style>
</head>
<body>
<main>
<p class="brand">Vinty</p>
${block("en", pair.en, href)}
${block("he", pair.he, href)}
</main>
</body>
</html>`;
}

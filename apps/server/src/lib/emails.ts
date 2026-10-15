import type { Locale } from "@vinty/shared";
import type { MailMessage } from "./mail.js";

export type CodeEmailKind = "forget-password" | "email-verification" | "change-email" | "sign-in";

const COPY: Record<
  Locale,
  Record<CodeEmailKind, { subject: string; intro: string }> & {
    expires: string;
    ignore: string;
    signOff: string;
  }
> = {
  en: {
    "forget-password": {
      subject: "Your Yadii password reset code",
      intro: "Use this code to choose a new password.",
    },
    "email-verification": {
      subject: "Confirm your email for Yadii",
      intro: "Use this code to confirm your email address.",
    },
    "change-email": {
      subject: "Confirm your new email for Yadii",
      intro: "Use this code to confirm your new email address.",
    },
    "sign-in": { subject: "Your Yadii log in code", intro: "Use this code to log in." },
    expires: "The code works for 10 minutes.",
    ignore: "If you did not ask for this, you can ignore this email.",
    signOff: "The Yadii team",
  },
  he: {
    "forget-password": {
      subject: "קוד לאיפוס הסיסמה שלך ב-Yadii",
      intro: "השתמשו בקוד הזה כדי לבחור סיסמה חדשה.",
    },
    "email-verification": {
      subject: "אישור האימייל שלך ב-Yadii",
      intro: "השתמשו בקוד הזה כדי לאשר את כתובת האימייל.",
    },
    "change-email": {
      subject: "אישור האימייל החדש שלך ב-Yadii",
      intro: "השתמשו בקוד הזה כדי לאשר את כתובת האימייל החדשה.",
    },
    "sign-in": { subject: "קוד הכניסה שלך ל-Yadii", intro: "השתמשו בקוד הזה כדי להיכנס." },
    expires: "הקוד תקף ל-10 דקות.",
    ignore: "אם לא ביקשתם את זה, אפשר להתעלם מהאימייל.",
    signOff: "צוות Yadii",
  },
};

/** Email with a 6 digit code. The colours are the Espresso and cream palette (docs/design.md). */
export function codeEmail(to: string, kind: CodeEmailKind, code: string, locale: Locale): MailMessage {
  const c = COPY[locale];
  const dir = locale === "he" ? "rtl" : "ltr";
  const text = `${c[kind].intro}\n\n${code}\n\n${c.expires}\n${c.ignore}\n\n${c.signOff}`;
  const html = `<!doctype html>
<html dir="${dir}" lang="${locale}">
<body style="margin:0;padding:24px;background:#FBF8F2;font-family:-apple-system,Helvetica,Arial,sans-serif;color:#241811;">
  <div style="max-width:420px;margin:0 auto;background:#FFFFFF;border:1px solid #E4DACA;border-radius:20px;padding:32px;">
    <div style="font-size:22px;font-weight:800;letter-spacing:-0.5px;color:#4B2E22;">Yadii</div>
    <p style="font-size:16px;line-height:24px;margin:24px 0 16px;">${c[kind].intro}</p>
    <div style="font-size:36px;font-weight:700;letter-spacing:8px;text-align:center;background:#F7EEDC;color:#4B2E22;border-radius:12px;padding:16px 0;direction:ltr;">${code}</div>
    <p style="font-size:14px;line-height:20px;color:#54443A;margin:16px 0 0;">${c.expires}<br>${c.ignore}</p>
    <p style="font-size:14px;line-height:20px;color:#54443A;margin:24px 0 0;">${c.signOff}</p>
  </div>
</body>
</html>`;
  return { to, subject: c[kind].subject, text, html };
}

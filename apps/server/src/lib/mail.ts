import nodemailer from "nodemailer";
import type { Env } from "../env.js";

export type MailMessage = { to: string; subject: string; text: string; html: string };

/**
 * The only thing the rest of the server knows about email. Another provider (SES, Postmark)
 * is plugged in by writing another `Mailer` and choosing it in `createMailer`. Resend is built in.
 */
export interface Mailer {
  send(message: MailMessage): Promise<void>;
  close?(): Promise<void>;
}

/** Sends over SMTP. In development that is Mailpit, which shows every email at http://localhost:8025. */
function smtpMailer(env: Env): Mailer {
  const transport = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASSWORD } : undefined,
  });
  return {
    async send(message) {
      await transport.sendMail({ from: env.MAIL_FROM, ...message });
    },
    async close() {
      transport.close();
    },
  };
}

/**
 * Sends through Resend's web API (https://resend.com/docs/api-reference/emails/send-email). No library, one request.
 * Before a domain is verified, Resend only delivers from onboarding@resend.dev to the account owner's own address.
 */
export function resendMailer(
  env: Pick<Env, "RESEND_API_KEY" | "MAIL_FROM">,
  fetchImpl: typeof fetch = fetch,
): Mailer {
  const apiKey = env.RESEND_API_KEY;
  if (!apiKey) throw new Error("MAIL_TRANSPORT=resend needs RESEND_API_KEY");
  return {
    async send(message) {
      const response = await fetchImpl("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: env.MAIL_FROM,
          to: [message.to],
          subject: message.subject,
          text: message.text,
          html: message.html,
        }),
        signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) {
        // Resend answers { name, message }. The message is safe to log, the key is never in it.
        const detail = await response.json().catch(() => null);
        const reason = (detail as { message?: string } | null)?.message ?? response.statusText;
        throw new Error(`Resend refused the email (${response.status}): ${reason}`);
      }
    },
  };
}

/** Keeps mail in a list. Tests read the codes from it. */
export type MemoryMailer = Mailer & { outbox: MailMessage[] };
export function memoryMailer(): MemoryMailer {
  const outbox: MailMessage[] = [];
  return {
    outbox,
    async send(message) {
      outbox.push(message);
    },
  };
}

export function createMailer(env: Env): Mailer {
  if (env.MAIL_TRANSPORT === "memory") return memoryMailer();
  if (env.MAIL_TRANSPORT === "resend") return resendMailer(env);
  return smtpMailer(env);
}

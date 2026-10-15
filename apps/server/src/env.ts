import { z } from "zod";

/** Placeholder secret that .env.example ships with. Fine on a laptop, refused in production. */
export const DEV_AUTH_SECRET = "dev-only-secret-change-me-0123456789abcdef";

// Trimmed because values pasted into Vercel often carry an invisible line break at the end, and Google then
// rejects the client ID as unknown.
const optionalText = z
  .string()
  .optional()
  .transform((v) => v?.trim() || undefined);

/** True for an address on this machine (localhost, 127.0.0.1, ::1) or one that cannot be read. */
function isLocalAddress(value: string): boolean {
  try {
    const host = new URL(value).hostname;
    return ["localhost", "127.0.0.1", "::1", "[::1]"].includes(host);
  } catch {
    return true;
  }
}

const envSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    HOST: z.string().default("0.0.0.0"),
    PORT: z.coerce.number().int().min(1).max(65535).default(3000),
    LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
    DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
    CORS_ORIGIN: z.string().default("*"),
    /**
     * Addresses of the website (comma separated, for example https://vinty-web.vercel.app). The website sends
     * log in and API calls through its own address, so the server must trust it. In development the website's
     * local address (http://localhost:3001) is always trusted.
     */
    WEB_ORIGINS: z.string().default(""),

    // Better Auth
    BETTER_AUTH_SECRET: z
      .string()
      .min(32, "BETTER_AUTH_SECRET must be at least 32 characters")
      .default(DEV_AUTH_SECRET),
    /** Public address of this server. Better Auth builds links and cookies from it. */
    BETTER_AUTH_URL: z.string().url().default("http://localhost:3000"),
    /** Deep link scheme of the phone app (app.json "scheme"). */
    APP_SCHEME: z.string().default("vinty"),
    /** Auth routes that create or check credentials: allowed requests per minute per IP. */
    AUTH_RATE_LIMIT_MAX: z.coerce.number().int().min(1).default(10),
    GOOGLE_CLIENT_ID: optionalText,
    GOOGLE_CLIENT_SECRET: optionalText,
    APPLE_CLIENT_ID: optionalText,
    APPLE_CLIENT_SECRET: optionalText,
    APPLE_APP_BUNDLE_IDENTIFIER: optionalText,
    // Apple's key (.p8) values. With all three the server makes Apple's secret itself, so nothing expires by hand.
    APPLE_TEAM_ID: optionalText,
    APPLE_KEY_ID: optionalText,
    APPLE_PRIVATE_KEY: optionalText,

    // Email. "smtp" sends to SMTP_HOST (Mailpit in development). "memory" keeps mail in a list (tests).
    // "resend" sends through Resend's web API (needs RESEND_API_KEY), used online. "log" writes each email to the
    // server log instead (a private online test without an email provider, codes are read in the logs).
    MAIL_TRANSPORT: z.enum(["smtp", "resend", "memory", "log"]).default("smtp"),
    RESEND_API_KEY: optionalText,
    SMTP_HOST: z.string().default("localhost"),
    SMTP_PORT: z.coerce.number().int().default(1025),
    SMTP_USER: optionalText,
    SMTP_PASSWORD: optionalText,
    SMTP_SECURE: z
      .enum(["true", "false"])
      .default("false")
      .transform((v) => v === "true"),
    // Empty means "Yadii <no-reply@vinty.local>" for SMTP and "Yadii <onboarding@resend.dev>" (Resend's test sender,
    // the only one that works before a domain is verified) for Resend.
    MAIL_FROM: optionalText,

    // Push notifications. "log" writes the push to the server log instead of sending it (development, tests).
    // "expo" sends through the Expo push service (needs Apple and Google credentials set up in EAS).
    // Left empty it means "log" everywhere except production, which means "expo" (a push is never only logged online).
    PUSH_TRANSPORT: z.enum(["log", "expo"]).optional(),
    EXPO_PUSH_URL: z.string().url().default("https://exp.host/--/api/v2/push/send"),
    /** Optional Expo access token. Only needed when "enhanced security" is switched on for the project. */
    EXPO_ACCESS_TOKEN: optionalText,

    // Background jobs for offers and orders (expire offers, release held items, cancel unshipped orders, complete
    // delivered ones). Every this many seconds. 0 switches them off (the tests run them by hand).
    JOBS_INTERVAL_SECONDS: z.coerce.number().int().min(0).default(30),
    // The pretend delivery: a shipped order becomes delivered this many seconds after it shipped. Empty means
    // 45 in development and off everywhere else, 0 switches it off. The buyer's "I received it" always works.
    SIMULATED_DELIVERY_SECONDS: z.coerce.number().int().min(0).optional(),

    // Runs the timers above inside the server. Empty means yes on a laptop or a normal server and no on Vercel (a
    // function there only lives while it answers, so the scheduler calls /v1/jobs/... instead, see vercel.json).
    IN_PROCESS_JOBS: z.enum(["true", "false"]).optional(),
    /** Set by Vercel itself ("1"). Never set it by hand. */
    VERCEL: optionalText,

    // Protects the scheduler endpoints (GET or POST /v1/jobs/...). A scheduler such as Vercel Cron sends it as
    // "Authorization: Bearer <value>". Empty switches the endpoints off.
    CRON_SECRET: optionalText.refine((v) => v === undefined || v.length >= 16, {
      message: "CRON_SECRET must be at least 16 characters",
    }),

    // Live chat across several server copies (Vercel runs many). Empty keeps everything in memory, right for one
    // server. A rediss:// address (Upstash) makes a message reach people connected to another copy.
    REDIS_URL: optionalText,

    // Database connection. Postgres on Neon is reached through a pooler that wants prepared statements off. Empty
    // means "off when the address contains -pooler", true or false forces it.
    DATABASE_PREPARED_STATEMENTS: z.enum(["true", "false"]).optional(),
    /** Connections one server copy keeps open. */
    DATABASE_POOL_MAX: z.coerce.number().int().min(1).max(100).default(10),

    // AI photo helper on the sell form. Empty key means the helper is off (nothing else changes, also in production).
    ANTHROPIC_API_KEY: optionalText,
    PHOTO_READER_MODEL: optionalText,

    // Object storage (MinIO in development, Cloudflare R2 online)
    S3_ENDPOINT: z.string().url().default("http://localhost:9000"),
    S3_REGION: z.string().default("us-east-1"),
    S3_BUCKET: z.string().default("vinty-dev"),
    S3_ACCESS_KEY_ID: z.string().default("minioadmin"),
    S3_SECRET_ACCESS_KEY: z.string().default("minioadmin"),
    S3_FORCE_PATH_STYLE: z
      .enum(["true", "false"])
      .default("true")
      .transform((v) => v === "true"),
    /** Where the app loads photos from. Bucket address in development, the R2 public domain online. */
    S3_PUBLIC_URL: z.string().url().default("http://localhost:9000/vinty-dev"),
  })
  .superRefine((env, ctx) => {
    const problem = (path: string, message: string) =>
      ctx.addIssue({ code: "custom", path: [path], message });

    // A half filled Apple or Google setup would fail at the first tap, so say so at startup.
    const apple = [env.APPLE_TEAM_ID, env.APPLE_KEY_ID, env.APPLE_PRIVATE_KEY];
    if (apple.some(Boolean) && !apple.every(Boolean)) {
      problem(
        "APPLE_TEAM_ID",
        "APPLE_TEAM_ID, APPLE_KEY_ID and APPLE_PRIVATE_KEY go together, fill in all three",
      );
    }
    if (
      (env.APPLE_CLIENT_ID || env.APPLE_CLIENT_SECRET || apple.some(Boolean)) &&
      !env.APPLE_APP_BUNDLE_IDENTIFIER
    ) {
      problem("APPLE_APP_BUNDLE_IDENTIFIER", "Apple sign in needs APPLE_APP_BUNDLE_IDENTIFIER (the app ID)");
    }
    if (Boolean(env.GOOGLE_CLIENT_ID) !== Boolean(env.GOOGLE_CLIENT_SECRET)) {
      problem("GOOGLE_CLIENT_ID", "Google sign in needs both GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET");
    }

    if (env.NODE_ENV !== "production") return;

    if (env.BETTER_AUTH_SECRET === DEV_AUTH_SECRET) {
      problem("BETTER_AUTH_SECRET", "Set a real BETTER_AUTH_SECRET in production (openssl rand -base64 32)");
    }
    if (isLocalAddress(env.DATABASE_URL)) {
      problem(
        "DATABASE_URL",
        "In production this must be the hosted database, not a database on this machine",
      );
    }
    if (!env.BETTER_AUTH_URL.startsWith("https://") || isLocalAddress(env.BETTER_AUTH_URL)) {
      problem("BETTER_AUTH_URL", "In production this must be the public https address of this server");
    }
    if (!env.CRON_SECRET) {
      problem(
        "CRON_SECRET",
        "Set CRON_SECRET in production (openssl rand -base64 32), the scheduler needs it",
      );
    }
    if (env.MAIL_TRANSPORT === "memory") {
      problem("MAIL_TRANSPORT", "In production use resend or smtp, memory throws every email away");
    } else if (env.MAIL_TRANSPORT === "log") {
      // Allowed on purpose for a private test: nothing is sent, codes appear in the server log.
    } else if (env.MAIL_TRANSPORT === "resend") {
      if (!env.RESEND_API_KEY) problem("RESEND_API_KEY", "MAIL_TRANSPORT=resend needs RESEND_API_KEY");
    } else if (env.SMTP_HOST === "localhost" || env.SMTP_HOST === "127.0.0.1") {
      problem(
        "SMTP_HOST",
        "In production set MAIL_TRANSPORT=resend, or point SMTP_HOST at a real mail server",
      );
    }
    if (isLocalAddress(env.S3_ENDPOINT)) {
      problem(
        "S3_ENDPOINT",
        "In production this must be the Cloudflare R2 address https://<account>.r2.cloudflarestorage.com",
      );
    }
    if (isLocalAddress(env.S3_PUBLIC_URL)) {
      problem("S3_PUBLIC_URL", "In production this must be the public address of the photo bucket");
    }
    if (env.S3_ACCESS_KEY_ID === "minioadmin" || env.S3_SECRET_ACCESS_KEY === "minioadmin") {
      problem(
        "S3_ACCESS_KEY_ID",
        "Set the R2 access key (S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY), not the MinIO default",
      );
    }
    if (env.VERCEL && !env.REDIS_URL) {
      problem(
        "REDIS_URL",
        "Vercel runs several copies of the server, live chat needs REDIS_URL to reach all of them",
      );
    }
  })
  .transform((env) => ({
    ...env,
    PHOTO_READER_MODEL: env.PHOTO_READER_MODEL ?? "claude-haiku-5-5",
    MAIL_FROM:
      env.MAIL_FROM ??
      (env.MAIL_TRANSPORT === "resend" ? "Yadii <onboarding@resend.dev>" : "Yadii <no-reply@vinty.local>"),
    /** Timers inside the server: on unless Vercel runs us, or the person switched them off. */
    IN_PROCESS_JOBS: env.IN_PROCESS_JOBS ? env.IN_PROCESS_JOBS === "true" : !env.VERCEL,
    /** Prepared statements break behind a transaction pooler such as Neon's. */
    DATABASE_PREPARED_STATEMENTS: env.DATABASE_PREPARED_STATEMENTS
      ? env.DATABASE_PREPARED_STATEMENTS === "true"
      : !env.DATABASE_URL.includes("-pooler"),
  }));

export type Env = z.output<typeof envSchema>;

/** The website's addresses: WEB_ORIGINS, plus its local address in development. */
export function webOrigins(env: Pick<Env, "WEB_ORIGINS" | "NODE_ENV">): string[] {
  const listed = env.WEB_ORIGINS.split(",")
    .map((o) => o.trim().replace(/\/$/, ""))
    .filter(Boolean);
  return env.NODE_ENV === "production" ? listed : [...new Set([...listed, "http://localhost:3001"])];
}

/** Who may call the server from a browser: everyone with CORS_ORIGIN=*, else that list plus the website. */
export function corsOrigins(env: Pick<Env, "CORS_ORIGIN" | "WEB_ORIGINS" | "NODE_ENV">): true | string[] {
  if (env.CORS_ORIGIN === "*") return true;
  const listed = env.CORS_ORIGIN.split(",")
    .map((o) => o.trim())
    .filter(Boolean);
  return [...new Set([...listed, ...webOrigins(env)])];
}

/** Validates the environment once at startup. Throws a readable error on bad values (fail fast). */
export function parseEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    const problems = result.error.issues
      .map((i) => `  ${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid environment:\n${problems}`);
  }
  return result.data;
}

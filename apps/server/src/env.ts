import { z } from "zod";

/** Placeholder secret that .env.example ships with. Fine on a laptop, refused in production. */
export const DEV_AUTH_SECRET = "dev-only-secret-change-me-0123456789abcdef";

const optionalText = z
  .string()
  .optional()
  .transform((v) => (v && v.trim() !== "" ? v : undefined));

const envSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    HOST: z.string().default("0.0.0.0"),
    PORT: z.coerce.number().int().min(1).max(65535).default(3000),
    LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
    DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
    CORS_ORIGIN: z.string().default("*"),

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

    // Email. "smtp" sends to SMTP_HOST (Mailpit in development). "memory" keeps mail in a list (tests).
    MAIL_TRANSPORT: z.enum(["smtp", "memory"]).default("smtp"),
    SMTP_HOST: z.string().default("localhost"),
    SMTP_PORT: z.coerce.number().int().default(1025),
    SMTP_USER: optionalText,
    SMTP_PASSWORD: optionalText,
    SMTP_SECURE: z
      .enum(["true", "false"])
      .default("false")
      .transform((v) => v === "true"),
    MAIL_FROM: z.string().default("Vinty <no-reply@vinty.local>"),

    // Push notifications. "log" writes the push to the server log instead of sending it (development, tests).
    // "expo" sends through the Expo push service (needs Apple and Google credentials set up in EAS).
    // Left empty it means "log" everywhere except production, which means "expo" (a push is never only logged online).
    PUSH_TRANSPORT: z.enum(["log", "expo"]).optional(),
    EXPO_PUSH_URL: z.string().url().default("https://exp.host/--/api/v2/push/send"),
    /** Optional Expo access token. Only needed when "enhanced security" is switched on for the project. */
    EXPO_ACCESS_TOKEN: optionalText,

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
    if (env.NODE_ENV === "production" && env.BETTER_AUTH_SECRET === DEV_AUTH_SECRET) {
      ctx.addIssue({
        code: "custom",
        path: ["BETTER_AUTH_SECRET"],
        message: "Set a real BETTER_AUTH_SECRET in production (openssl rand -base64 32)",
      });
    }
  });

export type Env = z.infer<typeof envSchema>;

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

import { randomBytes } from "node:crypto";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { accounts, createDb, users } from "@vinty/db";
import { and, eq } from "drizzle-orm";
import { parseEnv } from "../env.js";
import { createAuth } from "../lib/auth.js";
import { memoryMailer } from "../lib/mail.js";

/**
 * Development only. Gives three of the seeded people a known password so they can be logged into.
 * The passwords are made fresh on every run and written ONLY to a git-ignored file and the console.
 */
const DEV_USERS = ["oliver.smith", "tamar.avraham", "noa_levi"];
const CREDENTIALS_FILE = fileURLToPath(new URL("../../.dev-credentials.local", import.meta.url));

const env = parseEnv();
if (env.NODE_ENV !== "development") {
  console.error(`Refusing to run: NODE_ENV is "${env.NODE_ENV}", it must be "development".`);
  process.exit(1);
}
const host = new URL(env.DATABASE_URL).hostname;
if (!["localhost", "127.0.0.1", "::1", "[::1]"].includes(host)) {
  console.error(`Refusing to run: the database host is "${host}", it must be local.`);
  process.exit(1);
}

const database = createDb(env.DATABASE_URL);
const db = database.db;
const auth = createAuth({ env, db, mailer: memoryMailer() });
const lines: string[] = [];

try {
  const ctx = await auth.$context;
  for (const username of DEV_USERS) {
    const [user] = await db.select().from(users).where(eq(users.username, username)).limit(1);
    if (!user) {
      console.error(`Seeded user "${username}" not found. Run pnpm db:reset first.`);
      process.exitCode = 1;
      continue;
    }
    const password = randomBytes(12).toString("base64url");
    const hash = await ctx.password.hash(password);
    const [existing] = await db
      .select({ id: accounts.id })
      .from(accounts)
      .where(and(eq(accounts.userId, user.id), eq(accounts.providerId, "credential")))
      .limit(1);
    if (existing) {
      await db.update(accounts).set({ password: hash }).where(eq(accounts.id, existing.id));
    } else {
      await db
        .insert(accounts)
        .values({ userId: user.id, accountId: user.id, providerId: "credential", password: hash });
    }
    lines.push(`${username}  email: ${user.email}  password: ${password}  role: ${user.role}`);
  }
  if (lines.length > 0) {
    writeFileSync(CREDENTIALS_FILE, `${lines.join("\n")}\n`, { mode: 0o600 });
    console.log("Dev users can now log in (log in with the email):\n");
    for (const line of lines) console.log(`  ${line}`);
    console.log("\nSaved to apps/server/.dev-credentials.local (git-ignored).");
  }
} finally {
  await database.close();
}

import { adminActions, createDb, users } from "@vinty/db";
import { eq, sql } from "drizzle-orm";

/**
 * Makes one person an admin: `pnpm admin:grant <email or username>` (this machine's database) or
 * `pnpm admin:grant:online <email or username>` (the hosted database, read from packages/db/.env.online).
 * Writes an audit row (no admin, the command line did it). The person must already have an account.
 */
const who = process.argv[2]?.trim();
if (!who) {
  console.error("Usage: pnpm admin:grant <email or username>");
  process.exit(1);
}
const url = process.env.DATABASE_URL;
if (!url) {
  console.error(
    "DATABASE_URL is not set. Fill in apps/server/.env (or packages/db/.env.online for the online one).",
  );
  process.exit(1);
}

const database = createDb(url, { max: 1, prepare: false });
const db = database.db;
const host = new URL(url).hostname;

try {
  const needle = who.toLowerCase();
  const [user] = await db
    .select({ id: users.id, username: users.username, email: users.email, role: users.role })
    .from(users)
    .where(
      needle.includes("@")
        ? sql`lower(${users.email}) = ${needle}`
        : sql`lower(${users.username}) = ${needle}`,
    )
    .limit(1);
  if (!user) {
    console.error(`No account found for "${who}" on ${host}. They need to sign up first.`);
    process.exitCode = 1;
  } else if (user.role === "admin") {
    console.log(`${user.username ?? user.email} is already an admin on ${host}.`);
  } else {
    await db.transaction(async (tx) => {
      await tx.update(users).set({ role: "admin" }).where(eq(users.id, user.id));
      await tx.insert(adminActions).values({
        adminUserId: null,
        action: "admin_granted",
        targetType: "user",
        targetId: user.id,
        details: { from: user.role, to: "admin", via: "command line", username: user.username },
      });
    });
    console.log(`${user.username ?? user.email} is now an admin on ${host}.`);
  }
} finally {
  await database.close();
}

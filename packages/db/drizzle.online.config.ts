import { readFileSync } from "node:fs";
import { parseEnv } from "node:util";
import { defineConfig } from "drizzle-kit";

// For the hosted database only. Reads packages/db/.env.online (never committed), which holds one line:
// DATABASE_URL=<the DIRECT, not pooled, connection string from Neon>. Used by `pnpm db:migrate:online`.
// The file is parsed here rather than loaded into process.env: drizzle-kit has already loaded .env (the local
// database), and a loaded value would not replace it, so the migration would quietly run against this Mac.
let text: string;
try {
  text = readFileSync(".env.online", "utf8");
} catch {
  throw new Error("packages/db/.env.online is missing. See docs/going-online.md, step 'Create the tables'.");
}

const url = parseEnv(text).DATABASE_URL;
if (!url) throw new Error("packages/db/.env.online has no DATABASE_URL line.");
if (url.includes("-pooler")) {
  throw new Error(
    "Use the direct (unpooled) connection string for migrations. Neon's pooled one has -pooler in it.",
  );
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/schema/index.ts",
  out: "./drizzle",
  dbCredentials: { url },
});

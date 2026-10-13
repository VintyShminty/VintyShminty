import { defineConfig } from "drizzle-kit";

// For the hosted database only. Reads packages/db/.env.online (never committed), which holds one line:
// DATABASE_URL=<the DIRECT, not pooled, connection string from Neon>. Used by `pnpm db:migrate:online`.
try {
  process.loadEnvFile(".env.online");
} catch {
  throw new Error("packages/db/.env.online is missing. See docs/going-online.md, step 'Create the tables'.");
}

const url = process.env.DATABASE_URL;
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

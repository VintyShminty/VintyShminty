import { defineConfig } from "drizzle-kit";

// Load packages/db/.env when it exists (Node 22+). Real .env files are never committed.
try {
  process.loadEnvFile(".env");
} catch {
  // No .env file: fall back to the environment, then to the local Docker default.
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "postgres://vinty:vinty@localhost:5432/vintyshminty",
  },
});

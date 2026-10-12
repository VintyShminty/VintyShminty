import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../schema/index.js";

export type SeedDb = ReturnType<typeof drizzle<typeof schema>>;

export const DEFAULT_DATABASE_URL = "postgres://vinty:vinty@localhost:5432/vintyshminty";

export function databaseUrl(): string {
  return process.env.DATABASE_URL ?? DEFAULT_DATABASE_URL;
}

export function connect(url = databaseUrl()) {
  const client = postgres(url, { max: 4, onnotice: () => {} });
  const db = drizzle(client, { schema });
  return { db, client, close: () => client.end() };
}

/**
 * Sample data and resets are for development only.
 * Two checks: NODE_ENV must be exactly "development" and the database must be on this machine.
 */
export function assertDevelopment(action: string, url = databaseUrl()): void {
  if (process.env.NODE_ENV !== "development") {
    throw new Error(
      `Refusing to ${action}: NODE_ENV is "${process.env.NODE_ENV ?? "(unset)"}", it must be "development". ` +
        "Sample data must never reach a real database.",
    );
  }
  const host = new URL(url).hostname;
  if (!["localhost", "127.0.0.1", "::1", "[::1]"].includes(host)) {
    throw new Error(`Refusing to ${action}: the database host is "${host}", it must be local.`);
  }
}

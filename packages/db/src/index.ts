import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema.js";

export * from "./schema.js";

export function createDb(databaseUrl: string) {
  const client = postgres(databaseUrl);
  const db = drizzle(client, { schema });
  return {
    db,
    /** Throws when the database cannot be reached. */
    async ping() {
      await client`select 1`;
    },
    async close() {
      await client.end();
    },
  };
}

export type Database = ReturnType<typeof createDb>;

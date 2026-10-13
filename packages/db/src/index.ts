import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema/index.js";

export * from "./schema/index.js";

export type CreateDbOptions = {
  /** Connections to keep open. Default 10. */
  max?: number;
  /** Turn off prepared statements. Needed behind a transaction pooler (Neon's -pooler address, PgBouncer). */
  prepare?: boolean;
};

export function createDb(databaseUrl: string, { max = 10, prepare = true }: CreateDbOptions = {}) {
  // idle_timeout lets a hosted server copy hand connections back when it is quiet.
  const client = postgres(databaseUrl, { max, prepare, idle_timeout: 20 });
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

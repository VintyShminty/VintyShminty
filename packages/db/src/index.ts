import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema.js";

export * from "./schema.js";

export function createDb(databaseUrl: string) {
  return drizzle(postgres(databaseUrl), { schema });
}

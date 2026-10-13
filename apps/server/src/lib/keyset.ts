import { type AnyColumn, type SQL, sql } from "drizzle-orm";
import { decodeCursor, encodeCursor } from "./cursor.js";

/**
 * Newest first paging on (time, id). Postgres keeps microseconds and JavaScript dates only milliseconds, so the
 * time travels in the cursor as text straight from the database and is never turned into a Date.
 */
export const tsText = (column: AnyColumn | SQL) =>
  sql<string>`to_char(${column} at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`;

const TS_SHAPE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/;
const UUID_SHAPE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const keysetCursor = (t: string, id: string) => encodeCursor({ t, id });

/** The SQL that keeps only rows older than the cursor. A cursor that cannot be read starts again from the top. */
export function olderThan(
  cursor: string | undefined,
  timeColumn: AnyColumn,
  idColumn: AnyColumn,
): SQL | undefined {
  const decoded = decodeCursor<{ t?: unknown; id?: unknown }>(cursor);
  if (!decoded || typeof decoded.t !== "string" || typeof decoded.id !== "string") return undefined;
  if (!TS_SHAPE.test(decoded.t) || !UUID_SHAPE.test(decoded.id)) return undefined;
  return sql`(${timeColumn}, ${idColumn}) < (${decoded.t}::timestamptz, ${decoded.id}::uuid)`;
}

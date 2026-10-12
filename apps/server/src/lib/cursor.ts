/** Cursors are opaque to the app: base64url JSON of the sort keys (docs/blueprint/api.md, Pagination). */
export function encodeCursor(payload: Record<string, string | number>): string {
  return Buffer.from(JSON.stringify(payload)).toString("base64url");
}

export function decodeCursor<T extends Record<string, unknown>>(cursor: string | undefined): T | null {
  if (!cursor) return null;
  try {
    const value = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));
    return value && typeof value === "object" ? (value as T) : null;
  } catch {
    return null;
  }
}

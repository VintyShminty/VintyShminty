import type { Me } from "@vinty/shared";

/** What the browser needs to know about the visitor. Null while logged out. */
export type Viewer = { id: string; name: string; username: string | null; avatarUrl: string | null };

/** The viewer from a GET /v1/me answer, reduced to what client components need. */
export function toViewer(me: Me | null): Viewer | null {
  return me ? { id: me.id, name: me.name, username: me.username, avatarUrl: me.profile.avatarUrl } : null;
}

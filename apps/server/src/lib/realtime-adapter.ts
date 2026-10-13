import { createAdapter } from "@socket.io/redis-adapter";
import { createClient } from "redis";
import type { Env } from "../env.js";

type Log = { error: (obj: unknown, msg: string) => void; info: (msg: string) => void };

/** Something Socket.IO accepts as its `adapter` option, plus a way to hang up. */
export type RealtimeAdapter = { adapter: ReturnType<typeof createAdapter>; close: () => Promise<void> };

/**
 * Live chat across several copies of the server (Vercel runs many, each person is connected to only one).
 * With REDIS_URL set, every broadcast goes through Redis so it reaches people on the other copies, and "who has this
 * chat open" asks all copies. Without REDIS_URL this returns null and Socket.IO keeps its in-memory adapter, which is
 * exactly right for one server (a laptop, the tests).
 * The sharded adapter would need Redis 7 sharded pub/sub, which hosted Redis does not always offer, so this uses the
 * classic one (https://socket.io/docs/v4/redis-adapter/).
 */
export async function createRealtimeAdapter(
  env: Pick<Env, "REDIS_URL">,
  log: Log,
): Promise<RealtimeAdapter | null> {
  if (!env.REDIS_URL) return null;
  const pub = createClient({ url: env.REDIS_URL });
  const sub = pub.duplicate();
  // A Redis hiccup must never crash the server. The clients reconnect by themselves.
  for (const client of [pub, sub]) client.on("error", (err) => log.error({ err }, "redis error"));
  // Do not wait for ever: a Redis that cannot be reached must not keep the whole server from starting.
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error("Redis did not answer within 8 seconds")), 8000).unref(),
  );
  try {
    await Promise.race([Promise.all([pub.connect(), sub.connect()]), timeout]);
  } catch (err) {
    await Promise.allSettled([pub.destroy(), sub.destroy()]);
    throw err;
  }
  log.info("live chat shares messages through Redis");
  return {
    adapter: createAdapter(pub, sub, { publishOnSpecificResponseChannel: true }),
    async close() {
      await Promise.allSettled([pub.quit(), sub.quit()]);
    },
  };
}

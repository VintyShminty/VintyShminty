import type { Env } from "../env.js";

/** One push to one phone. */
export type PushMessage = {
  /** Expo push token of the phone, such as ExponentPushToken[xxxx]. */
  to: string;
  title: string;
  body: string;
  /** Tapping the push opens the screen named by this (api.md, Push notifications). */
  data: Record<string, string>;
  /** High priority wakes the phone at once. Normal waits for a good moment. */
  priority: "high" | "normal";
};

export type PushResult =
  | { ok: true }
  /** `deviceGone` means the token is dead (app deleted). The caller revokes it. */
  | { ok: false; deviceGone: boolean; message: string };

/**
 * The only thing the rest of the server knows about push. Same idea as `Mailer`: another provider is a new
 * implementation chosen in `createPusher`.
 */
export interface Pusher {
  /** Returns one result per message, in the same order. Never throws for a single bad token. */
  send(messages: PushMessage[]): Promise<PushResult[]>;
}

type Logger = { info: (obj: object, msg: string) => void; warn: (obj: object, msg: string) => void };

/** Development: nothing leaves the machine, the push is written to the log. */
export function logPusher(log: Logger): Pusher {
  return {
    async send(messages) {
      for (const m of messages) log.info({ push: m }, "push (log transport, not sent)");
      return messages.map(() => ({ ok: true }) as const);
    },
  };
}

/** Tests: keeps every push in a list. */
export type MemoryPusher = Pusher & { sent: PushMessage[]; failWith?: "deviceGone" };
export function memoryPusher(): MemoryPusher {
  const sent: PushMessage[] = [];
  const pusher: MemoryPusher = {
    sent,
    async send(messages) {
      if (pusher.failWith === "deviceGone") {
        return messages.map(() => ({ ok: false, deviceGone: true, message: "DeviceNotRegistered" }));
      }
      sent.push(...messages);
      return messages.map(() => ({ ok: true }));
    },
  };
  return pusher;
}

type ExpoTicket = { status: "ok" } | { status: "error"; message?: string; details?: { error?: string } };

/** Expo accepts at most 100 messages per request. */
const EXPO_BATCH = 100;

/** Sends through the Expo push service: a plain POST, no SDK needed. */
export function expoPusher(env: Env, log: Logger): Pusher {
  return {
    async send(messages) {
      const results: PushResult[] = [];
      for (let i = 0; i < messages.length; i += EXPO_BATCH) {
        const batch = messages.slice(i, i + EXPO_BATCH);
        try {
          const response = await fetch(env.EXPO_PUSH_URL, {
            method: "POST",
            headers: {
              accept: "application/json",
              "content-type": "application/json",
              ...(env.EXPO_ACCESS_TOKEN ? { authorization: `Bearer ${env.EXPO_ACCESS_TOKEN}` } : {}),
            },
            body: JSON.stringify(batch.map((m) => ({ ...m, sound: "default" }))),
            signal: AbortSignal.timeout(10_000),
          });
          if (!response.ok) throw new Error(`Expo answered ${response.status}`);
          const json = (await response.json()) as { data?: ExpoTicket[] };
          for (const [index] of batch.entries()) {
            const ticket = json.data?.[index];
            if (ticket?.status === "ok") results.push({ ok: true });
            else {
              results.push({
                ok: false,
                deviceGone: ticket?.status === "error" && ticket.details?.error === "DeviceNotRegistered",
                message: ticket?.status === "error" ? (ticket.message ?? "Push rejected") : "No ticket",
              });
            }
          }
        } catch (err) {
          log.warn({ err }, "push request failed");
          for (const _ of batch) results.push({ ok: false, deviceGone: false, message: String(err) });
        }
      }
      return results;
    },
  };
}

export function createPusher(env: Env, log: Logger): Pusher {
  const transport = env.PUSH_TRANSPORT ?? (env.NODE_ENV === "production" ? "expo" : "log");
  return transport === "expo" ? expoPusher(env, log) : logPusher(log);
}

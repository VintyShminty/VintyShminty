import { type ClientEvent, EVENT_BATCH_MAX } from "@vinty/shared";

// The waiting line for the small actions only the phone sees (cards seen, time on an item, category visits).
// Kept free of React Native imports so it can be tested on its own. The wiring to the server is in `lib/events.ts`.

export const FLUSH_EVERY_MS = 15_000;
export const FLUSH_AT = 20;

/** What a caller gives the queue. The queue adds the id and the time. */
export type NewEvent = Omit<ClientEvent, "clientEventId" | "occurredAt">;

type Options = {
  /** Sends one batch of at most 50 actions. Rejects when the server cannot be reached or says no. */
  send: (events: ClientEvent[]) => Promise<unknown>;
  flushEveryMs?: number;
  flushAt?: number;
};

/** A UUID the server uses to recognise a resent action. Not a secret, so Math.random is fine as a fallback. */
export function newEventId(): string {
  const c = globalThis.crypto as { randomUUID?: () => string } | undefined;
  if (c?.randomUUID) return c.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (ch) => {
    const r = Math.floor(Math.random() * 16);
    return (ch === "x" ? r : (r & 3) | 8).toString(16);
  });
}

/**
 * Collects actions and sends them in batches: every 15 seconds while something waits, or as soon as 20 wait.
 * A batch that fails is tried once more, then dropped (losing a few "card seen" rows is fine). Switched off, it
 * keeps nothing, so a signed out visitor or someone who turned personalisation off sends nothing.
 */
class EventQueue {
  private waiting: ClientEvent[] = [];
  private timer: ReturnType<typeof setInterval> | null = null;
  private sending: Promise<void> | null = null;
  private on = false;

  constructor(private readonly options: Options) {}

  get size(): number {
    return this.waiting.length;
  }

  get enabled(): boolean {
    return this.on;
  }

  /** Turns the queue on or off. Off throws away whatever was waiting and stops the 15 second timer. */
  setEnabled(next: boolean): void {
    if (next === this.on) return;
    this.on = next;
    if (next) {
      this.timer = setInterval(() => void this.flush(), this.options.flushEveryMs ?? FLUSH_EVERY_MS);
    } else {
      this.waiting = [];
      if (this.timer) clearInterval(this.timer);
      this.timer = null;
    }
  }

  push(event: NewEvent): void {
    if (!this.on) return;
    this.waiting.push({ ...event, clientEventId: newEventId(), occurredAt: new Date().toISOString() });
    if (this.waiting.length >= (this.options.flushAt ?? FLUSH_AT)) void this.flush();
  }

  /** Sends everything waiting, in batches of at most 50. Never throws. Calls made while a send runs wait for it. */
  flush(): Promise<void> {
    if (this.sending) return this.sending.then(() => (this.waiting.length > 0 ? this.flush() : undefined));
    if (this.waiting.length === 0) return Promise.resolve();
    this.sending = this.drain().finally(() => {
      this.sending = null;
    });
    return this.sending;
  }

  private async drain(): Promise<void> {
    while (this.waiting.length > 0) {
      const batch = this.waiting.splice(0, EVENT_BATCH_MAX);
      try {
        await this.options.send(batch);
      } catch {
        try {
          await this.options.send(batch);
        } catch {
          // Dropped after one more try.
        }
      }
    }
  }
}

export { EventQueue };

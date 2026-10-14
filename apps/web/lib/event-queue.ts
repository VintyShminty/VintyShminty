import { type ClientEvent, EVENT_BATCH_MAX } from "@vinty/shared";

// The waiting line for the small actions only the browser sees (cards seen, time on an item, category visits). The
// same behaviour as the app's queue (apps/mobile/lib/event-queue.ts): batches of at most 50, sent every 15 seconds or
// as soon as 20 wait, tried twice, and nothing kept while switched off. The wiring to the server is in `lib/events.ts`.

export const FLUSH_EVERY_MS = 15_000;
export const FLUSH_AT = 20;

/** What a caller gives the queue. The queue adds the id and the time. */
export type NewEvent = Omit<ClientEvent, "clientEventId" | "occurredAt">;

type Options = {
  /** Sends one batch of at most 50 actions. Rejects when the server cannot be reached or says no. */
  send: (events: ClientEvent[]) => Promise<unknown>;
  /** Sends a batch while the page is closing: must not wait for an answer (fetch with `keepalive`). */
  sendOnLeave?: (events: ClientEvent[]) => void;
  flushEveryMs?: number;
  flushAt?: number;
};

/** A UUID the server uses to recognise a resent action. */
export function newEventId(): string {
  return globalThis.crypto.randomUUID();
}

export class EventQueue {
  private waiting: ClientEvent[] = [];
  private timer: ReturnType<typeof setInterval> | null = null;
  private sending: Promise<void> | null = null;
  private on = false;

  constructor(private readonly options: Options) {}

  get size(): number {
    return this.waiting.length;
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

  /** The page is being hidden or closed: hands everything waiting to `sendOnLeave` without waiting for answers. */
  flushOnLeave(): void {
    const send = this.options.sendOnLeave;
    if (!send) return;
    while (this.waiting.length > 0) send(this.waiting.splice(0, EVENT_BATCH_MAX));
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

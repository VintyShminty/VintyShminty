import type { ClientEvent } from "@vinty/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EventQueue, FLUSH_EVERY_MS } from "../lib/event-queue";

const view = (n = 0) => ({
  type: "impression" as const,
  listingId: `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`,
  surface: "home" as const,
  position: n,
});

describe("EventQueue", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("sends nothing while switched off", async () => {
    const send = vi.fn().mockResolvedValue(undefined);
    const queue = new EventQueue({ send });
    queue.push(view());
    await queue.flush();
    expect(queue.size).toBe(0);
    expect(send).not.toHaveBeenCalled();
  });

  it("gives every action its own id and a time", async () => {
    const batches: ClientEvent[][] = [];
    const queue = new EventQueue({ send: async (b) => void batches.push(b) });
    queue.setEnabled(true);
    queue.push(view(1));
    queue.push(view(2));
    await queue.flush();
    const [a, b] = batches[0] as ClientEvent[];
    expect(a?.clientEventId).toMatch(/^[0-9a-f-]{36}$/);
    expect(a?.clientEventId).not.toBe(b?.clientEventId);
    expect(a?.occurredAt).toBeTruthy();
    queue.setEnabled(false);
  });

  it("sends when 20 are waiting", async () => {
    const send = vi.fn().mockResolvedValue(undefined);
    const queue = new EventQueue({ send });
    queue.setEnabled(true);
    for (let i = 0; i < 19; i++) queue.push(view(i));
    expect(send).not.toHaveBeenCalled();
    queue.push(view(19));
    await vi.advanceTimersByTimeAsync(0);
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0]?.[0]).toHaveLength(20);
    queue.setEnabled(false);
  });

  it("sends what waits every 15 seconds", async () => {
    const send = vi.fn().mockResolvedValue(undefined);
    const queue = new EventQueue({ send });
    queue.setEnabled(true);
    queue.push(view());
    await vi.advanceTimersByTimeAsync(FLUSH_EVERY_MS - 1);
    expect(send).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(send).toHaveBeenCalledTimes(1);
    queue.setEnabled(false);
  });

  it("splits a long line into batches of at most 50", async () => {
    const send = vi.fn().mockResolvedValue(undefined);
    const queue = new EventQueue({ send, flushAt: 1000 });
    queue.setEnabled(true);
    for (let i = 0; i < 120; i++) queue.push(view(i));
    await queue.flush();
    expect(send.mock.calls.map((c) => (c[0] as ClientEvent[]).length)).toEqual([50, 50, 20]);
    queue.setEnabled(false);
  });

  it("tries a failed batch once more, then drops it", async () => {
    const send = vi.fn().mockRejectedValue(new Error("offline"));
    const queue = new EventQueue({ send });
    queue.setEnabled(true);
    queue.push(view());
    await queue.flush();
    expect(send).toHaveBeenCalledTimes(2);
    expect(queue.size).toBe(0);
    await queue.flush();
    expect(send).toHaveBeenCalledTimes(2);
    queue.setEnabled(false);
  });

  it("keeps the batch when the second try works", async () => {
    const send = vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValue(undefined);
    const queue = new EventQueue({ send });
    queue.setEnabled(true);
    queue.push(view());
    await queue.flush();
    expect(send).toHaveBeenCalledTimes(2);
    expect(send.mock.calls[1]?.[0]).toEqual(send.mock.calls[0]?.[0]);
    queue.setEnabled(false);
  });

  it("forgets everything when switched off", () => {
    const send = vi.fn().mockResolvedValue(undefined);
    const queue = new EventQueue({ send });
    queue.setEnabled(true);
    queue.push(view());
    queue.setEnabled(false);
    expect(queue.size).toBe(0);
  });
});

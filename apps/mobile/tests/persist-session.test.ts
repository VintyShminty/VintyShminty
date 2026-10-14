import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { startPersistence } from "../lib/persist-session";

vi.mock("@tanstack/react-query-persist-client", () => ({
  persistQueryClientRestore: vi.fn(async () => {}),
  persistQueryClientSubscribe: vi.fn(() => vi.fn()),
}));

import * as core from "@tanstack/react-query-persist-client";

const persister = { persistClient: vi.fn(), restoreClient: vi.fn(), removeClient: vi.fn() };

describe("startPersistence", () => {
  it("restores with the person's own buster, then starts saving", async () => {
    const p = startPersistence({
      queryClient: new QueryClient(),
      persister,
      appVersion: "1.0.0",
      userId: "u1",
    });
    expect(vi.mocked(core.persistQueryClientRestore).mock.calls.at(-1)?.[0].buster).toBe("1.0.0:u1");
    await p.restored;
    expect(core.persistQueryClientSubscribe).toHaveBeenCalledTimes(1);
  });

  it("does not start saving if stopped before the restore ends", async () => {
    vi.mocked(core.persistQueryClientSubscribe).mockClear();
    const p = startPersistence({
      queryClient: new QueryClient(),
      persister,
      appVersion: "1.0.0",
      userId: "u2",
    });
    p.stop();
    await p.restored;
    expect(core.persistQueryClientSubscribe).not.toHaveBeenCalled();
  });
});

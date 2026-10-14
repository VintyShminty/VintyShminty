import { describe, expect, it } from "vitest";
import { visibleTips } from "../lib/photo-tips";
import { useSellStore } from "../lib/sell-store";

describe("visibleTips", () => {
  const tips = { a: ["dark" as const], b: ["contact" as const, "dark" as const], c: ["cut_off" as const] };

  it("shows the most important kind, in photo order, with the current place", () => {
    expect(visibleTips(["b", "a"], tips, [])).toEqual([
      { key: "b", n: 1, kind: "contact" },
      { key: "a", n: 2, kind: "dark" },
    ]);
  });

  it("leaves out removed, closed and unchecked photos and stops at two lines", () => {
    expect(visibleTips(["x", "a"], tips, [])).toEqual([{ key: "a", n: 2, kind: "dark" }]);
    expect(visibleTips(["a", "b"], tips, ["a"])).toEqual([{ key: "b", n: 2, kind: "contact" }]);
    expect(visibleTips(["a", "b", "c"], tips, [])).toHaveLength(2);
    expect(visibleTips([undefined, "z"], tips, [])).toEqual([]);
  });
});

describe("sell store helper answers", () => {
  const text = { categories: [], brand: null, conditionId: "c1", colourIds: [] };

  it("keeps a text suggestion for the current session and ignores one from an old session", () => {
    useSellStore.getState().start();
    const old = useSellStore.getState().session;
    useSellStore.getState().receiveTextSuggestion(old, text);
    expect(useSellStore.getState().textSuggestion).toEqual(text);
    useSellStore.getState().start();
    expect(useSellStore.getState().textSuggestion).toBeNull();
    useSellStore.getState().receiveTextSuggestion(old, text);
    expect(useSellStore.getState().textSuggestion).toBeNull();
  });

  it("ignores tips from an old session and remembers checked photos once", () => {
    useSellStore.getState().start();
    const old = useSellStore.getState().session;
    useSellStore.getState().start();
    const now = useSellStore.getState().session;
    useSellStore.getState().addPhotoTips(old, [{ key: "a", kinds: ["dark"] }]);
    expect(useSellStore.getState().photoTips).toEqual({});
    useSellStore.getState().addPhotoTips(now, [{ key: "a", kinds: ["dark"] }]);
    useSellStore.getState().markChecked(now, ["a", "b"]);
    useSellStore.getState().markChecked(now, ["b", "c"]);
    expect(useSellStore.getState().photoTips).toEqual({ a: ["dark"] });
    expect(useSellStore.getState().checkedKeys).toEqual(["a", "b", "c"]);
  });
});

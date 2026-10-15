import { describe, expect, it } from "vitest";
import { cleanQuestion, helpAskView } from "../lib/help-ask-view";

describe("cleanQuestion", () => {
  it("trims and rejects very short questions", () => {
    expect(cleanQuestion("  how do I get paid  ")).toBe("how do I get paid");
    expect(cleanQuestion("  ab ")).toBeNull();
    expect(cleanQuestion("")).toBeNull();
  });
  it("cuts to 300 characters", () => {
    expect(cleanQuestion("a".repeat(400))?.length).toBe(300);
  });
});

describe("helpAskView", () => {
  const answered = { answered: true, answer: "Text", articleIds: [] };
  it("is idle before asking and thinking while waiting", () => {
    expect(helpAskView({ asked: false, pending: false, failed: false })).toBe("idle");
    expect(helpAskView({ asked: true, pending: true, failed: false })).toBe("thinking");
  });
  it("shows the answer only when answered with text", () => {
    expect(helpAskView({ asked: true, pending: false, failed: false, data: answered })).toBe("answer");
    expect(
      helpAskView({ asked: true, pending: false, failed: false, data: { ...answered, answer: null } }),
    ).toBe("noAnswer");
    expect(
      helpAskView({ asked: true, pending: false, failed: false, data: { ...answered, answered: false } }),
    ).toBe("noAnswer");
  });
  it("treats an error as no answer", () => {
    expect(helpAskView({ asked: true, pending: false, failed: true })).toBe("noAnswer");
  });
});

import en from "@vinty/locales/en.json";
import { describe, expect, it } from "vitest";
import { socialErrorKey } from "../lib/social-errors";

describe("socialErrorKey", () => {
  it("explains a missing email, a missing provider, the network and anything else", () => {
    expect(socialErrorKey({ code: "USER_EMAIL_NOT_FOUND" })).toBe("errors.socialNoEmail");
    expect(socialErrorKey({ status: 404, code: "PROVIDER_NOT_FOUND" })).toBe("errors.socialUnavailable");
    expect(socialErrorKey({ status: 0 })).toBe("errors.network");
    expect(socialErrorKey({ status: 429 })).toBe("errors.tooManyRequests");
    expect(socialErrorKey({ code: "OAUTH_LINK_ERROR" })).toBe("errors.socialBlocked");
    expect(socialErrorKey({ status: 401, code: "INVALID_TOKEN" })).toBe("errors.socialFailed");
    expect(socialErrorKey(null)).toBe("errors.socialFailed");
  });

  it("only returns keys that exist in the English file", () => {
    const keys = [
      "errors.socialNoEmail",
      "errors.socialUnavailable",
      "errors.socialBlocked",
      "errors.socialFailed",
    ];
    for (const key of keys) {
      expect((en.errors as Record<string, string>)[key.replace("errors.", "")]).toBeTruthy();
    }
  });
});

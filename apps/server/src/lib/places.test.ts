import { describe, expect, it } from "vitest";
import type { Env } from "../env.js";
import { createPlacesClient } from "./places.js";

const env = (key: string | undefined) => ({ GOOGLE_MAPS_API_KEY: key }) as Env;
const reply = (json: unknown, ok = true) =>
  (async () => ({ ok, status: ok ? 200 : 500, json: async () => json })) as unknown as typeof fetch;

describe("places client", () => {
  it("is off without a key", async () => {
    const client = createPlacesClient(env(undefined));
    expect(client.enabled).toBe(false);
    expect(await client.suggest({ q: "tel", kind: "city", language: "en" })).toEqual([]);
  });

  it("turns Google predictions into short suggestions", async () => {
    const client = createPlacesClient(
      env("k"),
      reply({
        suggestions: [
          {
            placePrediction: {
              placeId: "p1",
              text: { text: "Tel Aviv-Yafo, Israel" },
              structuredFormat: { mainText: { text: "Tel Aviv-Yafo" }, secondaryText: { text: "Israel" } },
            },
          },
          { placePrediction: {} },
        ],
      }),
    );
    expect(await client.suggest({ q: "tel", kind: "city", language: "en" })).toEqual([
      { id: "p1", main: "Tel Aviv-Yafo", secondary: "Israel" },
    ]);
  });

  it("builds the street line, city and postcode from address parts", async () => {
    const client = createPlacesClient(
      env("k"),
      reply({
        addressComponents: [
          { longText: "12", types: ["street_number"] },
          { longText: "Dizengoff Street", types: ["route"] },
          { longText: "Tel Aviv-Yafo", types: ["locality", "political"] },
          { longText: "6433222", types: ["postal_code"] },
        ],
      }),
    );
    expect(await client.details({ id: "p1", language: "en" })).toEqual({
      line1: "Dizengoff Street 12",
      city: "Tel Aviv-Yafo",
      postcode: "6433222",
    });
  });

  it("throws when Google refuses so the route can answer empty", async () => {
    const client = createPlacesClient(env("k"), reply({}, false));
    await expect(client.suggest({ q: "tel", kind: "city", language: "en" })).rejects.toThrow();
  });
});

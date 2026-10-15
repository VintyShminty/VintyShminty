import { EMPTY_PLACE_DETAILS, type PlaceDetails, type PlaceKind, type PlaceSuggestion } from "@vinty/shared";
import type { Env } from "../env.js";

const BASE = "https://places.googleapis.com/v1";
const TIMEOUT_MS = 4000;

export type PlacesClient = {
  readonly enabled: boolean;
  suggest(input: { q: string; kind: PlaceKind; language: string }): Promise<PlaceSuggestion[]>;
  details(input: { id: string; language: string }): Promise<PlaceDetails>;
};

type Prediction = {
  placePrediction?: {
    placeId?: string;
    text?: { text?: string };
    structuredFormat?: { mainText?: { text?: string }; secondaryText?: { text?: string } };
  };
};
type Component = { longText?: string; types?: string[] };
type PlaceJson = { addressComponents?: Component[]; postalAddress?: { postalCode?: string } };

const part = (components: Component[], type: string) =>
  components.find((c) => c.types?.includes(type))?.longText ?? "";

/**
 * Google Places API (New) behind our own server: the key never reaches the website or the app, and both use the same
 * two calls. Israel only for now (the app sells in Israel). Every failure answers empty, the forms still work typed.
 */
export function createPlacesClient(env: Env, fetchImpl: typeof fetch = fetch): PlacesClient {
  const key = env.GOOGLE_MAPS_API_KEY;
  if (!key) {
    return { enabled: false, suggest: async () => [], details: async () => EMPTY_PLACE_DETAILS };
  }
  const call = async (url: string, init: RequestInit): Promise<unknown> => {
    const res = await fetchImpl(url, {
      ...init,
      headers: { "Content-Type": "application/json", "X-Goog-Api-Key": key, ...init.headers },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`Places answered ${res.status}`);
    return res.json();
  };
  /** The Geocoding API knows postcodes Places leaves out. Needs that API on the key, otherwise it quietly gives none. */
  const geocodePostcode = async (id: string, language: string): Promise<string> => {
    try {
      const params = new URLSearchParams({ place_id: id, language, key });
      const res = await fetchImpl(`https://maps.googleapis.com/maps/api/geocode/json?${params}`, {
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!res.ok) return "";
      const json = (await res.json()) as {
        status?: string;
        results?: { address_components?: { long_name?: string; types?: string[] }[] }[];
      };
      if (json.status !== "OK") return "";
      for (const r of json.results ?? []) {
        const hit = r.address_components?.find((a) => a.types?.includes("postal_code"));
        if (hit?.long_name) return hit.long_name;
      }
    } catch {
      // No postcode is fine, the person types it.
    }
    return "";
  };
  return {
    enabled: true,
    async suggest({ q, kind, language }) {
      const body = {
        input: q,
        languageCode: language,
        includedRegionCodes: ["il"],
        includedPrimaryTypes: kind === "city" ? ["locality"] : ["street_address", "route", "premise"],
      };
      const json = (await call(`${BASE}/places:autocomplete`, {
        method: "POST",
        body: JSON.stringify(body),
        headers: {
          "X-Goog-FieldMask":
            "suggestions.placePrediction.placeId,suggestions.placePrediction.text,suggestions.placePrediction.structuredFormat",
        },
      })) as { suggestions?: Prediction[] };
      const out: PlaceSuggestion[] = [];
      for (const s of json.suggestions ?? []) {
        const p = s.placePrediction;
        const id = p?.placeId;
        const main = p?.structuredFormat?.mainText?.text ?? p?.text?.text;
        if (!id || !main) continue;
        out.push({ id, main, secondary: p?.structuredFormat?.secondaryText?.text ?? "" });
        if (out.length === 8) break;
      }
      return out;
    },
    async details({ id, language }) {
      const json = (await call(
        `${BASE}/places/${encodeURIComponent(id)}?languageCode=${encodeURIComponent(language)}`,
        { method: "GET", headers: { "X-Goog-FieldMask": "addressComponents,postalAddress" } },
      )) as PlaceJson;
      const c = json.addressComponents ?? [];
      const street = part(c, "route");
      const number = part(c, "street_number");
      // Places often has no postcode for an Israeli street address. Try its postal address, then the geocoder.
      let postcode = part(c, "postal_code") || json.postalAddress?.postalCode || "";
      if (!postcode) postcode = await geocodePostcode(id, language);
      return {
        line1: [street, number].filter(Boolean).join(" "),
        city: part(c, "locality") || part(c, "administrative_area_level_2"),
        postcode,
      };
    },
  };
}

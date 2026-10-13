import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import type { Env } from "../env.js";

export type PhotoMediaType = "image/jpeg" | "image/png" | "image/webp" | "image/gif";

export type PhotoReadInput = {
  images: { mediaType: PhotoMediaType; data: Buffer }[];
  /** Our lists written out as text with short codes (see buildCatalog in photo-assist.ts). Same for everyone. */
  catalog: string;
  /** The language of the title and description. */
  language: "en" | "he";
  signal?: AbortSignal;
};

export type PhotoReadUsage = { inputTokens: number; outputTokens: number; cacheReadTokens: number };

/**
 * What the model says, before the server checks it. Codes (C12, K3, M2) stand for our real ids. Everything is
 * optional because a photo often cannot answer every question. The server drops what it cannot verify.
 */
export const rawReadingSchema = z.object({
  category: z.string().nullish(),
  categoryConfidence: z.number().nullish(),
  brandText: z.string().nullish(),
  brandConfidence: z.number().nullish(),
  colours: z.array(z.string()).nullish(),
  coloursConfidence: z.number().nullish(),
  material: z.string().nullish(),
  materialConfidence: z.number().nullish(),
  title: z.string().nullish(),
  description: z.string().nullish(),
});
export type RawReading = z.infer<typeof rawReadingSchema>;

/** What the server needs from the model that looks at photos. Anthropic online, a fake in tests. */
export interface PhotoReader {
  /** False when no key is set. The feature is then off and the app never calls it. */
  readonly enabled: boolean;
  /** Throws on any failure, the caller turns that into an empty suggestion. */
  read(input: PhotoReadInput): Promise<{ reading: RawReading; usage: PhotoReadUsage }>;
}

const READING_JSON_SCHEMA = {
  type: "object",
  properties: {
    category: { type: ["string", "null"] },
    categoryConfidence: { type: ["number", "null"] },
    brandText: { type: ["string", "null"] },
    brandConfidence: { type: ["number", "null"] },
    colours: { type: "array", items: { type: "string" } },
    coloursConfidence: { type: ["number", "null"] },
    material: { type: ["string", "null"] },
    materialConfidence: { type: ["number", "null"] },
    title: { type: ["string", "null"] },
    description: { type: ["string", "null"] },
  },
  required: [
    "category",
    "categoryConfidence",
    "brandText",
    "brandConfidence",
    "colours",
    "coloursConfidence",
    "material",
    "materialConfidence",
    "title",
    "description",
  ],
  additionalProperties: false,
} as const;

/** The fixed part of the prompt. It does not change between requests, so it is cached together with the lists. */
const INSTRUCTIONS = `You help a seller list one second-hand clothing item for sale. You get 1 to 4 photos of the same item. Fill in the form fields the photos can show. Never guess.

Rules:
- category: the code of the single best matching category from the list below (codes look like C12), or null if the item does not clearly fit one.
- brandText: the brand exactly as printed on a clothing tag, label, logo or the item itself. null if you cannot read one. Never guess a brand from the style of the item.
- colours: the codes of the 1 or 2 main colours of the item (codes look like K3), most dominant first. Empty if unclear.
- material: the code of the fabric only if a care label or the photo makes it clear (codes look like M2), otherwise null.
- title: a short, plain listing title, at most 60 characters, such as "Linen summer dress" or "Nike running shorts". Include the brand only if you read it.
- description: one or two plain sentences about what is visible (type, colour, cut, details). Do not invent size, condition, measurements, price or history. No emojis, no sales talk.
- Each confidence is a number from 0 to 1 for how sure you are of that field.
- Title and description are written in the language the user message asks for. The codes and brand stay as they are.`;

const MAX_TOKENS = 700;

function toUsage(u: Anthropic.Usage): PhotoReadUsage {
  return {
    inputTokens: u.input_tokens,
    outputTokens: u.output_tokens,
    cacheReadTokens: u.cache_read_input_tokens ?? 0,
  };
}

/** Reads photos with Claude Haiku. The key and the photos never reach the logs. */
export function anthropicPhotoReader(apiKey: string, model: string): PhotoReader {
  // One quick try: the seller is waiting on a form, and a slow answer is worth less than none.
  const client = new Anthropic({ apiKey, timeout: 15_000, maxRetries: 0 });
  return {
    enabled: true,
    async read({ images, catalog, language, signal }) {
      const wording = language === "he" ? "Hebrew" : "English";
      const response = await client.messages.create(
        {
          model,
          max_tokens: MAX_TOKENS,
          // The instructions and our lists come first and stay identical, so they are read from the cache.
          system: [
            { type: "text", text: `${INSTRUCTIONS}\n\n${catalog}`, cache_control: { type: "ephemeral" } },
          ],
          output_config: { effort: "low", format: { type: "json_schema", schema: READING_JSON_SCHEMA } },
          thinking: { type: "disabled" },
          messages: [
            {
              role: "user",
              content: [
                ...images.map(
                  (image) =>
                    ({
                      type: "image",
                      source: {
                        type: "base64",
                        media_type: image.mediaType,
                        data: image.data.toString("base64"),
                      },
                    }) as const,
                ),
                { type: "text", text: `Write the title and description in ${wording}.` },
              ],
            },
          ],
        },
        signal ? { signal } : undefined,
      );
      if (response.stop_reason === "refusal" || response.stop_reason === "max_tokens") {
        throw new Error(`photo reader stopped: ${response.stop_reason}`);
      }
      const text = response.content.find((b): b is Anthropic.TextBlock => b.type === "text")?.text;
      if (!text) throw new Error("photo reader returned no text");
      return { reading: rawReadingSchema.parse(JSON.parse(text)), usage: toUsage(response.usage) };
    },
  };
}

/**
 * A reader that never calls the network. With no answer it is "off" (no key set). Tests give it a canned answer, or a
 * function, to see how the server checks what comes back.
 */
export function fakePhotoReader(
  answer?: RawReading | (() => RawReading | Promise<RawReading>),
): PhotoReader & {
  calls: PhotoReadInput[];
} {
  const calls: PhotoReadInput[] = [];
  return {
    enabled: answer !== undefined,
    calls,
    async read(input) {
      calls.push(input);
      if (answer === undefined) throw new Error("photo reader is off");
      const reading = typeof answer === "function" ? await answer() : answer;
      return { reading, usage: { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0 } };
    },
  };
}

/** The one place that picks the reader from the environment. No key means off, never an error. */
export function createPhotoReader(env: Pick<Env, "ANTHROPIC_API_KEY" | "PHOTO_READER_MODEL">): PhotoReader {
  if (!env.ANTHROPIC_API_KEY) return fakePhotoReader();
  return anthropicPhotoReader(env.ANTHROPIC_API_KEY, env.PHOTO_READER_MODEL);
}

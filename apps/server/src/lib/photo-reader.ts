import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import type { Env } from "../env.js";
import type { AiMeter } from "./ai-cost.js";

export type PhotoMediaType = "image/jpeg" | "image/png" | "image/webp" | "image/gif";

export type PhotoReadInput = {
  images: { mediaType: PhotoMediaType; data: Buffer }[];
  /** Our lists written out as text with short codes (see buildCatalog in photo-assist.ts). Same for everyone. */
  catalog: string;
  /** Unused by the prompt now (nothing is written in words), kept so the request stays the same. */
  language: "en" | "he";
  signal?: AbortSignal;
  /** Who asked, for the AI cost log. */
  userId?: string;
};

export type PhotoReadUsage = {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
};

/** A failure after the model answered, so the tokens were still spent and must be counted. */
export class PhotoReadError extends Error {
  constructor(
    message: string,
    readonly usage: PhotoReadUsage,
  ) {
    super(message);
    this.name = "PhotoReadError";
  }
}

/**
 * What the model says, before the server checks it. Codes (C12, K3) stand for our real ids. Everything is
 * optional because a photo often cannot answer every question. The server drops what it cannot verify.
 */
export const rawReadingSchema = z.object({
  categories: z.array(z.object({ code: z.string().nullish(), confidence: z.number().nullish() })).nullish(),
  brandText: z.string().nullish(),
  colours: z.array(z.string()).nullish(),
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
    categories: {
      type: "array",
      items: {
        type: "object",
        properties: { code: { type: "string" }, confidence: { type: "number" } },
        required: ["code", "confidence"],
        additionalProperties: false,
      },
    },
    brandText: { type: ["string", "null"] },
    colours: { type: "array", items: { type: "string" } },
  },
  required: ["categories", "brandText", "colours"],
  additionalProperties: false,
} as const;

/** The fixed part of the prompt. It does not change between requests, so it is cached together with the lists. */
const INSTRUCTIONS = `You help a seller list one second-hand clothing item for sale. You get 1 to 4 photos of the same item. Suggest the category, colours and brand the photos show. The seller will see your suggestions as shortcuts and picks for themselves, so a wrong top guess is fine as long as the right one is among your three.

Rules:
- categories: your 3 most likely leaf categories from the list below, the most likely first, each with a confidence from 0 to 1. Codes look like C12. Give fewer than 3 only if the item is so unclear that fewer fit. Think carefully about the exact type of item (for footwear: boots vs sneakers vs sandals vs heels vs flats, ankle height, sole, laces), about the gender and age group it is made for (women, men, girls, boys, baby), and about the cut. If the photos could fit both a men's and a women's category, include both. Never copy the same type three times when the type itself is unsure.
- brandText: the brand exactly as printed on a clothing tag, label, logo or the item itself. null if you cannot read one. Never guess a brand from the style of the item.
- colours: the codes of the 1 or 2 main colours of the item (codes look like K3), most dominant first. Empty if unclear.
`;

/** The most the model may write for one read. Also what the AI budget guard reserves for it. */
export const PHOTO_READER_MAX_TOKENS = 300;

function toUsage(u: Anthropic.Usage): PhotoReadUsage {
  return {
    inputTokens: u.input_tokens,
    outputTokens: u.output_tokens,
    cacheReadTokens: u.cache_read_input_tokens ?? 0,
    cacheWriteTokens: u.cache_creation_input_tokens ?? 0,
  };
}

/** Reads photos with Claude Haiku. The key and the photos never reach the logs. */
export function anthropicPhotoReader(apiKey: string, model: string): PhotoReader {
  // One quick try: the seller is waiting on a form, and a slow answer is worth less than none.
  const client = new Anthropic({ apiKey, timeout: 15_000, maxRetries: 0 });
  return {
    enabled: true,
    async read({ images, catalog, signal }) {
      const response = await client.messages.create(
        {
          model,
          max_tokens: PHOTO_READER_MAX_TOKENS,
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
                { type: "text", text: "Read the item in these photos." },
              ],
            },
          ],
        },
        signal ? { signal } : undefined,
      );
      const usage = toUsage(response.usage);
      if (response.stop_reason === "refusal" || response.stop_reason === "max_tokens") {
        throw new PhotoReadError(`photo reader stopped: ${response.stop_reason}`, usage);
      }
      const text = response.content.find((b): b is Anthropic.TextBlock => b.type === "text")?.text;
      if (!text) throw new PhotoReadError("photo reader returned no text", usage);
      try {
        return { reading: rawReadingSchema.parse(JSON.parse(text)), usage };
      } catch {
        throw new PhotoReadError("photo reader returned an answer that could not be read", usage);
      }
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
      return { reading, usage: { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 } };
    },
  };
}

/** The one place that picks the reader from the environment. No key means off, never an error. */
export function createPhotoReader(env: Pick<Env, "ANTHROPIC_API_KEY" | "PHOTO_READER_MODEL">): PhotoReader {
  if (!env.ANTHROPIC_API_KEY) return fakePhotoReader();
  return anthropicPhotoReader(env.ANTHROPIC_API_KEY, env.PHOTO_READER_MODEL);
}

/** Rough size of one photo for the budget check. The real count comes back in the usage after the call. */
const ESTIMATED_TOKENS_PER_IMAGE = 1600;

/**
 * Puts a reader behind the AI cost meter (lib/ai-cost.ts): the call is refused when the AI switch is off or a spend
 * cap would be passed (the caller then treats it like any failure and answers with an empty suggestion), and every
 * call that used tokens is written to the cost log, failed ones included.
 */
export function meteredPhotoReader(
  reader: PhotoReader,
  meter: AiMeter,
  model: string,
  /** The name the cost log and the Expenses page know this use by. */
  action = "photo_check",
): PhotoReader {
  return {
    get enabled() {
      return reader.enabled;
    },
    async read(input) {
      await meter.assertAllowed({
        model,
        maxOutputTokens: PHOTO_READER_MAX_TOKENS,
        estimatedInputTokens:
          Math.ceil(input.catalog.length / 4) + input.images.length * ESTIMATED_TOKENS_PER_IMAGE,
      });
      const base = { provider: "anthropic", model, action, userId: input.userId ?? null };
      try {
        const result = await reader.read(input);
        await meter.record({ ...base, usage: result.usage, ok: true });
        return result;
      } catch (error) {
        // A failure before the model answered (timeout, network) used nothing we can count.
        if (error instanceof PhotoReadError) await meter.record({ ...base, usage: error.usage, ok: false });
        throw error;
      }
    },
  };
}

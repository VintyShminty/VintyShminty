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

/** One photo the model flagged: its number (1 is the first photo sent) and what looked wrong. Checked by the server. */
const rawPhotoIssuesSchema = z
  .array(z.object({ photo: z.number().nullish(), issues: z.array(z.string()).nullish() }))
  .nullish();

/**
 * What the model says, before the server checks it. Codes (C12, K3) stand for our real ids. Everything is
 * optional because a photo often cannot answer every question. The server drops what it cannot verify.
 */
export const rawReadingSchema = z.object({
  categories: z.array(z.object({ code: z.string().nullish(), confidence: z.number().nullish() })).nullish(),
  brandText: z.string().nullish(),
  colours: z.array(z.string()).nullish(),
  /** Photos with a clear problem (D-036). Missing or empty means nothing was flagged. */
  photoIssues: rawPhotoIssuesSchema,
});
export type RawReading = z.infer<typeof rawReadingSchema>;

/** What the tips-only check says, before the server maps the photo numbers back to upload keys. */
export const rawCheckSchema = z.object({ photoIssues: rawPhotoIssuesSchema });
export type RawCheck = z.infer<typeof rawCheckSchema>;

export type PhotoCheckInput = {
  images: PhotoReadInput["images"];
  signal?: AbortSignal;
  userId?: string;
};

/** What the server needs from the model that looks at photos. Anthropic online, a fake in tests. */
export interface PhotoReader {
  /** False when no key is set. The feature is then off and the app never calls it. */
  readonly enabled: boolean;
  /** Throws on any failure, the caller turns that into an empty suggestion. */
  read(input: PhotoReadInput): Promise<{ reading: RawReading; usage: PhotoReadUsage }>;
  /** Looks at photos for tips only (dark, cut off, contact details), no catalog. Throws on any failure. */
  check(input: PhotoCheckInput): Promise<{ reading: RawCheck; usage: PhotoReadUsage }>;
}

const PHOTO_ISSUES_JSON_SCHEMA = {
  type: "array",
  items: {
    type: "object",
    properties: {
      photo: { type: "number" },
      issues: { type: "array", items: { type: "string", enum: ["dark", "cut_off", "contact"] } },
    },
    required: ["photo", "issues"],
    additionalProperties: false,
  },
} as const;

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
    photoIssues: PHOTO_ISSUES_JSON_SCHEMA,
  },
  required: ["categories", "brandText", "colours", "photoIssues"],
  additionalProperties: false,
} as const;

const CHECK_JSON_SCHEMA = {
  type: "object",
  properties: { photoIssues: PHOTO_ISSUES_JSON_SCHEMA },
  required: ["photoIssues"],
  additionalProperties: false,
} as const;

/** The photo tips rules, written once and used by the full read and by the tips-only check. */
const PHOTO_ISSUE_RULES = `Flag only clear problems. When in doubt, flag nothing. Photos are numbered in the order they come, starting at 1.
- "dark": the photo is so dark that you cannot see the item's colour or details.
- "cut_off": a meaningful part of the item is outside the frame. Close-up detail shots of a tag, fabric, print or flaw are fine, and photos after the first are often deliberate close-ups, so do not flag those.
- "contact": a phone number, email address, social media handle or messaging QR code is visible. Brand names, size tags and care labels are not contact details.`;

/** The fixed part of the prompt. It does not change between requests, so it is cached together with the lists. */
const INSTRUCTIONS = `You help a seller list one second-hand clothing item for sale. You get 1 to 4 photos of the same item. Suggest the category, colours and brand the photos show. The seller will see your suggestions as shortcuts and picks for themselves, so a wrong top guess is fine as long as the right one is among your three.

Rules:
- categories: your 3 most likely leaf categories from the list below, the most likely first, each with a confidence from 0 to 1. Codes look like C12. Give fewer than 3 only if the item is so unclear that fewer fit. Think carefully about the exact type of item (for footwear: boots vs sneakers vs sandals vs heels vs flats, ankle height, sole, laces), about the gender and age group it is made for (women, men, girls, boys, baby), and about the cut. If the photos could fit both a men's and a women's category, include both. Never copy the same type three times when the type itself is unsure.
- brandText: the brand exactly as printed on a clothing tag, label, logo or the item itself. null if you cannot read one. Never guess a brand from the style of the item.
- colours: the codes of the 1 or 2 main colours of the item (codes look like K3), most dominant first. Empty if unclear.
- photoIssues: a list of photos with a problem, each as the photo number and the issues found. Empty list when nothing is wrong.
${PHOTO_ISSUE_RULES}
`;

/** The instructions for the tips-only check of photos added after the first read. */
const CHECK_INSTRUCTIONS = `You help a seller list a second-hand item. You get 1 to 4 photos of it. Report only problems with the photos themselves, as photoIssues: a list of photos with a problem, each as the photo number and the issues found. Empty list when nothing is wrong.
${PHOTO_ISSUE_RULES}`;

/** The most the model may write for one read. Also what the AI budget guard reserves for it. */
export const PHOTO_READER_MAX_TOKENS = 400;

/** The most the model may write for a tips-only check. */
export const PHOTO_CHECK_MAX_TOKENS = 150;

function toUsage(u: Anthropic.Usage): PhotoReadUsage {
  return {
    inputTokens: u.input_tokens,
    outputTokens: u.output_tokens,
    cacheReadTokens: u.cache_read_input_tokens ?? 0,
    cacheWriteTokens: u.cache_creation_input_tokens ?? 0,
  };
}

function imageBlocks(images: PhotoReadInput["images"]) {
  return images.map(
    (image) =>
      ({
        type: "image",
        source: { type: "base64", media_type: image.mediaType, data: image.data.toString("base64") },
      }) as const,
  );
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
              content: [...imageBlocks(images), { type: "text", text: "Read the item in these photos." }],
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
    async check({ images, signal }) {
      const response = await client.messages.create(
        {
          model,
          max_tokens: PHOTO_CHECK_MAX_TOKENS,
          system: [{ type: "text", text: CHECK_INSTRUCTIONS, cache_control: { type: "ephemeral" } }],
          output_config: { effort: "low", format: { type: "json_schema", schema: CHECK_JSON_SCHEMA } },
          thinking: { type: "disabled" },
          messages: [
            {
              role: "user",
              content: [...imageBlocks(images), { type: "text", text: "Check these photos." }],
            },
          ],
        },
        signal ? { signal } : undefined,
      );
      const usage = toUsage(response.usage);
      if (response.stop_reason === "refusal" || response.stop_reason === "max_tokens") {
        throw new PhotoReadError(`photo check stopped: ${response.stop_reason}`, usage);
      }
      const text = response.content.find((b): b is Anthropic.TextBlock => b.type === "text")?.text;
      if (!text) throw new PhotoReadError("photo check returned no text", usage);
      try {
        return { reading: rawCheckSchema.parse(JSON.parse(text)), usage };
      } catch {
        throw new PhotoReadError("photo check returned an answer that could not be read", usage);
      }
    },
  };
}

/**
 * A reader that never calls the network. With no answer it is "off" (no key set). Tests give it a canned answer, or a
 * function, to see how the server checks what comes back. The second answer is for the tips-only check, without one
 * the check reuses the photo issues of the first answer.
 */
export function fakePhotoReader(
  answer?: RawReading | (() => RawReading | Promise<RawReading>),
  checkAnswer?: RawCheck | (() => RawCheck | Promise<RawCheck>),
): PhotoReader & {
  calls: PhotoReadInput[];
  checkCalls: PhotoCheckInput[];
} {
  const calls: PhotoReadInput[] = [];
  const checkCalls: PhotoCheckInput[] = [];
  const noUsage = { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 };
  return {
    enabled: answer !== undefined || checkAnswer !== undefined,
    calls,
    checkCalls,
    async read(input) {
      calls.push(input);
      if (answer === undefined) throw new Error("photo reader is off");
      const reading = typeof answer === "function" ? await answer() : answer;
      return { reading, usage: noUsage };
    },
    async check(input) {
      checkCalls.push(input);
      if (checkAnswer !== undefined) {
        const reading = typeof checkAnswer === "function" ? await checkAnswer() : checkAnswer;
        return { reading, usage: noUsage };
      }
      if (answer === undefined) throw new Error("photo reader is off");
      const full = typeof answer === "function" ? await answer() : answer;
      return { reading: { photoIssues: full.photoIssues }, usage: noUsage };
    },
  };
}

/** The one place that picks the reader from the environment. No key means off, never an error. */
export function createPhotoReader(env: Pick<Env, "ANTHROPIC_API_KEY" | "PHOTO_READER_MODEL">): PhotoReader {
  if (!env.ANTHROPIC_API_KEY) return fakePhotoReader();
  return anthropicPhotoReader(env.ANTHROPIC_API_KEY, env.PHOTO_READER_MODEL);
}

/** The name the cost log knows the tips-only check of later photos by. */
export const PHOTO_TIPS_ACTION = "photo_tips";

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
    async check(input) {
      await meter.assertAllowed({
        model,
        maxOutputTokens: PHOTO_CHECK_MAX_TOKENS,
        estimatedInputTokens: input.images.length * ESTIMATED_TOKENS_PER_IMAGE,
      });
      const base = { provider: "anthropic", model, action: PHOTO_TIPS_ACTION, userId: input.userId ?? null };
      try {
        const result = await reader.check(input);
        await meter.record({ ...base, usage: result.usage, ok: true });
        return result;
      } catch (error) {
        if (error instanceof PhotoReadError) await meter.record({ ...base, usage: error.usage, ok: false });
        throw error;
      }
    },
  };
}

import { adminActions, aiCalls, type Database, killSwitches } from "@vinty/db";
import { AI_DAILY_CAP_USD_MICROS, AI_HOURLY_CAP_USD_MICROS } from "@vinty/shared";
import { eq, sql } from "drizzle-orm";

type Db = NonNullable<Database["db"]>;

/** Tokens of one AI call. Input is what was NOT read from or written to the cache, as the provider reports it. */
export type AiUsage = {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
};

/** US dollars per million tokens. One dollar per million tokens is exactly one micro dollar per token. */
type ModelPrice = {
  input: number;
  output: number;
  cacheRead: number;
  /** The 5 minute cache write, which is what the photo helper uses. */
  cacheWrite: number;
  /** A prompt longer than this many tokens is billed at the `long` card instead. */
  long?: { input: number; output: number; cacheRead: number; cacheWrite: number };
};

const LONG_PROMPT_TOKENS = 100_000;

/**
 * Source: Anthropic's model and pricing table as shipped in the claude-api skill (cached 2026-10-06), checked
 * 2026-10-14. Cache reads are 0.1x the input price, 5 minute cache writes 1.25x. Haiku 5.5 has two rate cards, by
 * prompt length: $0.10 / $0.50 up to 100K tokens and $0.50 / $2.50 above. Re-check when the model changes.
 */
export const MODEL_PRICES: Record<string, ModelPrice> = {
  "claude-haiku-5-5": {
    input: 0.1,
    output: 0.5,
    cacheRead: 0.01,
    cacheWrite: 0.125,
    long: { input: 0.5, output: 2.5, cacheRead: 0.05, cacheWrite: 0.625 },
  },
  "claude-haiku-4-5": { input: 1, output: 5, cacheRead: 0.1, cacheWrite: 1.25 },
  "claude-sonnet-5-5": { input: 2, output: 10, cacheRead: 0.2, cacheWrite: 2.5 },
  "claude-opus-5-5": { input: 4, output: 20, cacheRead: 0.4, cacheWrite: 5 },
};

/** Used for a model we have no price for. Never zero: the most expensive known model by output price. */
const FALLBACK_MODEL = Object.entries(MODEL_PRICES).reduce((best, entry) =>
  entry[1].output > best[1].output ? entry : best,
)[0];

export type AiLogger = {
  warn: (obj: object, msg?: string) => void;
  error: (obj: object, msg?: string) => void;
};
const quietLogger: AiLogger = { warn() {}, error() {} };

function priceFor(model: string, totalInputTokens: number, logger: AiLogger) {
  let price = MODEL_PRICES[model];
  if (!price) {
    logger.warn(
      { model, pricedAs: FALLBACK_MODEL },
      "no price for this AI model, using the most expensive one",
    );
    price = MODEL_PRICES[FALLBACK_MODEL] as ModelPrice;
  }
  return price.long && totalInputTokens > LONG_PROMPT_TOKENS ? price.long : price;
}

/** What a call costs, in millionths of a dollar, rounded up so that a call with tokens never costs 0. */
export function costOf(model: string, usage: Partial<AiUsage>, logger: AiLogger = quietLogger): number {
  const u = { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, ...usage };
  const price = priceFor(model, u.inputTokens + u.cacheReadTokens + u.cacheWriteTokens, logger);
  const micros =
    u.inputTokens * price.input +
    u.outputTokens * price.output +
    u.cacheReadTokens * price.cacheRead +
    u.cacheWriteTokens * price.cacheWrite;
  // toFixed removes float noise such as 100.00000000000001 before rounding up.
  return Math.ceil(Number(micros.toFixed(6)));
}

/** Thrown by `assertAllowed` when the AI is switched off or the spend cap is reached. */
export class AiRefusedError extends Error {
  constructor(
    readonly code: "switch_off" | "hourly_cap" | "daily_cap",
    message: string,
  ) {
    super(message);
    this.name = "AiRefusedError";
  }
}

const dollars = (micros: number) => `$${(micros / 1_000_000).toFixed(micros % 1_000_000 === 0 ? 0 : 2)}`;

export type AiMeterOptions = {
  /** Default $2 per rolling hour. */
  hourlyCapMicros?: number;
  /** Default $10 per calendar day (UTC). */
  dailyCapMicros?: number;
  /** How long the switch is remembered in this server copy. Default 30 seconds. */
  switchCacheMs?: number;
  logger?: AiLogger;
  now?: () => Date;
};

export type AiCallRecord = {
  provider: string;
  model: string;
  action: string;
  userId?: string | null;
  usage: Partial<AiUsage>;
  ok: boolean;
};

/**
 * The one gate every AI call goes through: ask `assertAllowed` before calling the provider, `record` after.
 * Spend is summed from the `ai_calls` table. The master switch ("ai" in `kill_switches`) is cached for 30 seconds
 * per server copy, so a flip from the admin panel can take that long to reach another copy. The check and the
 * insert are not one transaction, so a burst of calls at the same moment can overshoot a cap by a few calls.
 */
export class AiMeter {
  readonly hourlyCapMicros: number;
  readonly dailyCapMicros: number;
  private readonly cacheMs: number;
  private readonly logger: AiLogger;
  private readonly now: () => Date;
  private cached: { enabled: boolean; reason: string | null; at: number } | null = null;

  constructor(
    private readonly db: Db,
    options: AiMeterOptions = {},
  ) {
    this.hourlyCapMicros = options.hourlyCapMicros ?? AI_HOURLY_CAP_USD_MICROS;
    this.dailyCapMicros = options.dailyCapMicros ?? AI_DAILY_CAP_USD_MICROS;
    this.cacheMs = options.switchCacheMs ?? 30_000;
    this.logger = options.logger ?? quietLogger;
    this.now = options.now ?? (() => new Date());
  }

  /** Forget the remembered switch, so the next call reads it again. Called after a flip in this server copy. */
  invalidate() {
    this.cached = null;
  }

  async switchState(): Promise<{ enabled: boolean; reason: string | null }> {
    const at = this.now().getTime();
    if (this.cached && at - this.cached.at < this.cacheMs) return this.cached;
    const [row] = await this.db
      .select({ enabled: killSwitches.enabled, reason: killSwitches.reason })
      .from(killSwitches)
      .where(eq(killSwitches.name, "ai"))
      .limit(1);
    // A missing row means on.
    this.cached = { enabled: row?.enabled ?? true, reason: row?.reason ?? null, at };
    return this.cached;
  }

  /** Spend in the last 60 minutes and since 00:00 UTC today, in micro dollars. */
  async spend(): Promise<{ hourMicros: number; dayMicros: number }> {
    const now = this.now();
    const hourAgo = new Date(now.getTime() - 3_600_000);
    const midnight = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const [row] = await this.db
      .select({
        hour: sql<string>`coalesce(sum(${aiCalls.costUsdMicros}) filter (where ${aiCalls.createdAt} >= ${hourAgo.toISOString()}::timestamptz), 0)`,
        day: sql<string>`coalesce(sum(${aiCalls.costUsdMicros}) filter (where ${aiCalls.createdAt} >= ${midnight.toISOString()}::timestamptz), 0)`,
      })
      .from(aiCalls)
      .where(
        sql`${aiCalls.createdAt} >= least(${hourAgo.toISOString()}::timestamptz, ${midnight.toISOString()}::timestamptz)`,
      );
    return { hourMicros: Number(row?.hour ?? 0), dayMicros: Number(row?.day ?? 0) };
  }

  /**
   * Throws AiRefusedError when the switch is off, or when this call (priced at its worst case) would pass a cap.
   * Passing a cap also flips the switch off and writes an audit row, so nothing else gets through until an admin
   * turns it back on.
   */
  async assertAllowed(call: { model: string; maxOutputTokens: number; estimatedInputTokens: number }) {
    const state = await this.switchState();
    if (!state.enabled) throw new AiRefusedError("switch_off", state.reason ?? "The AI switch is off");

    const estimate = costOf(
      call.model,
      {
        inputTokens: call.estimatedInputTokens,
        outputTokens: call.maxOutputTokens,
      },
      this.logger,
    );
    const { hourMicros, dayMicros } = await this.spend();
    if (dayMicros + estimate > this.dailyCapMicros) {
      await this.tripSwitch(`Daily AI cap of ${dollars(this.dailyCapMicros)} reached`, {
        dayMicros,
        estimate,
      });
      throw new AiRefusedError("daily_cap", "Daily AI cap reached");
    }
    if (hourMicros + estimate > this.hourlyCapMicros) {
      await this.tripSwitch(`Hourly AI cap of ${dollars(this.hourlyCapMicros)} reached`, {
        hourMicros,
        estimate,
      });
      throw new AiRefusedError("hourly_cap", "Hourly AI cap reached");
    }
  }

  private async tripSwitch(reason: string, details: Record<string, number>) {
    try {
      // Only the copy that really flips it from on to off writes the audit row.
      const flipped = await this.db
        .insert(killSwitches)
        .values({ name: "ai", enabled: false, reason, changedBy: null })
        .onConflictDoUpdate({
          target: killSwitches.name,
          set: { enabled: false, reason, changedBy: null, changedAt: sql`now()` },
          setWhere: eq(killSwitches.enabled, true),
        })
        .returning({ name: killSwitches.name });
      if (flipped.length > 0) {
        await this.db.insert(adminActions).values({
          adminUserId: null,
          action: "ai_auto_disabled",
          targetType: "switch",
          targetId: "ai",
          details: { reason, ...details },
        });
      }
    } catch (err) {
      this.logger.error({ err }, "could not switch the AI off");
    }
    this.cached = { enabled: false, reason, at: this.now().getTime() };
  }

  /** Writes one `ai_calls` row. Never throws: a failed write is logged and the caller carries on. */
  async record(call: AiCallRecord) {
    try {
      const usage = call.usage;
      await this.db.insert(aiCalls).values({
        provider: call.provider,
        model: call.model,
        action: call.action,
        userId: call.userId ?? null,
        inputTokens: usage.inputTokens ?? 0,
        outputTokens: usage.outputTokens ?? 0,
        cacheReadTokens: usage.cacheReadTokens ?? 0,
        cacheWriteTokens: usage.cacheWriteTokens ?? 0,
        costUsdMicros: costOf(call.model, usage, this.logger),
        ok: call.ok,
      });
    } catch (err) {
      this.logger.error({ err, action: call.action }, "could not record an AI call");
    }
  }
}

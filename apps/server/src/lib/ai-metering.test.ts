import { aiCalls, createDb, killSwitches } from "@vinty/db";
import { and, eq, gte, inArray } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { databaseUrl } from "../test-helpers.js";
import { AiMeter, AiRefusedError } from "./ai-cost.js";
import { fakeChatCheckReader, meteredChatCheckReader } from "./chat-check.js";
import { fakePhotoReader, meteredPhotoReader } from "./photo-reader.js";
import { fakeQuickRepliesReader, meteredQuickRepliesReader } from "./quick-replies.js";
import { fakeSearchReader, meteredSearchReader } from "./search-reader.js";
import { fakeTextReader, meteredTextReader } from "./text-reader.js";

const MODEL = "claude-haiku-5-5";
const ACTIONS = ["photo_tips", "text_suggest", "search_understand", "chat_check", "quick_replies"];
const image = { mediaType: "image/jpeg" as const, data: Buffer.from("x") };

// Runs only with a local database. Rows are found by action name and by the time this file started.
describe.skipIf(!databaseUrl)("metering of the tips check and the text helper", () => {
  const database = createDb(databaseUrl as string);
  const db = database.db;
  const startedAt = new Date();
  const rows = () =>
    db
      .select()
      .from(aiCalls)
      .where(and(inArray(aiCalls.action, ACTIONS), gte(aiCalls.createdAt, startedAt)));
  const reset = async () => {
    await db.delete(aiCalls).where(and(inArray(aiCalls.action, ACTIONS), gte(aiCalls.createdAt, startedAt)));
    await db.delete(killSwitches).where(eq(killSwitches.name, "ai"));
  };
  beforeAll(reset);
  afterEach(reset);
  afterAll(async () => {
    await reset();
    await database.close();
  });

  it("records the tips check under photo_tips", async () => {
    const meter = new AiMeter(db);
    const reader = meteredPhotoReader(fakePhotoReader({}, { photoIssues: [] }), meter, MODEL);
    await reader.check({ images: [image] });
    expect((await rows()).map((r) => r.action)).toEqual(["photo_tips"]);
  });

  it("records the text helper under text_suggest", async () => {
    const meter = new AiMeter(db);
    const reader = meteredTextReader(fakeTextReader({}), meter, MODEL);
    await reader.read({ title: "Blue jeans", description: "", catalog: "C1: x" });
    expect((await rows()).map((r) => r.action)).toEqual(["text_suggest"]);
  });

  it("records the search helper under search_understand", async () => {
    const meter = new AiMeter(db);
    const reader = meteredSearchReader(fakeSearchReader({}), meter, MODEL);
    await reader.read({ text: "red dress under 100", catalog: "C1: x" });
    expect((await rows()).map((r) => r.action)).toEqual(["search_understand"]);
  });

  it("records the chat check under chat_check", async () => {
    const meter = new AiMeter(db);
    const reader = meteredChatCheckReader(
      fakeChatCheckReader({ warning: null, review: false, summary: "" }),
      meter,
      MODEL,
    );
    await reader.read({
      latest: { side: "buyer", text: "Is it still available?" },
      previous: [],
      listingTitle: "Blue jeans",
      priceMinor: 4500,
      currency: "ILS",
    });
    expect((await rows()).map((r) => r.action)).toEqual(["chat_check"]);
  });

  it("records the quick replies under quick_replies", async () => {
    const meter = new AiMeter(db);
    const reader = meteredQuickRepliesReader(fakeQuickRepliesReader({ replies: ["Yes"] }), meter, MODEL);
    await reader.read({
      language: "en",
      askerSide: "seller",
      listingTitle: "Blue jeans",
      priceMinor: 4500,
      currency: "ILS",
      listingStatus: "active",
      messages: [{ side: "buyer", text: "Is it still available?" }],
    });
    expect((await rows()).map((r) => r.action)).toEqual(["quick_replies"]);
  });

  it("refuses the chat helpers, and records nothing, when the AI switch is off", async () => {
    await db.insert(killSwitches).values({ name: "ai", enabled: false, reason: "Paused" });
    const meter = new AiMeter(db);
    const check = fakeChatCheckReader({ warning: null, review: false, summary: "" });
    const replies = fakeQuickRepliesReader({ replies: ["Yes"] });
    await expect(
      meteredChatCheckReader(check, meter, MODEL).read({
        latest: { side: "buyer", text: "Hi" },
        previous: [],
        listingTitle: "Blue jeans",
        priceMinor: null,
        currency: null,
      }),
    ).rejects.toBeInstanceOf(AiRefusedError);
    await expect(
      meteredQuickRepliesReader(replies, meter, MODEL).read({
        language: "en",
        askerSide: "seller",
        listingTitle: "Blue jeans",
        priceMinor: null,
        currency: null,
        listingStatus: "active",
        messages: [{ side: "buyer", text: "Hi" }],
      }),
    ).rejects.toBeInstanceOf(AiRefusedError);
    expect(check.calls).toHaveLength(0);
    expect(replies.calls).toHaveLength(0);
    expect(await rows()).toHaveLength(0);
  });

  it("refuses both, and records nothing, when the AI switch is off", async () => {
    await db.insert(killSwitches).values({ name: "ai", enabled: false, reason: "Paused" });
    const meter = new AiMeter(db);
    const photo = fakePhotoReader({}, { photoIssues: [] });
    const text = fakeTextReader({});
    await expect(meteredPhotoReader(photo, meter, MODEL).check({ images: [image] })).rejects.toBeInstanceOf(
      AiRefusedError,
    );
    await expect(
      meteredTextReader(text, meter, MODEL).read({ title: "Blue jeans", description: "", catalog: "" }),
    ).rejects.toBeInstanceOf(AiRefusedError);
    expect(photo.checkCalls).toHaveLength(0);
    expect(text.calls).toHaveLength(0);
    expect(await rows()).toHaveLength(0);
  });
});

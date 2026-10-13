import {
  feedHidden,
  feedSnapshots,
  listingColours,
  listings,
  messages,
  orderItems,
  userAffinities,
  userEvents,
  userSettings,
} from "@vinty/db";
import {
  type AffinityDelta,
  affinityDeltas,
  type CategoryNode,
  categoryTrail,
  EVENT_WEIGHTS,
  type FeedSurface,
  findCategory,
  HALF_LIFE_DAYS,
  type ItemFeatures,
  priceBand,
  type ReferenceData,
  type UserEventType,
} from "@vinty/shared";
import { eq, inArray, sql } from "drizzle-orm";
import type { FastifyInstance } from "fastify";

type App = Pick<FastifyInstance, "db" | "reference" | "log">;

/**
 * One thing that happened. A listing gives the server every feature of the item. Without a listing the caller may
 * name a category, a brand or a seller directly (a search, a category visit, "show less of this brand").
 */
export type EventInput = {
  type: UserEventType;
  listingId?: string | null | undefined;
  categoryId?: string | null | undefined;
  brandId?: string | null | undefined;
  sellerId?: string | null | undefined;
  clientEventId?: string | undefined;
  surface?: FeedSurface | undefined;
  position?: number | undefined;
  feedId?: string | undefined;
  occurredAt?: Date | undefined;
  data?: Record<string, unknown> | undefined;
};

export type RecordResult = { recorded: number; skipped: number };

/** Everything above a category in the tree, closest first (for example Clothing, then Women). */
export function parentCategoryIds(tree: readonly CategoryNode[], categoryId: string): string[] {
  return categoryTrail(tree, categoryId)
    .slice(0, -1)
    .map((n) => n.id)
    .reverse();
}

/** Whether this person lets the feed learn from what they do. A missing settings row means yes. */
export async function personalisationOn(app: Pick<App, "db">, userId: string): Promise<boolean> {
  const [row] = await app.db
    .select({ on: userSettings.personaliseFeed })
    .from(userSettings)
    .where(eq(userSettings.userId, userId))
    .limit(1);
  return row ? row.on : true;
}

export type ListingFeatures = ItemFeatures & {
  categoryId: string | null;
  brandId: string | null;
  sellerId: string;
  sizeId: string | null;
  priceBandValue: number | null;
};

/** The features of listings, read from the database. Unknown ids are left out. */
export async function loadListingFeatures(
  app: Pick<App, "db" | "reference">,
  listingIds: string[],
): Promise<Map<string, ListingFeatures>> {
  const result = new Map<string, ListingFeatures>();
  if (listingIds.length === 0) return result;
  const reference = await app.reference.get();
  const [rows, colours] = await Promise.all([
    app.db
      .select({
        id: listings.id,
        sellerId: listings.sellerId,
        categoryId: listings.categoryId,
        brandId: listings.brandId,
        sizeId: listings.sizeId,
        conditionId: listings.conditionId,
        priceMinor: listings.priceMinor,
      })
      .from(listings)
      .where(inArray(listings.id, listingIds)),
    app.db
      .select({ listingId: listingColours.listingId, colourId: listingColours.colourId })
      .from(listingColours)
      .where(inArray(listingColours.listingId, listingIds)),
  ]);
  const colourMap = new Map<string, string[]>();
  for (const c of colours) colourMap.set(c.listingId, [...(colourMap.get(c.listingId) ?? []), c.colourId]);
  for (const r of rows) {
    result.set(r.id, {
      categoryId: r.categoryId,
      parentCategoryIds: r.categoryId ? parentCategoryIds(reference.categories, r.categoryId) : [],
      brandId: r.brandId,
      sellerId: r.sellerId,
      sizeId: r.sizeId,
      priceMinor: r.priceMinor,
      priceBandValue: priceBand(r.priceMinor),
      colourIds: colourMap.get(r.id) ?? [],
      conditionId: r.conditionId,
    });
  }
  return result;
}

/** A category named directly: a leaf counts as the item's own category, a branch (Women) counts as a parent. */
function categoryDeltas(weight: number, reference: ReferenceData, categoryId: string): AffinityDelta[] {
  const node = findCategory(reference.categories, categoryId);
  if (!node) return [];
  const parents = parentCategoryIds(reference.categories, categoryId);
  if (node.isLeaf) return affinityDeltas(weight, { categoryId, parentCategoryIds: parents });
  return [
    { feature: "parent_category", key: categoryId, delta: weight },
    ...affinityDeltas(weight, { parentCategoryIds: parents }),
  ];
}

/** Adds the deltas to the person's taste sheet. Positive ones create or raise a line, negative ones only lower one. */
export async function applyAffinityDeltas(
  db: App["db"],
  userId: string,
  deltas: AffinityDelta[],
): Promise<void> {
  const merged = new Map<string, AffinityDelta>();
  for (const d of deltas) {
    const id = `${d.feature}:${d.key}`;
    const found = merged.get(id);
    if (found) found.delta += d.delta;
    else merged.set(id, { ...d });
  }
  const list = [...merged.values()].filter((d) => d.delta !== 0);
  const rows = (items: AffinityDelta[]) =>
    sql.join(
      items.map((d) => sql`(${d.feature}::affinity_feature, ${d.key}::text, ${d.delta}::real)`),
      sql`, `,
    );
  const fade = sql`power(0.5, extract(epoch from now() - user_affinities.scored_at) / (${HALF_LIFE_DAYS} * 86400))`;
  const up = list.filter((d) => d.delta > 0);
  const down = list.filter((d) => d.delta < 0);
  if (up.length > 0) {
    await db.execute(sql`
      insert into user_affinities (user_id, feature, feature_key, score, scored_at, event_count)
      select ${userId}::uuid, v.feature, v.key, v.delta, now(), 1
      from (values ${rows(up)}) as v(feature, key, delta)
      on conflict (user_id, feature, feature_key) do update set
        score = user_affinities.score * ${fade} + excluded.score,
        scored_at = now(),
        event_count = user_affinities.event_count + 1`);
  }
  if (down.length > 0) {
    await db.execute(sql`
      update user_affinities set
        score = greatest(user_affinities.score * ${fade} + v.delta, 0),
        scored_at = now(),
        event_count = user_affinities.event_count + 1
      from (values ${rows(down)}) as v(feature, key, delta)
      where user_affinities.user_id = ${userId}::uuid
        and user_affinities.feature = v.feature and user_affinities.feature_key = v.key`);
  }
}

/**
 * Writes actions to the diary and adds their weight to the person's taste. Called from the handlers that already see
 * the action. Nothing is written when the person switched personalisation off, and an action on the person's own
 * listing is skipped. A resent action (same `clientEventId`) is not counted twice.
 * It never throws: learning must not break a heart or an order.
 */
export async function recordEvents(app: App, userId: string, inputs: EventInput[]): Promise<RecordResult> {
  if (inputs.length === 0) return { recorded: 0, skipped: 0 };
  try {
    if (!(await personalisationOn(app, userId))) return { recorded: 0, skipped: inputs.length };
    const reference = await app.reference.get();
    const features = await loadListingFeatures(app, [
      ...new Set(inputs.flatMap((i) => (i.listingId ? [i.listingId] : [])).filter(Boolean)),
    ]);

    type Prepared = { id: string; deltas: AffinityDelta[]; row: typeof userEvents.$inferInsert };
    const prepared: Prepared[] = [];
    let skipped = 0;
    for (const input of inputs) {
      const weight = EVENT_WEIGHTS[input.type];
      let copied: Partial<typeof userEvents.$inferInsert>;
      let deltas: AffinityDelta[];
      if (input.listingId) {
        const f = features.get(input.listingId);
        if (!f || f.sellerId === userId) {
          skipped += 1;
          continue;
        }
        copied = {
          categoryId: f.categoryId,
          brandId: f.brandId,
          sizeId: f.sizeId,
          sellerId: f.sellerId,
          priceBand: f.priceBandValue,
        };
        deltas = affinityDeltas(weight, f);
      } else {
        copied = {
          categoryId: input.categoryId ?? null,
          brandId: input.brandId ?? null,
          sellerId: input.sellerId ?? null,
        };
        deltas = [
          ...(input.categoryId ? categoryDeltas(weight, reference, input.categoryId) : []),
          ...affinityDeltas(weight, { brandId: input.brandId, sellerId: input.sellerId }),
        ];
      }
      const id = crypto.randomUUID();
      prepared.push({
        id,
        deltas,
        row: {
          id,
          userId,
          type: input.type,
          clientEventId: input.clientEventId ?? null,
          listingId: input.listingId ?? null,
          surface: input.surface ?? null,
          position: input.position ?? null,
          feedId: input.feedId ?? null,
          data: input.data ?? {},
          ...(input.occurredAt ? { occurredAt: input.occurredAt } : {}),
          ...copied,
        },
      });
    }
    if (prepared.length === 0) return { recorded: 0, skipped };

    const inserted = await app.db
      .insert(userEvents)
      .values(prepared.map((p) => p.row))
      .onConflictDoNothing()
      .returning({ id: userEvents.id });
    const insertedIds = new Set(inserted.map((r) => r.id));
    skipped += prepared.length - insertedIds.size;
    const deltas = prepared.filter((p) => insertedIds.has(p.id)).flatMap((p) => p.deltas);
    if (deltas.length > 0) await applyAffinityDeltas(app.db, userId, deltas);
    return { recorded: insertedIds.size, skipped };
  } catch (err) {
    app.log.error({ err }, "could not record events");
    return { recorded: 0, skipped: inputs.length };
  }
}

/**
 * A buyer's first text or photo in a chat about a listing: "message a seller". Later messages and the seller's replies
 * say nothing new about the buyer's taste.
 */
export async function recordFirstMessage(
  app: App,
  conversation: { id: string; listingId: string; buyerId: string },
  senderId: string,
): Promise<void> {
  if (conversation.buyerId !== senderId) return;
  const [row] = await app.db
    .select({ n: sql<number>`count(*)::int` })
    .from(messages)
    .where(
      sql`${messages.conversationId} = ${conversation.id} and ${messages.senderId} = ${senderId} and ${messages.kind} in ('text', 'photo')`,
    );
  if (row?.n !== 1) return;
  await recordEvents(app, senderId, [{ type: "message_seller", listingId: conversation.listingId }]);
}

/** The items of a paid order: "buy", the strongest sign of taste. */
export async function recordPurchase(app: App, buyerId: string, orderId: string): Promise<void> {
  const items = await app.db
    .select({ listingId: orderItems.listingId })
    .from(orderItems)
    .where(eq(orderItems.orderId, orderId));
  await recordEvents(
    app,
    buyerId,
    items.flatMap((i) => (i.listingId ? [{ type: "purchase" as const, listingId: i.listingId }] : [])),
  );
}

type Tx = Pick<App["db"], "delete">;

/** Clears what the feed learned about a person: the diary, the taste sheet and the saved lists. Hearts, sizes, follows and hides stay. */
export async function resetLearnedTaste(db: Tx, userId: string): Promise<void> {
  await db.delete(userEvents).where(eq(userEvents.userId, userId));
  await db.delete(userAffinities).where(eq(userAffinities.userId, userId));
  await db.delete(feedSnapshots).where(eq(feedSnapshots.userId, userId));
}

/** Everything the feed keeps about a person, hides included. Used when an account is closed. */
export async function deleteAllFeedData(db: Tx, userId: string): Promise<void> {
  await resetLearnedTaste(db, userId);
  await db.delete(feedHidden).where(eq(feedHidden.userId, userId));
}

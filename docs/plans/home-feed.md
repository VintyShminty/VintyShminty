# Plan: a home feed that learns

Status: draft, waiting for Eden's decisions (section 9). Nothing is built yet. Scheduled as Milestone 7 in `docs/roadmap.md`.

## Why

> i want to plan the "home feed algorithm" for our app, that will know exactly what to recommend to users based on their behavior in the app: clothes they liked and saved, specific type of clothes they come back to often, categories they visit often, it needs to progress and grow as users behavior grows as well.
> (Eden)

## Where we are today

The app already has a simple personal feed (`GET /v1/feed`, `apps/server/src/routes/discovery.ts:56`). It pushes an item up when it matches:

- a seller the person follows (+4)
- a category they hearted (+3)
- a brand they hearted or follow (+2)
- one of their sizes (+2)

Each point makes the item look 6 hours newer (`feedBoost` and `personalSort` in `apps/server/src/lib/discovery.ts:315` and `:333`). People can turn this off in Settings, Privacy (`personaliseFeed` in `packages/db/src/schema/people.ts:82`).

What is missing:

- **No memory.** The feed does not use opens, return visits, searches or category visits.
- **No fading.** A heart from six months ago counts the same as one from today.
- **No variety.** A page can fill with one seller or one brand.
- **No surprise.** Nothing shows the person something new on purpose.
- **Pages can repeat.** A heart in the middle of a scroll changes the order, so the next page can repeat or skip cards.

One fact shapes the whole design: every second-hand item is one of a kind and sells once. So the feed learns taste from what an item *is* (category, brand, size, price band, colour, condition, seller), not from the item itself.

## 1. The app learns from each heart, open, return visit and category visit

### 1.1 The server records what it already sees

Each server handler that exists gets one extra call to `recordEvents()`. Nothing else in the handler changes.

| Action | Where | Weight |
|---|---|---|
| Open an item | `countView`, `apps/server/src/routes/discovery.ts:221` | 1 |
| Open the same item again on another day ("comes back to often") | same | 2 |
| Heart / remove heart | `apps/server/src/routes/engagement.ts:65` / `:135` | +4 / -4 |
| Save a search | `engagement.ts:226` | 3 |
| Search | `engagement.ts:336` | 1 |
| Message a seller | `apps/server/src/routes/messages.ts:88` | 5 |
| Make an offer | `apps/server/src/routes/offers.ts` | 6 |
| Buy | `apps/server/src/routes/orders.ts` | 8 |
| Onboarding pick | new onboarding step | 3 |
| Not interested | new `POST /v1/feed/hide` | -3 |

The server copies the item's features (category, brand, size, price band, seller) into the record itself, so the app cannot fake them and the history survives when the listing is deleted.

### 1.2 The app sends what only the phone sees, in small batches

| Action | Where | Weight |
|---|---|---|
| Card seen (half visible for 1 second) | `apps/mobile/components/listing-grid.tsx:127` | 0 (only used to stop repeats and to measure) |
| Time on an item (10 seconds or more, or 3 photos swiped) | item page `listing/[id].tsx` | 1 |
| Category visit | `apps/mobile/app/(app)/(tabs)/(browse)/browse/category.tsx` | 0.5 |

The app keeps a small queue (`apps/mobile/lib/events.ts`) and sends it to `POST /v1/events`:

- every 15 seconds, or when 20 actions are waiting
- when the app goes to the background
- before sign out (`apps/mobile/lib/sign-out-hooks.ts`)

If a send fails, the app tries once more and then drops the batch. Losing a few "card seen" rows is fine. Each action carries an id, so a resent batch never counts twice. Limit: 200 actions per person per minute.

### 1.3 One file holds all the weights

`packages/shared/src/recommendations.ts`:

```ts
export const EVENT_WEIGHTS = {
  purchase: 8, offer: 6, message_seller: 5,
  favourite: 4, unfavourite: -4, save_search: 3, onboarding_pick: 3,
  listing_open_repeat: 2,
  listing_open: 1, listing_dwell: 1, search: 1,
  category_visit: 0.5,
  not_interested: -3,
  impression: 0,
} as const;
```

Changing a weight is a one line edit.

## 2. Each person has a taste profile that grows and fades

Think of it as a short summary sheet per person: how much they like Dresses, Zara, size M, items around ₪50 to ₪100.

### 2.1 One action adds score to each feature of the item

Each feature gets a share of the action's weight:

| Feature | Share |
|---|---|
| Category | 1.0 |
| Parent category (for example Women, Clothing) | 0.5 |
| Brand | 0.8 |
| Seller | 0.7 |
| Size | 0.6 |
| Price band | 0.5 |
| Each colour | 0.3 |
| Condition | 0.3 |

Example: a heart (4) on a Zara dress adds 4 to Dresses, 3.2 to Zara and 2.4 to size M.

Price bands: under ₪50, 50 to 100, 100 to 200, 200 to 400, 400 to 800, ₪800 and above.

The update happens instantly, in the same request, in one database statement:

```sql
insert into user_affinities (user_id, feature, feature_key, score, scored_at, event_count)
select $1, f.feature, f.key, f.delta, now(), 1
from unnest($2::affinity_feature[], $3::text[], $4::real[]) as f(feature, key, delta)
on conflict (user_id, feature, feature_key) do update set
  score = user_affinities.score
          * power(0.5, extract(epoch from now() - user_affinities.scored_at) / (14 * 86400))
          + excluded.score,
  scored_at = now(),
  event_count = user_affinities.event_count + 1;
```

### 2.2 A score drops to half after 14 days with no new action

Nothing runs at night to fade scores. The math happens when a score is read or updated:

```ts
export const HALF_LIFE_DAYS = 14;
export const effectiveScore = (score: number, scoredAt: Date, now = new Date()) =>
  score * 0.5 ** ((now.getTime() - scoredAt.getTime()) / (HALF_LIFE_DAYS * 86_400_000));
```

Things the person chose on purpose (sizes, followed brands, followed sellers) never fade. They stay in their own tables (`user_sizes`, `user_brands`, `follows`).

### 2.3 The feed gets more personal as the person does more

```ts
export const confidence = (totalEffectiveScore: number) => Math.min(1, totalEffectiveScore / 30);
// score = confidence * personal + general
```

A new person gets the general feed. After about 30 points of activity, their taste counts in full. This is how the feed grows with the person.

### 2.4 Later stages learn from photos and from other people

Only stage 1 is in this plan. Each later stage gets its own plan.

| Stage | What it adds | When |
|---|---|---|
| 1. Taste scores (this plan) | Everything in this file | Now |
| 2. Similar look | Each photo and title becomes a "fingerprint" (a vector, stored with pgvector, a Postgres add-on). The feed finds items that look like what the person liked. Also powers "similar items" and photo search | About 5,000 active listings, or when click rate stops improving |
| 3. People like you | "People who like brand X also like brand Y", then a model trained on what people actually clicked, replacing the hand-set weights | About 10,000 monthly users and 1 million actions a month |

## 3. The home feed mixes taste, new items, popular items and a surprise

Each card can carry a short reason, for example "You like Zara", "New in Dresses", "Popular this week" or "Something new for you".

### 3.1 Four piles give about 600 candidates, one score ranks them

| Pile | Size | Contents |
|---|---|---|
| A. Taste | 300 | Newest items in the person's top 5 categories, top 5 brands and top 3 sellers |
| B. New | 150 | Newest items from the last 7 days |
| C. Popular | 100 | Most activity this week |
| D. Explore | 50 | Random recent items from categories the person rarely visits |

Always left out: sold items, the person's own items, hidden items and sellers, blocked people, holiday sellers, closed accounts, items they already bought.

The score (in `apps/server/src/lib/feed.ts`):

```
personal = 1.0*category + 0.5*parent category + 0.8*brand + 0.6*size
         + 0.5*price band + 0.3*colour + 0.3*condition + 1.0*seller
         + 1.0*follows seller + 0.6*picked brand
           (each taste term runs from 0 to 1: the score divided by the person's best score)
general  = 0.6*freshness (fades over 48 hours)
         + 0.4*popularity
         + 0.2*price dropped + 0.3*bumped now
         + 0.2*first chance (listed under 72 hours and seen by fewer than 50 people)
score    = confidence * personal + general
         - 0.5*(shown 3 or more times in 7 days and never opened)
         + 0.1*small shuffle (same all day)
```

The card's reason is the term that added the most.

### 3.2 A page never fills with one seller, brand or category

```ts
export const VARIETY = {
  perPage: 20,
  maxPerSeller: 2,
  maxPerBrand: 4,
  maxPerCategory: 6,
  maxBumpedPerSix: 1,
  exploreSlots: [5, 12, 19],
} as const;
```

Items that do not fit move to the next page.

### 3.3 Pages do not repeat or skip items while the person scrolls

- On the first page, the server sorts up to 500 items once and saves the list for 2 hours (`feed_snapshots`).
- Later pages take the next 20 from that list. Items sold or hidden since then are dropped.
- After the 500, the feed continues newest first, as today (`queryCardRows`, `apps/server/src/lib/discovery.ts:161`).
- Pull to refresh makes a new list.

### 3.4 Chosen sizes filter items in that size group

A person with dress size M sees no XL dresses. If they chose no shoe size, all shoes stay in. Items with no size always stay in.

## 4. A new person sees a good feed on the first day

- After sign up, two short screens with a Skip button: "What do you shop for" (Women, Men, Kids) and "Your sizes".
- Sizes save through the endpoint that exists (`PUT /v1/me/personalisation/sizes`).
- Picks count as onboarding actions (weight 3), so the taste profile is not empty.
- Until the person acts, the feed is new items, popular items, variety and surprises.
- A new listing is in the "new" pile for 7 days and gets a small first chance boost for 72 hours.

## 5. The person can see why, hide items and reset the feed

- **Why you see this.** A long press on a card opens a sheet with the reason in Hebrew or English.
- **Not interested.** On the same sheet: this item, this seller, or "show less like this" (brand or category). The item disappears at once. Settings gets a list of hidden items and sellers, to undo.
- **Reset my recommendations.** A button in `settings/personalisation.tsx`. It clears the learned taste and the action history. Hearts, sizes, follows and hides stay.
- **Personalised feed switch off** (exists today). The feed uses only the general score, the server stops recording actions, and the learned taste is cleared.
- **Closing an account.** Today the user row stays and is anonymised (`apps/server/src/routes/me.ts:229`), so the database does not delete linked rows on its own. That handler must delete the new tables itself.
- **No tracking for people who are not signed in.**
- **Privacy policy** must say that in-app behaviour shapes the feed. A lawyer should check the wording before launch.

## 6. Behind the scenes: storage, indexes and upkeep

Everything stays in the Postgres database we already have. No new services for stage 1.

### 6.1 Three kinds of data

| Data | Everyday picture | Size | Upkeep |
|---|---|---|---|
| Action diary (`user_events`) | A notebook of everything that happened | The big one. Most rows are "card seen" | Kept 180 days, "card seen" rows 30 days. The oldest rows are deleted each night |
| Taste profile (`user_affinities`) | A short summary sheet per person | Small. At most 50 lines per feature per person | Updated instantly. Faded scores (below 0.05) are deleted each night |
| Ready results (`feed_snapshots`, `listing_popularity_7d`) | A shelf of sorted piles | Tiny | Feed list kept 2 hours. "Popular this week" re-counted every 15 minutes |

### 6.2 Indexes: only for the questions the feed asks often

An index is like the index at the back of a book: one kind of lookup gets fast, but every new row must also be written into it. So we add only these five:

| Index | Answers |
|---|---|
| Diary by person and date | "What did this person do recently?" |
| Diary by item and date | "Which items have the most activity?" (popular pile) |
| Diary date marker (BRIN, a very cheap index that notes which part of the table holds which dates) | "Which rows are old enough to delete?" |
| Diary unique action id per person | Stops a resent batch from counting twice |
| Taste by person, feature and score | "What are this person's top tastes?" |

The candidate piles use indexes that exist today: newest items, items by category, brand and seller (`packages/db/src/schema/listings.ts:94` to `:105`).

### 6.3 Rough sizes

- 1,000 active people doing about 50 things a day is about 9 million diary rows over 6 months. Postgres handles this easily.
- At about 20 to 50 million rows, split the diary into one part per month (partitioning). The nightly cleanup then drops a whole month at once.
- Later, move the number crunching (stage 3 training, reports) to a separate copy of the database, so it never slows the app.

### 6.4 Scheduled chores

| Chore | How often |
|---|---|
| Re-count "popular this week" | Every 15 minutes |
| Delete old diary rows and old feed lists | Nightly |
| Delete faded taste scores, keep the top 50 per feature | Nightly |

Today the server runs chores on its own timer (`apps/server/src/plugins/jobs.ts`). That timer does not run on Vercel. The order chores have the same problem. The fix for both: Vercel's scheduler (Vercel Cron) calls a protected server address at set times. This is a separate task.

### 6.5 Health numbers

Four numbers to watch:

1. Feed load time
2. Diary size
3. Feed click rate (cards opened out of cards seen)
4. Heart rate from the feed

If the click rate goes up after a change, the change worked. To compare properly, a share of people (for example 10 percent) can keep the plain "new and popular" feed for a while. Every card shown is recorded with its position and reason from day one, so stage 3 has data to learn from.

### 6.6 Testing

- Unit tests for the weights, the fading math, price bands and the variety rules.
- Sample data gets fake behaviour, for example a person who hearts many Zara dresses. A server test checks that their feed leans toward Zara dresses, and that a new person gets the general feed.

### 6.7 Not now

- A fast memory store (Redis). The saved feed list covers it.
- A separate search engine service.
- Partitioning, until the numbers above.

## 7. New tables

New file `packages/db/src/schema/recommendations.ts`. Enum lists go in `packages/shared/src/enums.ts`. `docs/blueprint/data-model.md` gets the four tables in the same commit.

```ts
export const userEvents = pgTable("user_events", {
  id: pk(),
  userId: uuid("user_id").notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  type: userEventTypeEnum("type").notNull(),
  clientEventId: uuid("client_event_id"),        // a resent batch never counts twice
  listingId: uuid("listing_id")
    .references(() => listings.id, { onDelete: "set null" }),
  // features, copied by the server
  categoryId: uuid("category_id"),
  brandId: uuid("brand_id"),
  sizeId: uuid("size_id"),
  sellerId: uuid("seller_id"),
  priceBand: smallint("price_band"),
  surface: feedSurfaceEnum("surface"),           // home, search, browse
  position: smallint("position"),
  feedId: uuid("feed_id"),
  data: jsonb("data").notNull().default(sql`'{}'::jsonb`),   // search text, time on item
  occurredAt: ts("occurred_at").notNull().defaultNow(),
});

export const userAffinities = pgTable("user_affinities", {
  userId: uuid("user_id").notNull(),
  feature: affinityFeatureEnum("feature").notNull(),
  featureKey: text("feature_key").notNull(),     // category id, brand id, "0".."5" price band
  score: real("score").notNull(),
  scoredAt: ts("scored_at").notNull().defaultNow(),
  eventCount: integer("event_count").notNull().default(0),
}); // primary key (user_id, feature, feature_key)

// user_id, scope (item, seller, brand, category), target_id
export const feedHidden = pgTable("feed_hidden", { /* … */ });
// id, user_id, category_id, listing_ids uuid[], reasons, created_at
export const feedSnapshots = pgTable("feed_snapshots", { /* … */ });
```

Plus a materialized view (a saved query result the database re-counts on request) for "popular this week":

```sql
create materialized view listing_popularity_7d as
select listing_id,
       count(*) filter (where type = 'listing_open')
     + 4 * count(*) filter (where type = 'favourite')
     + 6 * count(*) filter (where type = 'message_seller') as pop
from user_events
where occurred_at > now() - interval '7 days' and listing_id is not null
group by listing_id;
```

## 8. Files

**New (14)**

- `packages/db/src/schema/recommendations.ts`
- `packages/db/drizzle/0004_*.sql` (generated, plus the popularity view by hand)
- `packages/shared/src/events.ts` (action batch and hide schemas)
- `packages/shared/src/recommendations.ts` (weights, fading, price bands, variety, with tests)
- `apps/server/src/lib/events.ts` (`recordEvents()`)
- `apps/server/src/lib/feed.ts` (piles, score, variety, saved lists. `feedBoost` and `personalSort` move here)
- `apps/server/src/lib/feed-jobs.ts` (nightly cleanup, popularity re-count)
- `apps/server/src/routes/events.ts` (`POST /v1/events`, `POST /v1/feed/hide`, `DELETE /v1/me/personalisation`)
- `apps/server/src/routes/events.test.ts`, `apps/server/src/lib/feed.test.ts`
- `apps/mobile/lib/events.ts` (the queue)
- `apps/mobile/lib/use-impressions.ts`
- `apps/mobile/components/feed-reason-sheet.tsx`
- Onboarding screen (two steps)

**Changed (25)**

- Database and shared: `packages/db/src/schema/index.ts`, `packages/shared/src/enums.ts`, `packages/shared/src/discovery.ts` (`reason` on cards, `feedId` on the page), `packages/shared/src/index.ts`
- Server: `apps/server/src/app.ts`, `routes/discovery.ts`, `routes/engagement.ts`, `routes/messages.ts`, `routes/offers.ts`, `routes/orders.ts`, `routes/me.ts`, `lib/discovery.ts`, `plugins/jobs.ts`
- App: `components/listing-grid.tsx`, `components/listing-card.tsx`, `lib/discovery-queries.ts`, `lib/sign-out-hooks.ts`, item page `listing/[id].tsx`, `browse/category.tsx`, `settings/personalisation.tsx`, `i18n/locales/en.json`, `i18n/locales/he.json`
- Docs: `docs/blueprint/data-model.md`, `docs/blueprint/api.md`, `docs/roadmap.md` (a new Recommendations milestone)

## 9. Decisions for Eden

The first option in each is the recommendation.

1. **How fast does old taste fade?**
   - **Half in 14 days** (taste of the last 2 to 4 weeks)
   - Half in 7 days (follows a new style within a week)
   - Half in 30 days (steady, slow to change)
2. **How much surprise on each page?**
   - **3 cards in 20** (about 15 percent)
   - 1 in 20 (more of the same)
   - 5 in 20 (more discovery, less precise)
3. **Do chosen sizes hide other sizes?**
   - **Yes, only in that size group**
   - No, they only push matches up (as today)
4. **Two short questions after sign up?**
   - **Yes, with a Skip button**
   - No, show new and popular items until the person acts
5. **How long do we keep raw actions?**
   - **180 days** ("card seen" rows 30 days)
   - 90 days (less data, weaker later stages)
   - 1 year

## 10. Not changing

- Search results keep their own order.
- The Trending chip keeps "hearts times 5 plus views".
- "Similar items" on the item page keeps its rules until stage 2.
- People who are not signed in get the general feed, with no tracking.
- Stages 2 and 3 are not built in this plan.
- The Vercel scheduler fix is a separate task.

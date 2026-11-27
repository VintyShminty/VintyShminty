# Plan: a home feed that learns

Status: built (server and app, Milestone 7, branch `milestone-7`). Decided by Eden on 2026-10-13. App decisions are in D-022 of `docs/design.md`. Section 11 (shopping groups and personal search) was decided by Eden on 2026-10-16 and merged the same day (#106, D-048).

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
| Category visit | `apps/mobile/app/(app)/(tabs)/(shop)/browse/category.tsx` | 0.5 |

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

### 2.2 A score drops to half after 30 days with no new action

Nothing runs at night to fade scores. The math happens when a score is read or updated:

```ts
export const HALF_LIFE_DAYS = 30; // Eden chose 7 on 2026-10-13 (section 9) and 30 on 2026-11-18 (section 14)
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
         - 0.5*(shown 3 or more times in 7 days and never opened)   (gradual since section 15)
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

Decided by Eden on 2026-10-13 (the chosen option is marked **Chosen**). These override any default written elsewhere in this plan.

1. **How fast does old taste fade?**
   - Half in 14 days (taste of the last 2 to 4 weeks)
   - **Chosen: half in 7 days** (follows a new style within a week). Changed to half in 30 days on 2026-11-18 after a look at real use, see section 14
   - Half in 30 days (steady, slow to change)
2. **How much surprise on each page?**
   - **Chosen: 3 cards in 20** (about 15 percent)
   - 1 in 20 (more of the same)
   - 5 in 20 (more discovery, less precise)
3. **Do chosen sizes hide other sizes?**
   - Yes, only in that size group
   - **Chosen: no, they only push matches up (as today).** Section 3.4 does not apply
4. **Two short questions after sign up?**
   - **Chosen: yes, with a Skip button**
   - No, show new and popular items until the person acts
5. **How long do we keep raw actions?**
   - **Chosen: 180 days** ("card seen" rows 30 days)
   - 90 days (less data, weaker later stages)
   - 1 year

## 10. Not changing

- Search results keep their own order. Changed by section 11: the default search order becomes personal.
- The Trending chip keeps "hearts times 5 plus views".
- "Similar items" on the item page keeps its rules until stage 2.
- People who are not signed in get the general feed, with no tracking.
- Stages 2 and 3 are not built in this plan.
- The Vercel scheduler fix is a separate task.

## 11. Shopping groups and personal search (decided and merged 2026-10-16, #106)

### Why

> as a man, i'm not too interested in women clothing [...] unless i was knowingly searching for it and giving likes. [...] it's still around the category i was looking.
> (Eden)

A "shopping group" is Women, Men or Kids, the top of the category tree. Today three things work against Eden's wish:

- **The "What do you shop for?" answer fades.** It is saved as an onboarding action (weight 3), so after a few weeks Home has mostly forgotten it (half in 7 days, section 2.2).
- **Surprise cards come from what the person never visits.** For a man that is mostly women's items (pile D, section 3.1).
- **One heart outside your groups teaches the whole group.** A heart on women's cycling clothes adds half its weight to "Women" (parent category share 0.5, section 2.1), which is how dresses start to appear.

### 11.1 Your groups are a lasting setting

- The answer to "What do you shop for?" is stored as a setting (Women, Men, Kids, several allowed) and never fades. Settings, Shopping preferences shows it and lets the person change it, on the app and the website.
- Skipped or never answered: the groups are worked out from behaviour, a group counts when it holds at least 60 percent of the person's learned category taste (starting value). Until then nothing is lowered.
- Never guessed from a name, photo or anything else in the profile.

### 11.2 Other groups move a bit lower, never hidden

- Items in a group the person does not shop for get a small minus in the Home score: **a bit lower** (Eden, 2026-10-16). Starting value: -0.3 on a score where a strong taste match is about 1 (1 since section 18.2). It lives with the other weights in `packages/shared/src/recommendations.ts`.
- Nothing is filtered out. While stock is small (today it is mostly women's items) a man still sees a full Home: the few men's items first, then the rest.
- Items with no group (a category outside Women, Men and Kids) are never lowered.
- Surprise cards (pile D) are picked only inside the person's groups. When those have too few recent items, the surprise slots fall back to the whole site.

### 11.3 Interest outside your groups opens only that corner

- An action on an item outside the person's groups teaches the item's own category and the one directly above it (for example Women, Sports, Cycling), and nothing higher. The share for the group itself (Women) is 0 for that action.
- In that corner the minus of 11.2 does not apply while its taste score is above a small threshold. So hearting women's cycling clothes brings more women's cycling clothes, never dresses.
- The corner fades at the normal speed (Eden, 2026-10-16). That was half in 7 days then and is half in 30 days since section 14. Coming back keeps it open. Since section 19 a corner fades to half in 7 days again and also shrinks when the person looks at their own groups.
- This needs an answer to "What do you shop for?". Without one, every action teaches as before, which is how the groups are worked out from behaviour.

### 11.4 Search order becomes personal

Eden decided on 2026-10-16 that search should know the person: their groups, their taste profile and the sizes they set.

- Applies only to the default order (relevance). When the person picks Cheapest, Newest or another sort, the results follow it exactly.
- The text match still comes first: an item that matches the words better stays above one that only matches the person better. Inside items that match about as well, the personal score decides: own groups above other groups, then taste (category, brand, style, seller), then items in one of the person's set sizes.
- Sizes only push up, never hide (D-022 plan decision 3). With shoe size 43 set, a 43 sits above a 44 that matches as well, and the 44 still shows. A size group with no size set changes nothing.
- Signed out visitors and people with "Tailor Home to what I do" off get the same order as today.
- Search actions keep teaching the taste profile as they do now (section 1.1).

### 11.5 Testing

- Sample data: a person who shops for Men and once hearted women's cycling clothes. Server tests check that Home puts men's items first, still fills the page with women's items when men's run out, lifts women's cycling items and not women's dresses.
- Search test: the same person searching "shoes" sees men's shoes in their size first and women's shoes further down, all present. With Cheapest picked the order is by price only.

### 11.6 Files (expected)

- `packages/shared/src/recommendations.ts`: the group minus, the corner threshold, the group share rule.
- `packages/db`: a "shops for" column on the person's settings (and `docs/blueprint/data-model.md` in the same commit).
- `apps/server/src/lib/feed.ts`: the minus, the corner rule, surprise cards inside the groups.
- `apps/server/src/lib/events.ts`: the group share rule when recording an action.
- `apps/server/src/lib/discovery.ts`: the personal tiebreak in `sortSpec` for the default search order.
- `apps/server/src/routes/events.ts`: save the onboarding answer as the setting.
- App and website Settings, Shopping preferences: the groups row.


## 12. New listings keep a place, opened items step back (2026-11-18)

### Why

An audit of the live feed on 2026-11-18 measured Home on the sample data for a person with a strong taste:

- **New listings barely showed.** Being new is worth at most 0.8 in the score (freshness plus first chance, section 3.1) and a taste match up to about 7. A brand new dress in her best category and best brand landed at position 22. 12 of her first 20 cards were older than a week.
- **Home was the same on every visit.** Two visits gave the same 20 cards in the same places. The cards she opened stayed at positions 1 to 5, because an open teaches "more like this", and the opened item is the closest match to itself.

Visitors and new members were fine: new listings already lead their Home.

### 12.1 Four cards in twenty are kept for new listings

- Each page of 20 keeps up to 4 spots (cards 2, 7, 12 and 17) for listings published in the last 72 hours (7 days since section 16). `VARIETY.freshSlots` and `FRESH_SLOT_HOURS` in `packages/shared/src/recommendations.ts`.
- A spot takes the best scoring new listing that is left, so the new listings closest to the person's taste come first. The score itself does not change. With no matching new listing, no spot is used and the page is as it was before.
- A new listing cannot take a spot when it was lowered for this person: another shopping group (section 11.2), already opened (12.2), or shown three times and never opened (section 3.1).
- **Only a real match takes a spot** (Eden, 2026-11-18: "we dont need to forcefully push many new listings, but new ones should still take a decent place - smartly"). The new listing must be in a category the person looks at or the one directly above it (a maxi dress for someone who looks at midi dresses), from a brand they like or picked, or from a seller they like or follow. Being in the person's shopping group is not enough, and neither is a matching size. A new bag does not take a spot on the Home of someone who only looks at dresses.
- A visitor and a person the feed knows nothing about have no taste to match, so every new listing can take a spot. New listings already lead their Home through the general score.
- The variety rules still apply. One seller gets at most 2 cards on a page, new or not.
- The card's reason is "New in Dresses" (the wording that exists), whatever else it matches.

### 12.2 An item opened this week counts for half

- An item the person opened in the last 7 days keeps half of its taste score on Home (`OPENED_KEEP`). The general part (freshness, popularity) stays.
- What the open taught the taste profile stays in full: similar items still rise, only the opened item steps back.
- After 7 days without opening it again the item returns to its normal place.
- Hearted items are in Favourites. Nothing else changes for them.

### 12.3 Measured after the change (sample data, same person)

Position on Home, 1 is the top. She looks at midi and mini dresses and at Zara.

| | Before | After |
|---|---|---|
| New Zara midi dress (her category and brand), day 1 / day 2 / day 3 | 22 / 22 / 41 | 1 / 1 / 2 |
| New maxi dress of another brand (next to her categories), day 1 / day 2 / day 3 | 33 / 53 / 73 | 12 / 17 / 17 |
| New women's sneaker (her shopping group only), day 1 / day 2 / day 3 | 20 / 40 / 60 | 20 / 40 / 60 (no spot, on purpose) |
| The 5 cards she opened, next visit | 1 to 5 | 25 to 64 |
| Of her first 20 cards, still there on the next visit | 19 | 12 |

Her first page after the change: 16 cards from her taste and the surprise cards, 3 new listings that match her.

### 12.4 Not changed

- The weight of freshness in the score, the surprise cards and the "shown three times" rule.
- One seller listing many items at once still shows 2 per page (audit finding 3).
- The two seller loopholes (audit finding 4) are closed in section 13.
- The website builds a new list for every visit (audit finding 5).

## 13. Two loopholes closed (2026-11-18)

The audit found two ways a seller could lift an item without earning it. Measured on the sample data for a visitor, before the change:

- Lowering the price by 1 shekel moved an old item from position 51 to 20, and the lift never ended.
- One person hearting and unhearting the same item 10 times made it the most popular item in the shop and moved it from 68 to 11.

### 13.1 A price drop has to be real and recent

- The "price dropped" lift (0.2, section 3.1) counts for **7 days** after the price went down (`PRICE_DROP_DAYS`).
- The new price has to be **at least 10 percent below the lowest price the item had in the last 30 days** (`PRICE_DROP_MIN_SHARE`, `PRICE_DROP_LOOKBACK_DAYS`). It is compared with the lowest price, not the last one, so raising the price and lowering it again earns nothing.
- The feed reads this from `listing_price_history`, which every price change of a live listing already writes. `countsAsPriceDrop` in `packages/shared/src/recommendations.ts`.
- The Price drop badge on the card does not change. It still shows whenever the price is lower than before.

### 13.2 Each person counts once in "popular this week"

- The count behind the popular pile (`listing_popularity_7d`) now counts each person once per item for opens, once for a heart and once for a message to the seller. Before, every heart counted, also the tenth by the same person.
- This is a change to a saved count in the database (migration `0016`). The saved count holds no data of its own and is re-counted from the action diary. It has to be applied to the live database before this is merged (`pnpm db:migrate:online`).
- A heart that was removed again still counts once for 7 days. One person, one time: not worth more rules.

## 14. Taste fades to half in 30 days, not 7 (2026-11-18)

### Why

A read-only look at the live database on 2026-11-18 (totals only) showed how people really use the app five weeks after the feed went live:

- 23 accounts, 16 with any recorded action, 4 active in the last 7 days.
- On a day someone is active they earn about 11 points (the middle value). Home is fully personal at 30 (section 2.3).
- The typical person was active on 2 days in 5 weeks.
- So with "half in 7 days" Home had mostly forgotten a person by the time they came back. Nobody on live was even half personal. The strongest person stood at 46 percent.

### 14.1 The options, rebuilt from what those 16 people actually did

| Fades to half in | Fully personal | Half or more | A little | Almost nothing |
|---|---|---|---|---|
| 7 days (until now) | 0 | 0 | 4 | 12 |
| 14 days | 2 | 2 | 2 | 10 |
| **30 days (chosen by Eden)** | **3** | **3** | **2** | **8** |
| 60 days | 5 | 2 | 2 | 7 |

Rebuilding the 7 day row this way gives the same picture as what live had stored, so the method holds. Live has only five weeks of history, so 60 days cannot yet be told apart from never forgetting.

### 14.2 What changes

- `HALF_LIFE_DAYS` in `packages/shared/src/recommendations.ts` goes from 7 to 30. Nothing else.
- A new interest still counts in full at once. What changes is how long an old one stays: something a person stopped looking at still counts half a month later.
- The points needed for a fully personal Home stay at 30 (`CONFIDENCE_POINTS`). At 15, one visit would make Home about 70 percent personal, which is trusting thin evidence.
- The corner outside a person's shopping groups (section 11.3) uses the same number, so it also stays open longer.
- No database step and no rebuild. A score is stored as it was on its last action and the fading is worked out when it is read (section 2.2), so stored taste is read with the new number from the first request. Read that way, live shows 2 people fully personal and 4 at half or more.
- The nightly cleanup deletes fewer lines, because a line now takes longer to fade below 0.05.

## 15. Cards you scroll past move down gradually (2026-11-18)

### Why

Until now a card shown on Home and never opened did nothing for two views and lost a fixed 0.5 on the third. Measured on the sample data, a person who opens Home again and again and opens nothing saw this:

| Same cards as on the visit before, out of the first 20 | Visit 2 | 3 | 4 | 5 | 6 |
|---|---|---|---|---|---|
| Active member, old rule | 20 | 20 | 5 | 20 | 20 |
| Member Home knows little about, old rule | 20 | 20 | 2 | 20 | 20 |

Two visits with exactly the same page, then nearly the whole page swapped at once, then the same again. On the live site this rule has real material: in the week before 2026-11-18 a person was shown the same card three or more times without opening it 18 times.

### 15.1 The rule

A card shown on Home in the last 7 days and never opened moves down a little more with every view:

- It loses 0.05 per view outright, up to 0.5 after ten views (`SEEN_PENALTY`, `SEEN_PENALTY_VIEWS`). This is what moves a card for a person Home knows little about, where most scores are close together.
- Its taste score counts 95 percent of what it did, per view, and never less than 40 percent (`SEEN_KEEP_PER_VIEW`, `SEEN_KEEP_MIN`). This is what moves a strong taste match, where a fixed 0.05 would be nothing.
- An opened card follows the opened rule instead (section 12.2).
- A new listing still gives up its kept spot after three views without an open (`FRESH_SLOT_MAX_VIEWS`, section 12.1).
- It wears off as before: only the views of the last 7 days count.

The steps are small on purpose. A card counts as shown when it is half visible for a second, so the first cards of Home are "shown" every time the app opens, also when the person went straight to their messages.

### 15.2 Measured after the change

Same test, same people. The second number is how many of the five best cards of the first visit are still on the page.

| Same cards as on the visit before, out of the first 20 | Visit 2 | 3 | 4 | 5 | 6 |
|---|---|---|---|---|---|
| Active member | 14, 4 of 5 | 12, 3 of 5 | 10, 3 of 5 | 9, 1 of 5 | 7, 3 of 5 |
| Member Home knows little about | 13, 4 of 5 | 14, 5 of 5 | 12, 5 of 5 | 10, 3 of 5 | 13, 4 of 5 |

About a third of the page is new on the next visit, more when the person keeps ignoring it, and the best matches stay longest.

Also tried and not chosen:

- A bigger drop on the third view (taste halved plus 0.5): the same two identical visits, then 19 of 20 cards swapped.
- Bigger steps (taste keeps 85 percent per view, 0.5 after three views): 12 to 16 of the 20 cards change on every visit, which is restless.

## 16. A listing counts as new for 7 days, not 3 (2026-11-18)

### Why

The spots kept for new listings (section 12.1) covered the last 72 hours. The live shop on 2026-11-18 had 4 new listings in the last 7 days and none in the last 3, so the spots had nothing to show. Eden chose 7 days.

### 16.1 What changes

- `FRESH_SLOT_HOURS` goes from 72 to 7 days. Nothing else: still up to 4 spots in 20, still only for a real match (section 12.1), still given up after three views without an open (section 15.1).
- The "new" pile already reaches back 7 days (`NEW_PILE_DAYS`), so every listing of the window is a candidate.
- The freshness and first chance parts of the score (section 3.1) keep their 48 and 72 hours.

### 16.2 Measured (sample data, the person who looks at Zara and midi dresses)

| Position on Home | Day 1 | Day 2 | Day 3 | Day 5 | Day 7 | Day 8 |
|---|---|---|---|---|---|---|
| New Zara midi dress, 3 day window | 1 | 2 | 22 | 22 | 22 | 22 |
| New Zara midi dress, 7 day window | 1 | 2 | 2 | 2 | 2 | 23 |
| New maxi dress of another brand, 3 day window | 17 | 17 | 76 | 76 | 76 | 76 |
| New maxi dress of another brand, 7 day window | 37 | 37 | 47 | 47 | 47 | 78 |

- The best match keeps its place for the whole week instead of three days.
- The weaker match does worse in its first days. The sample shop has about 20 listings a week, so a longer window means more new listings compete for the same 4 spots, and the best fit goes first.
- On live that competition does not exist yet (4 new listings a week). When listings arrive every day, the window should come down again.

## 17. Home learns from searches and offers a bit of what was searched (2026-11-18)

### Why

> if a person searches for nike sneakers - then the algorithm should learn that to some extent, the user was interested in nike sneakers, and if such exists - we should offer him a bit of that.
> (Eden)

Eden also decided against a question on Home for people who skipped "What do you shop for": Home has to learn from what they do. Most of that worked already (opens, time on an item, hearts, messages, the shopping group worked out from behaviour, section 11.1). Searching did not:

- A search taught Home something only when the person also picked a category or exactly one brand. The words taught nothing. All 7 searches recorded on live by 2026-11-18 were words only.
- The website never reported a search.
- One search is a small signal. Even when learned, it changed nothing a person could see on Home.

### 17.1 What a search was about

When a search by words is recorded (`POST /v1/me/recent-searches` and saved searches), the server reads its 20 best results (`searchAbout` in `apps/server/src/lib/search-intent.ts`, `searchIntent` in `packages/shared/src/recommendations.ts`):

- **Brand:** the brand at least 60 percent of them share.
- **Category:** the deepest category at least 80 percent of them are in. "nike sneakers" gives Sneakers, "shoes" gives Shoes. The bar is higher than for the brand, so "adidas", which finds mostly clothing and some shoes, is about Adidas and not about Adidas clothing.
- **The same kind of item in several groups:** sneakers for women, men and kids are three categories in our tree. When no single one wins, they count together, and the search is about each of them (up to three).
- **The person's own groups first:** when Home knows the person's shopping groups, the results inside those groups are read first. For a man, "sneakers" is about men's sneakers.
- A category or a single brand the person picked wins over what the results say.
- No results, or a bit of everything, is about nothing in particular. Nothing is learned and nothing is offered.

It reads results, not the meaning of words, so Hebrew and English work the same. The action is written to the diary with the category and brand, one row per category, and teaches the taste profile as a search always did (weight 1, section 1.1).

### 17.2 Up to 2 cards in 20 for what was searched

- For 7 days after a search (`SEARCH_SLOT_DAYS`), each page of 20 keeps up to 2 spots (cards 4 and 10, `VARIETY.searchSlots`) for items that match it: the brand and the category when the search had both, otherwise the one it had. Home looks at the person's 6 latest searches.
- A spot takes the best scoring matching item that is left. The score itself does not change.
- An item already opened, or shown three times and never opened, does not take a spot (sections 12.2 and 15.1), so the spot moves on to the next match.
- The newest 60 matching items join the candidates, so there is something to show also when the person's taste is elsewhere.
- A search about a whole top category and no brand (all of Women) is too wide and gets no spots.
- With nothing matching, no spot is used and the page is as it was.
- People who are not signed in, and people with "Tailor Home to what I do" off, are not affected.

The card's reason on the long press sheet is "You like Nike" or "You look at Sneakers a lot" (the wording that exists). A sentence of its own ("You searched for Nike") needs a new kind of reason. App versions that do not know a kind refuse the whole Home answer, so that waits until an app update has reached people.

### 17.3 The website reports searches

`SearchVisit` on the website's search page sends the same `POST /v1/me/recent-searches` as the app, for a logged in person, once per search. Website searches now also show in the app's recent searches.

### 17.4 Measured (sample data)

Matching cards among the first 20 on Home, before and after one search:

| Search | By | Understood as | Before | After |
|---|---|---|---|---|
| "vans sneakers" | a man who has done nothing else | men's sneakers, Vans | 2 (cards 1, 17) | 2 (cards 1, 3), the shop has 2 for men |
| "sneakers" | the same man | men's sneakers | 4 (cards 1, 3, 10, 12) | 4 (cards 1, 3, 4, 10) |
| "sneakers" | someone Home knows nothing about | sneakers for men and women | 1 | 4 (cards 2, 4, 10, 20) |
| "adidas" | someone Home knows nothing about | Adidas | 0 | 3 (cards 4, 10, 17) |
| "adidas" | the active member (Zara, dresses) | Adidas | 0 | 2 (cards 4, 10) |
| "blazer" | the same active member | women's blazers | 1 (card 10) | 2 (cards 4, 10) |

The effect is clearest where it matters: a person whose Home was led by something else now sees two cards of what they just searched for.

## 18. Your own group leads Home (2026-11-27)

### Why

> how does it make sense that still my homepage first shows women clothing? [...] now i changed it to men - and i refreshed and home page didn't change much
> (Eden)

The live shop had 20 men's items and 177 women's out of 287 (public catalog, 2026-11-27). Reproduced on the sample data with a man whose history is mostly women's items (3 hearts and 20 opens on women's items, 2 opens on men's, 8 visits to Home, every men's item scrolled past 10 times): 20 women's cards out of the first 20, and after choosing Men still 17 women's and 0 men's. Three things caused it:

- **Choosing Men brought nothing in.** The answer only lowered the other groups. An older men's item nobody looked at lately was in none of the piles of section 3.1, so it was never considered.
- **The minus was too small.** 0.3, against 0.2 for a price drop, up to 0.4 for a popular week and up to 0.5 lost by a card of the person's own group they scrolled past (section 15).
- **Taste learned before the answer counted as corners.** Every women's category the person had tapped while unanswered was exempt from the minus (section 11.3), and "Women" itself was learned as a liked parent category.

### 18.1 The person's own groups always come along

A fifth pile: the newest 200 items of the person's own shopping groups, whatever their age (`PILES.group`). Only for a person whose groups are known (answered or worked out). The score does not change, the items are just there to be ranked.

### 18.2 Other groups move 1 lower, not 0.3

`OTHER_GROUP_MINUS` is 1. Still never hidden, items with no group are still never lowered, and a corner the person opened is still exempt. Search has its own points (section 11.4) and did not change. The Shopping preferences note still says "a little lower", the wording did not change.

### 18.3 A first answer forgets the other groups' category taste

- When the answer goes from nothing to something (the question after sign up, or the first pick in Shopping preferences), the taste lines for categories of the groups that were not picked are deleted, the groups' own lines included (`forgetOtherGroups`). Brands, sellers, sizes, colours, price and style stay.
- Only a first answer does this. The settings screens save on every tap, so changing an answer never deletes anything: a group that was dropped fades at the normal speed.
- A corner opened after answering is learned and kept as before (section 11.3).
- Someone who answered before this change keeps their old lines. Clearing the answer and picking it again runs it for them.

### 18.4 Measured (sample data, the man above, after he chooses Men)

The sample shop has 29 men's items, 70 women's and 51 in no group or in Kids.

| First 20 cards on Home | Before | After |
|---|---|---|
| Every men's item scrolled past 10 times | 0 men's, 17 women's, 3 other | 4 men's, 0 women's, 16 other |
| Every men's item scrolled past 3 times | | 5 men's, 0 women's, 15 other |
| Men's items not seen before | | 17 men's, 0 women's, 3 other |

The table sets "scrolled past" by hand. Visiting Home again and again after choosing Men, with every card of the first 20 counted as seen each time and none of the men's items seen before, gives this (men's cards in the first 20, never a women's card):

| Visit | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
|---|---|---|---|---|---|---|---|---|
| Opens nothing | 15 | 11 | 14 | 13 | 13 | 12 | 12 | 14 |
| Opens 3 men's items on visit 2 | 13 | 11 | 19 | 20 | 16 | 14 | 12 | 13 |

The live shop cannot reach these numbers yet: one seller gets 2 cards in 20 and its 20 men's items come from 6 sellers, so about 11 of the first 20.

In the first 50 cards after the change: all 29 men's items and 2 or 3 women's, in each of the three cases. With the minus left at 0.3 and the other two changes, the worst case had 14 men's and 17 women's in the first 50, which is why the minus went up too.

### 18.5 Not changed, and one thing to know

- Items with no group (books, home, electronics) are not lowered, by section 11.2. A person who has scrolled past all of their group's items and has no taste yet for any of them sees those no-group items next, with their group's items between them, and the other groups after that. Opening or saving an item of their group lifts that kind again.
- The variety rules: one seller still gets 2 cards in 20.
- Groups worked out from behaviour (no answer) delete nothing.

## 19. Interest outside your groups breathes (2026-11-27)

### Why

> in vinted for example - i can start seeing women clothing after knowingly looking for them, not before and then i can continue looking for men stuff and women will drift away and will only come back if again im knowingly searching for them, its a constant breathing change
> (Eden)

Arriving already worked (section 11.3). Leaving did not: a corner faded by the calendar only, half in 30 days since section 14, whatever the person did in between. Measured on the sample data, a man who hearted one women's item and opened three kept that kind at card 1 of Home through 18 opens of men's items.

### 19.1 The rule

For a person who answered "What do you shop for?", the taste lines for categories outside their groups:

- **fade to half in 7 days**, not 30 (`CORNER_HALF_LIFE_DAYS`). Their own groups, brands, sellers, sizes and the rest keep 30 days, so Home still knows them after a break.
- **shrink when they look at their own groups.** Every point of a liking action on something in their own groups (an open is 1, a heart 4, a search 1) leaves those lines 90 percent of what they were (`CORNER_KEEP_PER_POINT`). Ten opens leave about a third.
- **come straight back** when the person looks at that kind again: the action adds its points as always.

Without an answer nothing is a corner and nothing changes. Search order uses the same taste, so it follows.

### 19.2 Measured (sample data, a man who shops for Men and has opened 8 men's items)

Where the 5 items of one women's category sit on Home (card numbers, first 50). "Gone" means none in the first 20.

| | Before | After |
|---|---|---|
| He hearts one and opens three | cards 1, 2, 3, 23, 29 | cards 1, 2, 3, 23, 25 |
| then opens 6 men's items | 1, 3, 4, 14, 30 | 2, 4, 21, 27, 32 |
| then 12 men's items | 1, 5, 21, 25, 31 | gone (21, 43) |
| then 18 men's items | 1, 3, 4, 27, 30 | one card left (a brand he hearted) |
| A single open instead | cards 25 to 36 | cards 25 to 36 |
| then opens 6 men's items | 16, 23, 36 | gone, none in the first 50 |

### 19.3 Not changed

- What opens a corner and how big it has to be to count (`CORNER_MIN`). A person with a lot of taste in their own group needs more than one open for a corner to reach the first cards. A search still gets its 2 cards in 20 for a week (section 17).
- Other groups stay on Home, lower down, never hidden (section 11.2).
- The nightly cleanup still uses 30 days to decide when a line is small enough to delete. A corner line is read at its quick speed, so it only lives a little longer in storage than it counts.

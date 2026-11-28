# Product and data decisions

Split from `docs/knowledge/decisions.md` on 2026-11-28. Same rules: an index only, the full text lives where the link points. Real homes: `docs/blueprint/data-model.md` (section "Open decisions"), `docs/roadmap.md` and the plans in `docs/plans/`.

| Decision | Date | Status |
|---|---|---|
| Israel only, ILS only | 2026-10-12 | Decided (item 1 closed) |
| Buyer fee 5 percent, no fixed part (placeholder to revisit) | 2026-10-12 | Decided (item 2 closed) |
| Referral reward 50 shekels | 2026-10-12 | Decided (item 3 closed) |
| Hebrew search quality | 2026-10-12 | Deferred (item 4 open) |
| Offer and order timings, 15 offers per buyer per day | 2026-10-12 | Decided (items 9, 10 closed except offer presets) |
| Checkout and shipping are simulated in version 1 | 2026-10-12 | Decided, see roadmap |
| Version 1 covers the whole spec except real payments and shipping. Hebrew and English at launch | 2026-10-12 | Decided, see roadmap |
| Password reset, email confirmation and email change use 6 digit codes, not links | 2026-10-12 | Decided, `docs/blueprint/api.md` |
| Boosts and bumps are free in version 1 | 2026-10-12 | Decided, see roadmap |
| Offers belong to Milestone 5 because accepting leads to checkout | 2026-10-13 | Decided, see roadmap |
| Home feed: taste fades by half in 30 days (7 until 2026-11-18, plan section 14), 3 surprise cards in 20, sizes only push matches up, activity kept 180 days. Since D-066 interest outside a person's own shopping groups fades by half in 7 days and shrinks with each look at their own groups | 2026-10-13, updated 2026-11-27 | Decided, `docs/plans/home-feed.md` sections 14, 18, 19 |
| Going online is Milestone 8, Extras move to 9 | 2026-10-13 | Decided, see roadmap |
| Hosting: Vercel (Hobby for private testing, Pro before real users), Neon Postgres and Upstash Redis, all in Frankfurt. Photos on Cloudflare R2 | 2026-10-13 | Decided, see roadmap and `docs/going-online.md` |
| Emails go to the server log (`MAIL_TRANSPORT=log`) until Resend and a domain exist | 2026-10-13 | Decided, temporary |
| App ID `com.secondhand.marketplace`, Apple Team ID `DTT66N8N3D`, neutral on purpose | 2026-10-13 | Decided (Eden), see roadmap |
| Working name on the App Store and home screen: Shminty, changeable. Text inside the app still says Vinty | 2026-10-13 | Superseded: the app has said Basta since 2026-11-17 (D-060). Eden renames the App Store Connect and Play Console listings |
| Google login lives in its own Google Cloud project (vintyshminty@gmail.com), testing mode with named test users | 2026-10-13 | Decided (Eden) |
| An account with an unconfirmed email is never linked to Google or Apple automatically | 2026-10-13 | Kept on purpose (safety), D-023 |
| Milestone 9 defaults: Buzz free with no daily cap, invite reward 50 shekels each, away mode at most 90 days ahead | 2026-10-14 | Decided (Claude defaults, Eden did not change), `docs/blueprint/api.md`, D-024, D-025 |
| Claude Haiku 5.5 powers every AI feature (60 listing test against Luna, GPT-5 nano, Jev) | 2026-10-14 | Decided (Eden), `docs/unfinished-work.md` |
| AI features in: plain word search, Home style tags, photo check, chat quick replies and warnings, listing checks, report sorting, help answers, order problem summaries. Parked: translating listings. Out: AI-written descriptions | 2026-10-14 | Decided (Eden), `docs/unfinished-work.md` |
| The AI never moves money, changes an order or bans anyone. It suggests and warns, a person or fixed rules decide. Automatic text is labelled. Chat reading is stated in the privacy policy | 2026-10-14 | Decided (Eden), privacy policy "AI helpers" section approved for now, lawyer check later |
| A flagged listing stays live until Eden decides. A reserved listing cannot be hidden mid order. A listing the team hid stays hidden for the seller | 2026-10-14 | Decided, D-038 |
| Browse tile photos ship inside the app, not online | 2026-10-14 | Decided (Eden) |
| Speed: remember the last feed, card photo copies with colour blur, no splash wait for logged in users | 2026-10-14 | Decided (Eden), done (#41, #42) |
| Fonts stay as they are after comparing four alternatives | 2026-10-14 | Decided (Eden and partner) |
| No "heart" wording anywhere | 2026-10-14 | Decided (Eden), #52. The word Favourites itself became Saved on 2026-10-17 (see below) |
| Category tree overlaps (running shoes, backpacks, designer bags sit in two places) | 2026-10-14 | Open, first check whether #45 already fixed them, `docs/unfinished-work.md` |
| Should sellers be told when Eden hides or removes their listing? | 2026-10-14 | Open, default not yet |
| Filter buttons on other website pages get the Home pill look? Sell, Sign up and Log in stay soft cornered? | 2026-10-15 | Open, defaults yes and no (log 2026-10-15) |
| The paid boost is "Boost" ("Boost this listing", badge "Boosted"), Hebrew "להקפיץ את המודעה" (badge "מוקפצת"). Replaces the Buzz placeholder. Code names stay buzz and bump | 2026-10-15 | Decided (Eden), `docs/originality.md` row 7, #94 |
| App name "Yadii", Hebrew spelling "יאדי" as lead candidate. A trademark lawyer checks the Yad2 question first | 2026-10-15 | Superseded by Basta (D-060) on 2026-11-17 |
| Expenses: yearly costs spread over 12 months, one time costs in their month, "Paid by" is free text with suggestions | 2026-10-15 | Decided (Eden), `docs/blueprint/data-model.md` (`expense_items`), #85 |
| Address and city suggestions go through our server (one secret key, Israel only, signed in only, 300 an hour each) | 2026-10-15 | Decided, `docs/blueprint/api.md`, #86 |
| The offer button reads "Send your offer", Hebrew "תשלח/י הצעה" | 2026-10-15 | Decided (Eden), #84 |
| Admin batch upload: on the phone you tap photos then "Make item". The website keeps one drop is one item. The stand-in username is created on the spot per batch | 2026-10-15 | Decided (Eden), #88, #91 |
| Builds are iPhone only, no iPad. Apple's reviewer gets a normal account, never an admin | 2026-10-15 | Decided (Eden), log 2026-10-15 |
| Items 5 to 8, 11 to 19 (photo search, saved searches, brands, disputes, withdrawals, account deletion, seed passwords and more) | | Open, see data model |
| Over the air updates (EAS Update): `pnpm update:live` sends screens, wording and fixes to installed apps on the `production` channel. Native changes still need a build. Works from TestFlight build 7, today build 8 (Basta). Since 2026-11-19 it sends to Android too (#169) | 2026-10-16 | Merged (#101), `CLAUDE.md` |
| A search word that names a category also finds everything in that category, both languages, singular or plural | 2026-10-16 | Merged (#104) |
| Bundle steps: the biggest parcel sets postage, an offer on the whole bundle comes later, the bar shows only on that seller's pages, 5/10/15% on by default | 2026-10-16 | Decided (Eden approved the mockup), `docs/plans/closet-deals.md` section 6 |
| Face ID lock closes the sell form, welcome questions and Face ID offer while locked, rather than drawing the lock as its own native layer | 2026-10-16 | Superseded on 2026-10-18, there is no lock on opening any more (#129) |
| Face ID is for logging in, not a lock on opening: a signed in person goes straight in, and after a password login (not a new account) the app offers to keep the login behind Face ID | 2026-10-18 | Merged (#129) |
| Help answers drop any answer with a link, an email address or a phone number | 2026-10-16 | Decided (Eden), merged (#96) |
| Only the seller can send photos in chat, enforced by the server | 2026-10-16 | Merged (#99) |
| Photo rotate and crop live in the full-screen photo view, crop is our own screen (no native package) | 2026-10-16 | Decided (Eden), merged (#97, #100) |
| Admin listing edits use admin-only routes. Delete keeps a listing that was in an order. Removed listings vanish from the admin list | 2026-10-16 | Decided (Eden), merged (#98, #103) |
| Launch under Eden's personal Apple account. A company account needs a Ltd and can take the app over later with Apple's app transfer | 2026-10-16 | Decided (Eden), log 2026-10-16 |
| Payments: no provider chosen. Ask Rapyd and PayMe the four questions in the log first (sellers are private people) | 2026-10-16 | Open, log 2026-10-16 |
| A brand a seller types joins the shared brand list when the listing goes live, capitals fixed word by word. Drafts add nothing | 2026-10-17 | Decided (Eden), merged (#111), `docs/blueprint/data-model.md` brands |
| One size for all adult clothing, not kids | 2026-10-17 | Decided (Eden), merged (#112) |
| About 100 new categories, nothing old renamed or removed. Denim shorts sit under Jeans | 2026-10-17 | Merged (#113) |
| Brand names on cards and item pages open that brand's search | 2026-10-17 | Merged (#114) |
| Home has no For you chip, the plain Home is For you. Tapping a chosen chip clears it | 2026-10-17 | Merged (#118, #121) |
| The price chip is called "Price" for now. Under ₪50 includes ₪50 on both website and app. Older app versions keep their Under ₪50 chip | 2026-10-17 | Decided (Eden), D-056 |
| The bell quick view stays website only, on a phone the bell already opens the full list | 2026-10-17 | Decided, log 2026-10-17 night |
| English tabs Browse and Inbox become Explore and Chats (they were Vinted's names). Hebrew tabs stay | 2026-10-17 | Decided (Eden), merged (#124), `docs/originality.md` row 14 |
| Favourites becomes Saved (שמורים) everywhere people read it, app and website. Addresses and code names stay | 2026-10-17 | Decided (Eden), merged (#124), `docs/originality.md` row 17 |
| The price with a protection line under it stays for now. The final name for Coverage comes later | 2026-10-17 | Open (Eden), `docs/originality.md` rows 2 and 8 |
| Should the website bundle bar become the pill too? | 2026-10-17 | Open, default yes as a small separate change |
| Keep the brand line on item cards (slightly taller cards)? | 2026-10-17 | Open, default keep |
| Women and Men switch on the website's full Browse page and phone menu too? | 2026-10-17 | Open, default add it next |
| Live database moves from Neon's free plan to Launch (pay per use, about $13 to $20 a month), after the free 100 compute hours ran out and the app stopped working | 2026-10-24 | Done (Eden), log 2026-10-24 |
| Server copies on Vercel open at most 2 database connections each (`DATABASE_POOL_MAX=2`), after Neon ran out of memory at about 110 connections | 2026-10-18 | Done, Vercel setting, log 2026-10-18 |
| Explore tile covers come in one cached request per side (5 minutes at Vercel), reference lists kept 10 minutes, to stop the data drain | 2026-10-18 | Merged (#133) |
| The name will not contain "yad" and the brand will not lead with orange, so nobody reads it as a Yad2 copy | 2026-10-19 | Decided (Eden), memory `avoid-yad2-look`, led to D-060 |
| Bot check is Cloudflare Turnstile on sign up, log in, emailed codes and the Help question box, website and app (the app through a hidden web page). A missing answer is let through while `CAPTCHA_REQUIRED` is false. If Cloudflare is down, calls go through | 2026-10-19 | Merged (#138). Switch `CAPTCHA_REQUIRED` on once most phones have the build with the check |
| Website security rules: only our own stamped scripts, always HTTPS, no framing by other sites | 2026-10-19 | Merged (#138) |
| Android partners get an APK by link (Expo profile `apk`), the Play Store follows with a closed test of 12 or more testers for 14 days | 2026-10-19 | Merged (#137), memory `play-console-account` |
| Accessibility statement contact, two-factor, offensive words, auto logout | 2026-10-19 | Open, defaults in log 2026-10-19 (Eden and the support email, email code on a new device, block and ask to rephrase, keep 30 days) |
| Neon autoscaling from a quarter unit up to 1 unit when busy | 2026-10-24 | Open, default yes (log 2026-10-24) |
| A fixed amount per order on top of the 5 percent fee, and a fee per category for cheap books | 2026-11-07 | Open, defaults in log 2026-11-07, decided with payments |
| Silent app updates go to iPhone and Android (`update:live` uses every platform) | 2026-11-19 | Merged (#169) |
| One-time cleanup on the live database: everyone who had answered "What do you shop for?" forgets the category interest learned in the other groups. Brands, sellers, sizes, saved items and settings kept | 2026-11-27 | Done (Eden approved), migration `0018_forget_other_groups_once.sql`, `docs/plans/home-feed.md` section 20, #181 |
| The condition words over the air update waited for Eden's go. The evening update from main (after #175) went to iPhones on build 8, Android needs a new build first | 2026-11-27 | Done for iPhone, log 2026-11-27 |
| Owner alerts: a Telegram message to Eden for every new sign up and log in, username and method only (never the email), no app or website label because Google and Apple log ins cannot tell reliably. Only the live server has the bot settings | 2026-11-27 | Merged (#182), working 2026-11-28, `apps/server/src/lib/telegram.ts`, `apps/server/.env.example` |
| Shopping preferences note still says other groups move "just a little lower" (now a lot lower) | 2026-11-27 | Open, default reword it (website and silent phone update) |
| Heavy interest in another group fades slowly | 2026-11-27 | Open, default leave it until there are more men's items, log 2026-11-27 |

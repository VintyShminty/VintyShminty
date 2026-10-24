# Decisions index

Last compiled: 2026-10-17 (night). Logs covered: `docs/log/2026-10-12.md`, `docs/log/2026-10-13.md` (through the night entry), `docs/log/2026-10-14.md` (all four sections), `docs/log/2026-10-15.md` (all twelve sections), `docs/log/2026-10-16.md` (all six sections, through bundles), `docs/log/2026-10-17.md` (morning and afternoon, plus the evening, night and Vinted renames sections from the open log PRs #125 and #126).

An index only. The full text and reasoning live where the link points. When a decision is replaced, mark it "Superseded by" and keep the line.

## Design (`docs/design.md`)

| ID | Decision | Status |
|---|---|---|
| D-001 | Inherit the earlier design, except colour | Approved |
| D-002 | Light mode only for now | Approved |
| D-003 | Typeface is Aileron | Approved |
| D-004 | Component library is React Native Reusables | Approved |
| D-005 | Phone-app adaptations of the earlier rules | Approved |
| D-006 | Colour palette: Espresso and cream | Approved |
| D-007 | ItemCard is Option C, Badge forward | Superseded in part by D-019 and D-032 |
| D-008 | Chips and badges are Option B, hairline outline | Approved |
| D-009 | Navigation is the bottom tab bar, with a Browse grid and pushed panels | Approved |
| D-010 | Category selection is always a full-screen push panel | Approved |
| D-011 | Hebrew typeface is Heebo, paired with Aileron. Closes O-003 | Approved, 2026-10-12 |
| D-012 | Star ratings use the espresso accent, not gold | Approved, 2026-10-12 |
| D-013 | CategoryRow labels use regular weight (400) | Approved, 2026-10-12 |
| D-014 | The Filter screen is a full-screen pushed panel, not a bottom sheet (FilterSheet becomes FilterPanel) | Approved, 2026-10-12 |
| D-015 | Sell form layout and pickers | Approved |
| D-016 | The tab bar keeps its English order in Hebrew | Approved, 2026-10-13 |
| D-017 | The tab bar stays on every page opened from a tab | Approved, 2026-10-13 |
| D-018 | The app sets the layout direction, so the language switches instantly | Approved, 2026-10-13 |
| D-019 | Originality pass: our own look, words and voice (16 directions, `docs/originality.md`) | Approved, 2026-10-13 |
| D-020 | Sign up asks only for email and password | Approved, 2026-10-13 |
| D-021 | Welcome, log in and sign up use one strong photo | Approved, 2026-10-13 |
| D-022 | The home feed explains itself and asks two questions after sign up | Approved, 2026-10-13 |
| D-023 | Continue with Apple and Google (Google through the browser sheet, one Web key) | Approved, 2026-10-13 |
| D-024 | Invite friends is a profile row, a friend's code is typed on that screen | Implemented, 2026-10-13 |
| D-025 | Away mode screen, return date chips, banner on your profile | Merged, 2026-10-14 (#30) |
| D-026 | Welcome turns into Log in and Sign up, the photo travels with the form | Merged, 2026-10-14 (#38) |
| D-028 | The photo helper shows best guesses first inside pickers and never fills anything | Merged, 2026-10-14 (#36). Replaces the auto-fill version of #35 |
| D-029 | Sizes question is a hand-drawn ink figure, one picture per step | Merged, 2026-10-14 (#37). Replaces the code-drawn figure |
| D-030 | Website layout on laptops and phone browsers | Approved, 2026-10-14 |
| D-031 | Colours picker is a grid of round swatches | Merged, 2026-10-14 (#46) |
| D-032 | Item card is a price tag on the photo, saving is a bookmark | Merged, 2026-10-14 (#51). Supersedes the item card of D-007 and D-019 |
| D-033 | Clothing categories say what the garment is | Merged, 2026-10-14 (#45) |
| D-034 | Chat: ledger line offers and smaller bubbles | Approved, 2026-10-14 |
| D-035 | Website polish after the first laptop review | Approved, 2026-10-14 |
| D-036 | Sell form also reads the seller's words, plus gentle photo tips | Merged, 2026-10-14 (#66) |
| D-037 | Search in plain words turns into filters with an easy way back | Merged, 2026-10-14 (#68) |
| D-038 | One Review list in the admin pages, AI flags, Eden decides | Merged, 2026-10-14 (#69) |
| D-039 | A calmer top of the website (direction C, round search bar) | Merged, 2026-10-15 (#72) |
| D-040 | Website item page is quieter, cards flip through photos, honest Coverage note | Merged, 2026-10-15 (#70) |
| D-041 | Chat warns about likely scams | Merged, 2026-10-15 (#74) |
| D-042 | Style tags teach Home what people like, behind the scenes only | Merged, 2026-10-15 (#75) |
| D-043 | Help page answers questions only from our help articles | Merged, 2026-10-15 (#76) |
| D-044 | Order problems reach the Review list with a facts only summary | Merged, 2026-10-15 (#77) |
| D-045 | The app item page speaks the card's language | Merged, 2026-10-15 (#79) |
| D-046 | The logo is a gently tilted price tag with a bold Y (for now, name not final) | Merged, 2026-10-15 (#89) |
| D-047 | Home top is the wordmark, a bell and a bookmark, then a full width search that works in place | Merged, 2026-10-15 (#93) |
| D-048 | Home and search show your shopping groups (Women, Men, Kids) first, other groups a bit lower, never hidden | Merged, 2026-10-16 (#106) |
| D-049 | Closet deal is now Bundle: item page box, + Bundle on cards, bundle bar, postage saving shown, sellers' steps on by default (Hebrew: באנדל) | Merged, 2026-10-16 (#107) |
| D-050 | The bundle pill floats above the tab bar, appears after an add tap, leaves when the bundle is empty, and the bundle box moves smoothly | Merged, 2026-10-17 (#109). App only, the website bar is an open question |
| D-051 | Books and magazines describe the same five condition levels in reading words | Merged, 2026-10-17 (#112) |
| D-052 | Browse tiles show real listing photos (stock photo when empty), the website panel has a Women and Men switch | Merged, 2026-10-17 (#115) |
| D-053 | Website top bar: bell quick view of the 5 latest, Women and Men pills on Home, no greeting, Browse is קטגוריות in Hebrew | Merged, 2026-10-17 (#116) |
| D-054 | Website Browse panel: More shows four pictures and a count and opens inside the panel | Merged, 2026-10-17 (#119) |
| D-055 | App Browse tab: Women and Men switch, listing covers, every category in one grid with no More | Merged, 2026-10-17 (#122) |
| D-056 | Home gets a Price chip with quick picks and From and To boxes instead of Under ₪50, app and website | Merged, 2026-10-17 (#123) |
| D-057 | Search words stay whole (H&M, Levi's, ג'ינס), short words match whole words only, word-start matches rank first | Proposed, 2026-10-18 |
| O-003 | Hebrew font pairing | Closed by D-011 |

General rule: where a design question is not decided, follow the product spec (the Vinted UX deconstruction) for how things work only, never its names, wording, icons or looks. Source: `docs/design.md`, D-019, `docs/originality.md`.

Note: D-027 was never used. Two sessions once both took D-030, the categories decision became D-033 (log 2026-10-14).

## Product and data (`docs/blueprint/data-model.md`, section "Open decisions", and `docs/roadmap.md`)

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
| Home feed: taste fades by half in 7 days, 3 surprise cards in 20, sizes only push matches up, activity kept 180 days | 2026-10-13 | Decided, `docs/plans/home-feed.md` |
| Going online is Milestone 8, Extras move to 9 | 2026-10-13 | Decided, see roadmap |
| Hosting: Vercel (Hobby for private testing, Pro before real users), Neon Postgres and Upstash Redis, all in Frankfurt. Photos on Cloudflare R2 | 2026-10-13 | Decided, see roadmap and `docs/going-online.md` |
| Emails go to the server log (`MAIL_TRANSPORT=log`) until Resend and a domain exist | 2026-10-13 | Decided, temporary |
| App ID `com.secondhand.marketplace`, Apple Team ID `DTT66N8N3D`, neutral on purpose | 2026-10-13 | Decided (Eden), see roadmap |
| Working name on the App Store and home screen: Shminty, changeable. Text inside the app still says Vinty | 2026-10-13 | Decided (Eden), PR #26 |
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
| App name "Yadii", Hebrew spelling "יאדי" as lead candidate. A trademark lawyer checks the Yad2 question first | 2026-10-15 | Open, `docs/originality.md` G10, log 2026-10-15 |
| Expenses: yearly costs spread over 12 months, one time costs in their month, "Paid by" is free text with suggestions | 2026-10-15 | Decided (Eden), `docs/blueprint/data-model.md` (`expense_items`), #85 |
| Address and city suggestions go through our server (one secret key, Israel only, signed in only, 300 an hour each) | 2026-10-15 | Decided, `docs/blueprint/api.md`, #86 |
| The offer button reads "Send your offer", Hebrew "תשלח/י הצעה" | 2026-10-15 | Decided (Eden), #84 |
| Admin batch upload: on the phone you tap photos then "Make item". The website keeps one drop is one item. The stand-in username is created on the spot per batch | 2026-10-15 | Decided (Eden), #88, #91 |
| Builds are iPhone only, no iPad. Apple's reviewer gets a normal account, never an admin | 2026-10-15 | Decided (Eden), log 2026-10-15 |
| Items 5 to 8, 11 to 19 (photo search, saved searches, brands, disputes, withdrawals, account deletion, seed passwords and more) | | Open, see data model |
| Over the air updates (EAS Update): `pnpm update:live` sends screens, wording and fixes to installed apps on the `production` channel. Native changes still need a build. Works from TestFlight build 7 | 2026-10-16 | Merged (#101), `CLAUDE.md` |
| A search word that names a category also finds everything in that category, both languages, singular or plural | 2026-10-16 | Merged (#104) |
| Bundle steps: the biggest parcel sets postage, an offer on the whole bundle comes later, the bar shows only on that seller's pages, 5/10/15% on by default | 2026-10-16 | Decided (Eden approved the mockup), `docs/plans/closet-deals.md` section 6 |
| Face ID lock closes the sell form, welcome questions and Face ID offer while locked, rather than drawing the lock as its own native layer | 2026-10-16 | Merged (#96) |
| Face ID is for logging in, not a lock on opening: a signed in person goes straight in, and after a password login (not a new account) the app offers to keep the login behind Face ID | 2026-10-18 | PR pending |
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

## Process (`docs/playbook/`)

| Decision | Date | Status |
|---|---|---|
| Never commit straight to `main`, work in branches and pull requests, Eden merges | 2026-10-12 | Active, `git-and-github.md` |
| Parallel agents use separate worktrees | 2026-10-12 | Active, `git-and-github.md` |
| Daily log at end of each session, compile at end of each milestone | 2026-10-12 | Active, `how-we-work.md` |
| New library versions must be 7 days old. CI blocks on serious vulnerabilities | 2026-10-12 | Active, `security-and-safety.md` |
| Two serious build-tool findings accepted by name with a weekly recheck. Temporary version exceptions removed after 13 and 19 October | 2026-10-12 | Active, `pnpm-workspace.yaml` |
| No git history rewrite, current files being clean is enough | 2026-10-12 | Decided (Eden) |
| Big library upgrades by hand, Dependabot skips major versions | 2026-10-13 | Active, `.github/dependabot.yml` |
| Agents' working copies live in `Homarim/VintyShminty-copies/`, hidden from Spotlight. One helper simulator at a time | 2026-10-13 | Active |
| Merges into `main` go live by themselves (Vercel is connected to GitHub). To try a branch live before merging, deploy it by hand from a clean copy (`VintyShminty-copies/deploy`) | 2026-10-13 | Active, `docs/going-online.md` |
| Eden pastes every secret himself. Claude never types passwords, keys or Apple or Google logins | 2026-10-13 | Active, `docs/playbook/security-and-safety.md` |
| The product spec stays in `docs/` and is never committed | 2026-10-13 | Active, `.gitignore` |
| TestFlight builds are made with local Xcode, not EAS. Build 7 went up on 2026-10-16, next is 8 | 2026-10-14 | Active (Eden), memory, `CLAUDE.md` |
| Use Sonnet helpers for work that does not need Opus | 2026-10-14 | Active (Eden), memory |
| Run the online database step before calling a schema PR ready | 2026-10-14 | Active, memory `migrate-before-merge` |
| Every note Eden gives applies to both the website and the app unless it cannot | 2026-10-17 | Active (Eden), memory `changes-apply-to-app-and-web` |
| Over the air updates go out from a clean copy of the latest main, after checking the runtime version matches the installed build. When the permission system blocks the agent, Eden runs `pnpm update:live`. Live database changes the same way | 2026-10-17 | Active, memory `ota-update-eden-runs`, log 2026-10-17 |

## Superseded

- "Stay on Neon's free plan for now" (2026-10-18): superseded on 2026-10-24, the database is on Launch.
- "Keep the word Favourites" (2026-10-14, #52): superseded by Saved on 2026-10-17 (#124).
- "Only Eden adds brands" (Milestone 2): superseded on 2026-10-17 by typed brands joining the list (#111).
- The Under ₪50 mood chip and the For you chip on Home: superseded on 2026-10-17 by the Price chip (D-056) and the plain Home being For you (#118).
- "The agent cannot send over the air updates, Eden runs them" (morning of 2026-10-17): the block is not consistent, the agent sent several later the same day. Try first, hand Eden the command if refused.
- "Closet deal" as the user-facing name for a bundle (Milestone 5): superseded by "Bundle" (Hebrew באנדל) in D-049 on 2026-10-16.

- FilterSheet as a bottom sheet (D-004 list and components): superseded by D-014 on 2026-10-12.
- O-003 as an open proposal: closed by D-011 on 2026-10-12.
- "Installing on Eden's own phone waits until more milestones are built" (2026-10-12): superseded on 2026-10-13, the first TestFlight build is on his iPhone.
- "Follow the product spec where nothing is decided" without limits: narrowed by D-019 on 2026-10-13 to how things work only.
- The auto-fill photo helper (PR #35) and the code-drawn sizes figure (PR #34): superseded by D-028 and D-029 on 2026-10-14.
- "Eden prefers EAS for TestFlight builds" (2026-10-13): superseded on 2026-10-14, builds come from local Xcode.
- "The app ID waits for the final name" (2026-10-13 evening): superseded the same night by `com.secondhand.marketplace`.
- "Buzz" as the name of the paid boost (2026-10-13, placeholder): superseded by "Boost" on 2026-10-15 (#94).
- "The Home top is a large greeting" (D-019, Home): superseded by D-047 on 2026-10-15.

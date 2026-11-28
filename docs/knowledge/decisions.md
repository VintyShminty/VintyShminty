# Decisions index

Last compiled: 2026-11-28. Logs covered: `docs/log/2026-10-12.md`, `docs/log/2026-10-13.md` (through the night entry), `docs/log/2026-10-14.md` (all four sections), `docs/log/2026-10-15.md` (all twelve sections), `docs/log/2026-10-16.md` (all six sections, through bundles), `docs/log/2026-10-17.md` (morning and afternoon, plus the evening, night and Vinted renames sections from the open log PRs #125 and #126), `docs/log/2026-10-18.md` (all three sections), `docs/log/2026-10-19.md` (all four sections), `docs/log/2026-10-24.md`, `docs/log/2026-11-07.md`, `docs/log/2026-11-17.md` (both sections), `docs/log/2026-11-19.md` (both sections, the later one added 2026-11-21), `docs/log/2026-11-27.md` (all five sections, the last one added 2026-11-28).

An index only. The full text and reasoning live where the link points. When a decision is replaced, mark it "Superseded by" and keep the line.

## Design (`docs/design.md`)

| ID | Decision | Status |
|---|---|---|
| D-001 | Inherit the earlier design, except colour | Approved |
| D-002 | Light mode only for now | Approved |
| D-003 | Typeface is Aileron | Approved |
| D-004 | Component library is React Native Reusables | Approved |
| D-005 | Phone-app adaptations of the earlier rules | Approved |
| D-006 | Colour palette: Espresso and cream | Superseded by D-060 (colours only, token names and roles stay) |
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
| D-046 | The logo is a gently tilted price tag with a bold Y (for now, name not final) | Merged, 2026-10-15 (#89). Superseded in part by D-060 (a B, in cobalt) |
| D-047 | Home top is the wordmark, a bell and a bookmark, then a full width search that works in place | Merged, 2026-10-15 (#93) |
| D-048 | Home and search show your shopping groups (Women, Men, Kids) first, other groups a bit lower, never hidden (lower still since 2026-11-27, home feed plan section 18) | Merged, 2026-10-16 (#106) |
| D-049 | Closet deal is now Bundle: item page box, + Bundle on cards, bundle bar, postage saving shown, sellers' steps on by default (Hebrew: באנדל) | Merged, 2026-10-16 (#107) |
| D-050 | The bundle pill floats above the tab bar, appears after an add tap, leaves when the bundle is empty, and the bundle box moves smoothly | Merged, 2026-10-17 (#109). App only, the website bar is an open question |
| D-051 | Books and magazines describe the same five condition levels in reading words | Merged, 2026-10-17 (#112) |
| D-052 | Browse tiles show real listing photos (stock photo when empty), the website panel has a Women and Men switch | Merged, 2026-10-17 (#115) |
| D-053 | Website top bar: bell quick view of the 5 latest, Women and Men pills on Home, no greeting, Browse is קטגוריות in Hebrew | Merged, 2026-10-17 (#116) |
| D-054 | Website Browse panel: More shows four pictures and a count and opens inside the panel | Merged, 2026-10-17 (#119) |
| D-055 | App Browse tab: Women and Men switch, listing covers, every category in one grid with no More | Merged, 2026-10-17 (#122) |
| D-056 | Home gets a Price chip with quick picks and From and To boxes instead of Under ₪50, app and website | Merged, 2026-10-17 (#123) |
| D-057 | Search words stay whole (H&M, Levi's, ג'ינס), short words match whole words only, word-start matches rank first | Merged, 2026-10-18 (#131) |
| D-058 | The first screen asks for the language, once per phone, before sign up | Merged, 2026-10-18 (#135) |
| D-059 | Explore lists every category on the page, each category with a fitting icon (Lucide and Lucide Lab) | Merged, 2026-10-18 (#136). App only |
| D-060 | The name is Basta (Latin letters in Hebrew too), the colour is Cobalt #2446A8, the tag logo has a B | Merged, 2026-11-17 (#154). Supersedes the colours of D-006 and the Y of D-046 |
| D-061 | A red star marks the sell form fields that must be filled, screen readers say "required" | Merged, 2026-11-19 (#167) |
| D-062 | Buyers can zoom into listing photos: app opens the full-screen viewer, website zooms on click | Merged, 2026-11-19 (#168) |
| D-063 | Things that are not worn describe condition in use words (Brand new, Unused, Like new, Used, Well loved). Clothes keep wearing words, books keep reading words | Merged, 2026-11-27 (#175) |
| D-064 | The language menu sits in the website top bar again, right before Sell. The app keeps it in Settings | Merged, 2026-11-27 (#176). Website only |
| D-065 | The Explore panel follows the account (Men first when you shop only Men), lists every main category and animates | Merged, 2026-11-27 (#176). Changes D-052, D-054, D-055 |
| D-066 | Your own shopping group leads Home, interest outside it fades in 7 days and comes back when you look again | Merged, 2026-11-27 (#179, one-time cleanup #181). Builds on D-048 |
| D-067 | First time sellers get three photo tips in the photo box and a drawn "Photos that sell" example on the first tap | Merged, 2026-11-27 (#180) |
| O-003 | Hebrew font pairing | Closed by D-011 |

General rule: where a design question is not decided, follow the product spec (the Vinted UX deconstruction) for how things work only, never its names, wording, icons or looks. Source: `docs/design.md`, D-019, `docs/originality.md`.

Note: D-027 was never used. Two sessions once both took D-030, the categories decision became D-033 (log 2026-10-14).

## Product and data

Moved to `docs/knowledge/decisions-product.md` on 2026-11-28 to keep this file short.

## Process (`docs/playbook/`)

| Decision | Date | Status |
|---|---|---|
| Never commit straight to `main`, work in branches and pull requests, Eden merges | 2026-10-12 | Active, `git-and-github.md` |
| Parallel agents use separate worktrees | 2026-10-12 | Active, `git-and-github.md` |
| Daily log at end of each session, compile at end of each milestone | 2026-10-12 | Active, `how-we-work.md` |
| New library versions must be 7 days old. CI blocks on serious vulnerabilities | 2026-10-12 | Active, `security-and-safety.md` |
| Safety warnings with no usable fix are accepted by name with a reason and a recheck date. Today: braces (weekly), decode-uri-component (2026-12-01, gone with Expo SDK 58), picomatch (2026-11-24). Add-ons we get through other add-ons are lifted with overrides, each with a reason | 2026-10-12, updated 2026-11-17 | Active, `pnpm-workspace.yaml` |
| No git history rewrite, current files being clean is enough | 2026-10-12 | Decided (Eden) |
| Big library upgrades by hand, Dependabot skips major versions | 2026-10-13 | Active, `.github/dependabot.yml` |
| Agents' working copies live in `Homarim/VintyShminty-copies/`, hidden from Spotlight. One helper simulator at a time | 2026-10-13 | Active |
| Merges into `main` go live by themselves (Vercel is connected to GitHub). To try a branch live before merging, deploy it by hand from a clean copy (`VintyShminty-copies/deploy`) | 2026-10-13 | Active, `docs/going-online.md` |
| Eden pastes every secret himself. Claude never types passwords, keys or Apple or Google logins | 2026-10-13 | Active, `docs/playbook/security-and-safety.md` |
| The product spec stays in `docs/` and is never committed | 2026-10-13 | Active, `.gitignore` |
| TestFlight builds are made with local Xcode, not EAS. Build 8 (Basta) went up on 2026-11-18, next is 9 | 2026-10-14 | Active (Eden), memory, `CLAUDE.md` |
| Use Sonnet helpers for work that does not need Opus | 2026-10-14 | Active (Eden), memory |
| Run the online database step before calling a schema PR ready | 2026-10-14 | Active, memory `migrate-before-merge` |
| Every note Eden gives applies to both the website and the app unless it cannot | 2026-10-17 | Active (Eden), memory `changes-apply-to-app-and-web` |
| Kept back on purpose: `@lucide/lab` at 0.7.0 (0.12 drops the perfume icon Explore uses) and Biome at 2.5.15 (2.6 reformats the doc tables) | 2026-11-17 | Active, log 2026-11-17 (#156) |
| Look at Dependabot's PRs about once a week, and merge small things often | 2026-11-17 | Active, log 2026-11-17 |
| Claude may merge a pull request when Eden asks for it in chat (first #181, 2026-11-27). The repository does not allow merging by itself once checks pass | 2026-11-27 | Active (Eden), log 2026-11-27. `CLAUDE.md` and `git-and-github.md` still say "Eden merges", see the 2026-11-28 compile report |
| Over the air updates go out from a clean copy of the latest main, after checking the runtime version matches the installed build. When the permission system blocks the agent, Eden runs `pnpm update:live`. Live database changes the same way | 2026-10-17 | Active, memory `ota-update-eden-runs`, log 2026-10-17 |

## Superseded

- "App name Yadii" (2026-10-15) and the orange Homebody idea (2026-10-19): superseded by Basta in Cobalt (D-060) on 2026-11-17.
- D-006 Espresso and cream: superseded by Cobalt (D-060) on 2026-11-17. The token names and roles stay.
- The Face ID lock on opening the app (#96, 2026-10-16): superseded on 2026-10-18 by Face ID for logging in only (#129).
- "The Face ID permission sentence says to log you in" (#129): put back to the old sentence the same day (#130), because it changed the app's native fingerprint. Still to change with a future Xcode build.
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

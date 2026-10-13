# Decisions index

Last compiled: 2026-10-13. Logs covered: `docs/log/2026-10-12.md` (all sections), `docs/log/2026-10-13.md` (all sections, through the night entry).

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
| D-007 | ItemCard is Option C, Badge forward | Approved |
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
| O-003 | Hebrew font pairing | Closed by D-011 |

General rule: where a design question is not decided, follow the product spec (the Vinted UX deconstruction) for how things work only, never its names, wording, icons or looks. Source: `docs/design.md`, D-019, `docs/originality.md`.

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
| Items 5 to 8, 11 to 19 (photo search, saved searches, brands, disputes, withdrawals, account deletion, seed passwords and more) | | Open, see data model |

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

## Superseded

- FilterSheet as a bottom sheet (D-004 list and components): superseded by D-014 on 2026-10-12.
- O-003 as an open proposal: closed by D-011 on 2026-10-12.
- "Installing on Eden's own phone waits until more milestones are built" (2026-10-12): superseded on 2026-10-13, the first TestFlight build is on his iPhone.
- "Follow the product spec where nothing is decided" without limits: narrowed by D-019 on 2026-10-13 to how things work only.
- "The app ID waits for the final name" (2026-10-13 evening): superseded the same night by `com.secondhand.marketplace`.

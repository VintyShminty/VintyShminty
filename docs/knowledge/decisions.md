# Decisions index

Last compiled: 2026-10-12 (second pass). Logs covered: `docs/log/2026-10-12.md` (morning and evening sections).

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
| O-003 | Hebrew font pairing | Closed by D-011 |

General rule: where a design question is not decided, follow the product spec (the Vinted UX deconstruction). Source: `docs/design.md`, authority order.

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
| Installing on Eden's own phone waits until more milestones are built | 2026-10-12 | Decided (Eden) |

## Superseded

- FilterSheet as a bottom sheet (D-004 list and components): superseded by D-014 on 2026-10-12.
- O-003 as an open proposal: closed by D-011 on 2026-10-12.

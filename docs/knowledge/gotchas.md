# Gotchas

Traps in our stack. Format: symptom, cause, fix, source. Added by the `compile-memory` skill.

## Tooling

- **A pnpm command seems to hang.** A background helper keeps the output pipe open. Redirect output to a file instead of piping into `tail`. Source: `CLAUDE.md`.
- **Native package version mismatch.** Install Expo and native packages with `npx expo install`, plain JavaScript packages with `pnpm add`. Source: `CLAUDE.md`.
- **CI fails on formatting or import order.** Run `pnpm format`. Source: `CLAUDE.md`, commit `00e4ad3`.

## Database

- **Seed or reset refuses to run.** By design. It runs only in development against a local database. Source: `CLAUDE.md`.
- **Schema changed but a test fails.** The table list in `docs/blueprint/data-model.md` must match the schema. Update it in the same commit. Source: `docs/blueprint/data-model.md`, "Keeping this page true".
- **After editing the schema** run `pnpm db:generate` before `pnpm db:migrate`. Source: `CLAUDE.md`.

## App

- **Right to left changes only after a restart.** Layout direction is fixed at app start. Test real RTL in a development build, Expo Go forgets a forced RTL. Source: `CLAUDE.md`.
- **A hard-coded colour fails a test.** Use tokens from `@/theme`. Source: `apps/mobile/tests/no-hardcoded-colours.test.ts`.
- **Left and right styles break Hebrew.** Use start and end (`ps-`, `me-`, `text-start`). Real case: Hebrew text hugged the left edge because the phone swaps left and right in right to left mode, which flipped a "align right for Hebrew" rule back to the left. Fix: always align to the start edge. Source: `CLAUDE.md`, log 2026-10-12 evening, commit `4abebb7`.
- **Face ID and forced right to left do nothing or crash in Expo Go** (the quick preview app). Use a development build: `npx expo run:ios`, which needs CocoaPods. Source: `CLAUDE.md`, log 2026-10-12 evening.
- **Known issue:** with the phone in Hebrew and the app in English, one line text boxes get extra space on the left. Not fixed yet. Source: log 2026-10-12 evening.
- **Missing font weights.** Aileron has no 200 or 500, Heebo no 100 or 200. They map to the nearest file. Source: `CLAUDE.md`.

## Libraries and CI

- **Installing a very new library version fails.** Versions younger than 7 days are refused on purpose. Wait, or add a temporary exception in `pnpm-workspace.yaml` with a date to remove it. Exceptions due: 2026-10-13 and 2026-10-19. Source: `docs/playbook/security-and-safety.md`, log 2026-10-12 evening.
- **The pull request check fails on a vulnerability scan.** It blocks on serious findings. Two build-tool findings (node-forge and braces, only on the developer machine) are accepted by name with a reason and a weekly recheck, anything new still blocks. Source: commit `4c4e85f`, `pnpm-workspace.yaml`.

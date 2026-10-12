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
- **Left and right styles break Hebrew.** Use start and end (`ps-`, `me-`, `text-start`). Source: `CLAUDE.md`.
- **Missing font weights.** Aileron has no 200 or 500, Heebo no 100 or 200. They map to the nearest file. Source: `CLAUDE.md`.

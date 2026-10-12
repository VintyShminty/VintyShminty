---
name: safety-check
description: Run the Vinty safety checklist before committing, opening a pull request, adding a dependency, touching auth, payments, uploads or the database, or before any risky action (merge, deploy, delete, reset). Use when about to commit or push, when a diff touches secrets, env files, sessions or user data, or when Eden asks for a safety check.
version: 1.0.0
---

# Safety check

Full reasoning is in `docs/playbook/security-and-safety.md`. This is the quick run.

## Before every commit

1. `git branch --show-current` is the expected branch.
2. `git status` shows only your files. Other changes belong to someone else, leave them.
3. `git diff --staged` read in full. Look for:
   - secrets, tokens, keys, connection strings, `.env` files (only `.env.example` is allowed)
   - real emails, phone numbers, addresses, user data
   - debug leftovers and `console.log` of user data
   - stray generated files, build output
4. Stage exact paths, never `git add -A` or `git add .`.
5. Run `pnpm typecheck`, `pnpm lint`, `pnpm test`. Redirect output to a file, do not pipe to `tail`.

## Extra checks by area

- **Database change:** migration generated and committed, `docs/blueprint/data-model.md` updated, enums in `packages/shared/src/enums.ts`, Zod schema matches, index exists for new queries.
- **New route:** Zod validates body, query and params. Session checked. Ownership checked. Test that another user is refused. Money is integer minor units. Server decides prices and states.
- **Auth, session, uploads:** token in `expo-secure-store`, signed upload links with size and type limits, nothing sensitive in logs or URLs.
- **New dependency:** needed, well known, lockfile committed, installed with `npx expo install` if native or Expo. The version must be at least 7 days old (`minimumReleaseAge`). An exclude needs a reason and a removal date comment. No new `allowBuilds` entry without a reason.
- **Workflow change:** every `uses:` pinned to a full commit SHA with the version as a comment, installs use `--frozen-lockfile`.
- **New screen or text:** strings in both `en.json` and `he.json`, tokens only for colours, start and end styles for RTL.
- **Anything that can fail silently:** no empty `catch`, errors shown to the user and logged.

## Before a pull request or merge

CI is green, branch is up to date, description says what was and was not checked. Run `pnpm audit:prod` before a release. Agents do not merge.

## Stop and ask Eden first

Merging, deploying, deleting data or branches, force operations, sending messages, posting publicly, spending money, changing account or security settings, creating accounts. Hand him the exact command or click instead of working around a block.

## Report

Tell Eden in plain words: what was checked, anything found, anything not checked. If a secret was exposed, say it first and say it must be rotated.

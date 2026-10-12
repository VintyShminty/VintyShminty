---
name: git-workflow
description: Vinty's git and GitHub steps. Use when starting work on a branch, setting up a worktree for parallel agents, committing, pushing, opening a pull request, resolving conflicts, or syncing after a merge. Triggers on "start a branch", "commit this", "push", "open a PR", "worktree", "merge conflict".
version: 1.0.0
---

# Git workflow

Full rules are in `docs/playbook/git-and-github.md`. Repo: `VintyShminty/VintyShminty`. Never commit straight to `main`.

## Start work

1. `git fetch origin`
2. If anyone else may be working in the main folder, do not touch it. Make a worktree:
   `git worktree add ../VintyShminty-<task> -b <branch> origin/<base>`
   Work only in that folder. Run `pnpm install --frozen-lockfile` there.
3. Branch names: `milestone-<n>`, `feat/<name>`, `fix/<name>`, `docs/<name>`, `chore/<name>`.

## Commit

1. `git branch --show-current` and `git status`.
2. `git add <exact paths>`. Never `-A` or `.`.
3. Run the `safety-check` skill's commit list.
4. Message: short imperative first line, optional why, then a blank line and the attribution line from the session instructions, for example `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
5. Small, single-purpose commits.

## Push and PR

1. `git push -u origin <branch>`. Never force push a shared branch.
2. Open a PR with `gh pr create` only when Eden asks. Title says the outcome. Body says what changed, why, what was checked, what was not, what Eden must decide. Agent PR bodies end with the attribution line from the session instructions.
3. Wait for CI. Fix red.
4. Eden merges. Agents never merge.

## After merges

- Stacked branches: merge the lower one first, retarget the next PR to `main`, then merge.
- Sync a clean local `main`: `git fetch && git reset --hard origin/main` (only with no work on it).

## Conflicts

Read both sides. Keep both entries for appended logs and tables. Keep `CLAUDE.md` edits small. Re-run typecheck, lint and tests. If confusing, stop and tell Eden in plain words.

## Finish

`git worktree remove <path>` when the branch is pushed and the work is done. Never use `git stash`, hard reset or rebase on a branch someone else uses.

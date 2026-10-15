# Git and GitHub

How work moves from an idea to `main`. Repo: `VintyShminty/VintyShminty`.

## Branch model

- `main` is the trusted line. Nobody commits straight to it, agents included.
- Work happens on a branch and enters `main` through a pull request.
- Milestones build on each other, so branches may be stacked (`design-foundation`, then `tech-foundation`, then `milestone-0`, then `milestone-1`). Each branch has its own PR into the one below it, or into `main` once the one below has merged.
- Names: `milestone-<n>` for a milestone, `feat/<name>`, `fix/<name>`, `docs/<name>`, `chore/<name>` for smaller work.
- Branch from a fresh `git fetch`, from the remote branch you build on (for example `origin/main`), never from whatever a shared folder happens to be on.

## Recommended settings for `main` (GitHub, Settings, Branches)

Pull request required, the `check` job from `.github/workflows/ci.yml` required, branch must be up to date, conversations resolved, no force pushes, no deletion. Eden decides when to turn each on.

## The normal flow

1. `git fetch origin`
2. Make a worktree for the work (see below).
3. Work in small steps. Commit each finished step.
4. Run `pnpm typecheck`, `pnpm lint`, `pnpm test`.
5. Push the branch.
6. Open a pull request with `gh pr create`, only when Eden asks.
7. CI runs. Fix anything red.
8. Eden reviews and merges. Agents do not merge.
9. Remove the worktree: `git worktree remove <path>`.

## Commits

- Small and about one thing. Commit a working checkpoint before starting the next big step.
- First line: short, in the imperative, says what changed ("Add offer expiry job"). A prefix like `fix:` or `docs:` is welcome and optional.
- Body: why, when the why is not obvious.
- The last line of an agent's commit is the attribution, after a blank line, exactly as the session's instructions give it. For example:

```
Add playbook docs and process skills

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
```

- Stage exact paths. Never `git add -A` or `git add .`.
- Never commit secrets, `.env` files, build output or local tool state.
- Run `git branch --show-current` right before committing. Another session may have switched the branch.

## Pull requests

- Title says the outcome. Description says what changed, why, what was checked, what was not, and anything Eden must decide.
- Use plain language. Eden reads these.
- Keep a PR to one idea. If it grew, split it.
- Check the real size with the two dot diff: `git diff --stat origin/<base> HEAD`.
- Agent PR descriptions end with the attribution line from the session instructions.
- Do not open a PR unless asked.

## Merging

- Eden merges. Squash merge is the default for small branches so one PR is one commit on `main`.
- For stacked branches merge the lower one first, then retarget the next PR to `main` before merging it. A stacked PR merged into a dead branch says MERGED on GitHub but never reaches `main`. Verify with `git cat-file -e origin/main:<a file only that PR adds>`.
- Merged is not live. A merged PR still needs its deploy step.
- Local `main` after a squash merge: `git fetch && git reset --hard origin/main`, only on a clean local `main` with no work on it.

## Worktrees (parallel agents)

Several agents or sessions must never share one working folder.

- Make a separate folder per task: `git worktree add ../VintyShminty-<task> -b <branch> origin/<base>`. Work only there.
- Never switch branches or edit files in a folder another agent is using.
- `git status` showing changes you did not make means someone else's live work. Do not stage, stash or clean it.
- Never `git stash`. The stash is shared by every worktree.
- A fresh worktree needs its own `pnpm install --frozen-lockfile` and its own copy of any gitignored `.env`, copied only with Eden's OK and never committed.
- A branch can be checked out in only one worktree at a time.
- Remove the worktree when done: `git worktree remove <path>`.
- Commit landed on the wrong branch: cherry-pick it onto the right base in a scratch worktree. Never reset a branch someone else owns.

## Conflicts

- Read both sides before choosing. Never resolve by taking one side blindly.
- Logs and lists that two branches both append to (like `docs/log`, `docs/roadmap.md`, decision tables) usually keep both entries.
- `CLAUDE.md` is edited by many branches. Keep your edit small and in its own section so merges stay easy.
- After resolving: run typecheck, lint and tests before pushing.
- If it gets confusing, stop and tell Eden in plain words. Do not force through.

## Never

- Force push a shared branch, or rewrite history anyone else has pulled.
- Pipe or silence the output of a `git checkout` you depend on.
- Skip hooks or checks to get something through.
- Delete a branch with unmerged work.
- Send more work to a PR's branch without checking it is not merged yet. If it is, open a new PR from a fresh branch.
- Call a PR that adds a database column or table ready before the online database step is done (`pnpm db:migrate:online`), or the live app breaks on merge.

## CI

`.github/workflows/ci.yml` runs install with a frozen lockfile, typecheck, lint and test on every pull request and on pushes to `main`. Keep it green and meaningful. A permanently red check hides real problems, and a test that never runs is worse than none. A change to CI itself gets its own PR.

## Releases (later)

When the app goes online: release from a clean checkout of `main` at an exact commit, preview first, check the live result as a real user, and keep scheduled jobs and config in code, not only in a cloud console. Releases are Eden's call.

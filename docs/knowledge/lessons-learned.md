# Lessons learned

Short rules with the reason. Add Vinty's own as they happen, each with a source link. Full method in `docs/playbook/`.

## Working practices

- **Find what swallowed the evidence.** A bug nobody noticed for weeks was hidden by a quiet error handler, a test that never ran, or a check built from the same logic as the change. Fix the silence. Source: `docs/playbook/security-and-safety.md`.
- **Prove a thing existed before calling it a regression.** A design "lost" in a rebuild had never shipped. Search all branches first. Source: `docs/playbook/how-we-work.md`.
- **Two failed fixes means change the method.** Three means stop and explain. Source: `docs/playbook/how-we-work.md`.
- **Say exactly what was proven.** Builds is not works, simulator is not a real phone, merged is not live. Source: proof table in `docs/playbook/how-we-work.md`.
- **Never trust the app for prices, owners or states.** The server decides. Source: `docs/playbook/security-and-safety.md`.
- **Parallel agents need separate worktrees.** Shared folders cause wrong-branch commits and lost work. Source: `docs/playbook/git-and-github.md`.
- **Stage exact files.** Blanket staging picks up other sessions' work and secrets. Source: `docs/playbook/git-and-github.md`.
- **A stacked pull request merged out of order never reaches `main`.** Merge the lower one first and retarget. Source: `docs/playbook/git-and-github.md`.
- **Group big error counts by folder.** Generated files hid the few real errors. Source: `docs/playbook/debugging.md`.
- **A redesign must not rename load-bearing labels.** Users read a renamed setting as a deleted one. Source: `docs/playbook/how-we-work.md`.

## Vinty

- **Decide once, then reuse the pattern.** Category pickers and filters all use the same full-screen push, so screens cannot drift apart. Source: D-010 and D-014 in `docs/design.md`.
- **Park open questions with a suggested default.** The evening log listed each open design question with a default, and Eden decided them from there. Source: log 2026-10-12 evening, D-011 to D-014.
- **Accepted risks get a name, a reason and a recheck date.** A vulnerability with no fix is accepted explicitly, never silenced. Source: `pnpm-workspace.yaml`, commit `4c4e85f`.
- **Right to left means start and end, never left and right.** Source: log 2026-10-12 evening, commit `4abebb7`.
- **A helper that restarts mid-task is safe if finished work is already pushed.** Source: log 2026-10-12 evening.
- **Check a claim before writing it down.** "Vercel cannot run live chat" and "Vercel is not connected to GitHub" were both wrong and caught only by checking. Source: log 2026-10-13 afternoon, compile 2026-10-13.
- **Chain checks before a deploy.** One change went live before its type check passed because commands were joined with `;`. Use `&&`. Source: log 2026-10-13 night.
- **The first deploy of a new host fails several times.** Budget for it and read the log each time, the fixes were all small. Source: log 2026-10-13 late evening.
- **Ask what accounts exist before asking Eden to open one.** The roadmap said "not started" for an account he had. Source: log 2026-10-13 evening, memory `accounts-eden-has`.
- **Read the safety refusal, do not route around it.** A blocked command went back to Eden as a small manual step. Source: log 2026-10-13 late evening.
- **Brief helpers fully and stack their branches on open PRs.** Sonnet built sign in and the error page from one message each, and was told when the base PR merged. Source: PRs #23, #25.

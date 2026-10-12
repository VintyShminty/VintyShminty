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

None recorded yet. Added by the `compile-memory` skill.

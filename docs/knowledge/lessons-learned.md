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
- **Say which branch the local website shows when two are reviewed in turn.** Otherwise "I see nothing different" costs a round trip. Source: log 2026-10-15.
- **Freeze the data a test reads before starting.** A category list changed mid test and made one model look far worse. Source: log 2026-10-14.
- **Check a PR is unmerged before sending it more work.** Three PRs got improvements after merge and needed new PRs (#36 to #38). Source: log 2026-10-14. Also in `docs/playbook/git-and-github.md`.
- **Do the online database step before calling a schema PR ready.** Source: log 2026-10-14 (#42), memory `migrate-before-merge`. Also in `docs/playbook/git-and-github.md`.
- **For motion bugs, record a frame by frame video.** Stills hid the real problem. The bundle pill took three rounds, each fixed from the frame timings. Source: log 2026-10-14 (#38), log 2026-10-17 (morning, #109).
- **Two sessions can pick the same decision number.** Check `docs/design.md` before taking the next id, and renumber on merge, keeping both sides. Source: log 2026-10-14 (D-030, D-026, D-024).
- **Check the Mac's load before blaming the code.** Slow uploads and a frozen emulator were the Mac at load 400. Source: log 2026-10-15 (#88).
- **When an AI guess looks biased, check what it was given.** The "Women jeans" guess was not about the seller, the AI only saw photos. The real fault was a list that hid Men. Source: log 2026-10-15 (#91).
- **After an interruption, check what actually happened before redoing it.** A commit and push had gone through, only the PR was missing. Source: log 2026-10-15 (#73).
- **Put the day's log in before asking for the merge.** A log pushed after the merge missed main. Source: log 2026-10-15 (#88).
- **In a shared folder, commit exact paths and merge somewhere else.** Another session's unsaved work and branch switches sat in the same folder. Source: log 2026-10-15 (#92, #93).
- **Match new motion to the speed of the app's page slides.** The Home search glide took three rounds until it moved at page speed. Source: log 2026-10-15 (#93).
- **Test AI on messy real writing.** Half of the 60 listings were slang, typos and mixed Hebrew and English, and the answer key was written first. Source: log 2026-10-14.
- **Tests do not see layout or taps.** An agent's bundles build passed every test and still had overlapping buttons, cut off text, raw wording keys and a button that opened the wrong thing. Click through new screens at phone width and in Hebrew before calling them done. Source: log 2026-10-16 (bundles).
- **A clickable mockup before building catches confusing states.** Eden spotted the bundle box "jumping" from 2 to 3 items in the mockup, before any code. Source: log 2026-10-16 (bundles).
- **Stop only the servers you started, by their own process.** A helper stopped every local dev server by name, including one another session used. Source: log 2026-10-17 (night).
- **Split parallel helpers by file, and wording keys count as files.** The website and app price helpers both added the same wording names with different placeholders, and git kept only one. Source: log 2026-10-17 (night).
- **Look again at the Vinted gap after big design steps.** The look moved far away, but the words (tab names, Favourites) stayed Vinted's until a fresh comparison caught them. Words outlast looks. Source: log 2026-10-17 (Vinted renames), #124.
- **Start a payments search from who gets paid.** PayMe looked best until it turned out to expect business sellers, and ours are private people. Source: log 2026-10-16 (late afternoon).

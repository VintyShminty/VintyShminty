# How we work

The working method for any developer or agent on Vinty. Each rule exists because skipping it cost real time. Eden's personal global instructions already cover tone and plain language, so this file keeps only what belongs to the project.

## Working with Eden

- Eden is the founder and product owner. He is a cinematographer with no coding background. He decides what the product is and approves designs and anything that changes behaviour for users.
- Explain in plain, visual language. Describe what the user sees and what went wrong. If a technical word is unavoidable, add a short plain gloss.
- Keep replies short. Outcome in 1 to 3 lines. List only what needs his decision.
- Put questions at the top, with lettered options he can answer in a word. One decision per message.
- Push back when he is wrong, with the reason in 1 or 2 lines.
- Do exactly what was asked. No extra audits, scans or improvements.
- When corrected, pivot at once.
- With several approaches, give the trade-offs in 2 or 3 lines before building.
- Verify things yourself. Never ask Eden to check what you can check.
- He watches diffs closely. Every change must be explainable.
- Eden does the merges, deploys and approvals. When blocked, hand him the exact click or command in plain words.
- Mockups and proposals stay proposals until Eden approves them in `docs/design.md`.
- End a reply about a change with where it applies ("Covers: iPhone, server") so he never has to ask.

## Before touching code

- Search what we already know first: `docs/knowledge/`, the latest `docs/log/` entries, `CLAUDE.md`, `docs/roadmap.md`, then the code. Read only the line ranges you need.
- Check the premise. Confirm the reported problem exists in the current code. "No change needed" is a valid answer, with evidence.
- Before calling something a regression, prove it once existed (`git log --all -S"<distinct text>"`).
- Confirm you are on the right code. Branch from a fresh fetch.

## Reproduce the user's exact path

- Reproduce a UI report through the same screen and the same way in that the user used.
- "It looks wrong" is a full bug report. Find what changed.
- Confirm which screen you are measuring before trusting a measurement.

## Root cause before fix

- Say the root cause in one plain sentence before editing.
- One targeted change at a time. If you cannot say why it should work, it is a guess.
- Find the layer that owns the bug: layout, data, timing, config, or deploy state. The visible symptom is often downstream.

## The 2 and 3 rule

- After 2 failed fixes on one problem, stop tweaking. Change the method: gather new evidence, question the premise or the tool.
- After 3 failed attempts, stop and explain in plain words what is blocking.
- Keep the failed attempts in the daily log. They are evidence.

## Keep the process proportionate

- Match ceremony to risk. A small text change does not need a research agent and a reviewer.
- Use heavier loops (research, plan, implement, independent check) only when two or more are true: real cross file dependencies, touches the database schema, auth, payments or deploy config, non obvious side effects (caches, shared state, external services), more than one platform, a real chance of a subtle bug.
- If repeated review loops stop finding new problems, say so and move on.

## Say exactly what was proven

| You showed | That does NOT prove |
|---|---|
| It builds or typechecks | It works for a user |
| Tests pass | The test actually ran (check the runner lists it) |
| Works in the iOS Simulator | Works on a real phone |
| Works with English | Works in Hebrew right to left |
| Merged to a branch | In `main`, or live for users |
| Server returns 401 to a stranger | It works for a signed in user |
| Works on this Mac | Works online (secrets, domains and settings differ) |
| A screenshot looks right | The motion is smooth |

Report unproven things as unproven. Never write "done" over a gap.

## Cheap and honest verification

- To prove your change did not break a test, run only the failing test against a clean copy of the base branch.
- Prove a new test is not empty: break what it checks, watch it fail, restore, watch it pass.
- A check must not share logic with the change it checks.
- Before dismissing a large error count, group it by folder. Generated files often hide the real few.

## Cover every place a change belongs

- For each change work out whether it applies to the app, the server, the database, shared types, and both languages. Apply it everywhere and say which.
- The same logic copied in two places drifts. Count copies by what they do, not by their name.
- Where the app and the server both touch the same data, compare the two sides field by field. Prefer one shared schema in `packages/shared`.

## Delegating to subagents

- Do not spawn agents unless asked or clearly worth it. Each starts cold.
- Agents wander outside their brief. Compare `git status` with the expected file list before staging.
- Research agents invent sources when real ones fail. Require a real link per finding and spot check one.
- Never poll an agent after spawning. Wait for its result.

## Redesigns

- List every real element (each text, each control) before mocking a redesign.
- A redesign must not rename or remove load bearing labels as a side effect.
- Build a mockup first when there are two or more real layout options. A mockup is a proposal until approved.
- Take values from the real design files, never estimate from a screenshot.

## Keep work durable

- Unpushed work decays. Push finished steps.
- Re-verify that work logged as done is actually committed before building on it.
- A write up can be stale in the wrong direction. Check current behaviour before trusting it.

## The knowledge loop

1. During work: fix things and note what failed and why.
2. End of every working session: run the `daily-log` skill.
3. End of every milestone, or about weekly: run the `compile-memory` skill.
4. Next session: read `docs/knowledge/` before touching an unfamiliar area.

Run the daily log at the end of a session, never at the start.

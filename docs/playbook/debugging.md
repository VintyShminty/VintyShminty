# Debugging

Recipes for the symptoms that cost the most time, written for Vinty. Use the matching one before improvising.

## Core rules

1. Do not guess from the symptom. Find the real owner of the problem first.
2. One targeted change at a time.
3. After two failed fixes change the method, not the value (see `how-we-work.md`).
4. Write down the root cause and the failed attempts, not just the final change.

## Symptom, then first move

| Symptom | First move |
|---|---|
| Nothing happens when tapping Save | Look for a swallowed error (empty `catch`). Check the app logs and the server logs. |
| A button is visible but does nothing | Is another view covering it? Does the handler run when called directly? Is the screen re-rendering and replacing the button under the finger? |
| Something is in the wrong place | List every parent from the element up to the screen. One of them constrains it (flex shrink, overflow, a fixed height). |
| Looks fine in English, wrong in Hebrew | Look for `left`, `right`, `pl-`, `ml-` style classes, icons that need mirroring, or text with fixed widths. Layout direction changes only after a restart. Test in a development build, not Expo Go. |
| Hebrew text looks off | Check the Heebo weight mapping. Missing weights fall back to the nearest file. |
| An empty screen | Is it truly empty, a failed login, a permission error, or a filter hiding things? Put the real error on screen. |
| A list looks unsorted | Read how the date or number is formatted before doubting the sort. |
| Works on the simulator, fails on a phone | Native modules, permissions, fonts, network address (a phone cannot reach `localhost` on the Mac). |
| Works locally, fails online | Environment variables, allowed domains and origins, missing secrets, missing database index. Each is a separate setting. |
| Everything fails at once | Shared config: login, a secret, the database connection. Not many separate bugs. |
| A fix was merged but users still see the bug | Merged is not live. Compare what is deployed with the merge date. |
| Save succeeds but a field is gone | A Zod schema is stripping the unknown field, or the Drizzle column is missing, or the writer and reader use different names. Check the actual stored row. |
| Server returns 400 on a valid looking request | Compare the body with the Zod schema in `packages/shared`. Unknown keys and number versus string are the usual cause. |
| Database error after pulling changes | A migration is missing. Run `pnpm db:migrate`. After a schema change run `pnpm db:generate` first. |
| Seed or reset refuses to run | It protects real data. It only runs on a local database in development. |
| A command seems to hang | The pnpm output gotcha. Redirect the output to a file instead of piping it into `tail`. |
| A long failing log | Read the head, not only the tail. The cause is often in the first lines. |
| A huge error count | Group by folder first. Generated files usually dominate. |
| Spinner looks broken | It finished faster than one cycle. Hold it for a minimum time. |
| Animation looks frozen or flickers | Measure frames from a screen recording. A screenshot cannot tell. |
| Numeric id does not match | Very large numbers (over 16 digits) lose precision in JSON. Treat ids as strings. |

## Data and server

- Grep both sides of every field name: what the server writes and what the app reads. A rename on one side shows up as `undefined` with no error.
- Do not cache `null` or a failure. One transient error then poisons the key for the whole session.
- Functions that return lists return `[]`, never `null`.
- Normalise missing or old values where data is loaded, not in every screen.
- A failed write must never be swallowed. Await it, retry once if it makes sense, report it.
- Server data in the app goes through TanStack Query, which keeps showing old data while reloading. A blank flash means something bypasses it.

## Which test failure is mine?

Run the one failing test on a clean copy of the base branch. If it fails there too, it was already broken, so record it separately. Make tests send the exact payload the real app sends.

## When to question the whole approach

- Two workarounds for the same problem failed: the tool or building block is probably wrong.
- Making something "more reliable" three times in a row often means the thing should not exist in that form. "Why is it flaky" and "should it exist" are different questions.
- Do not answer a bad response with a broad fallback. Find the exact boundary and make the smallest exact correction.

## Logging a fix

Every meaningful fix goes in the day's entry in `docs/log/` under "Problems and fixes": the problem, the root cause, the fix, the lesson. If it took 2 or more attempts, list what was tried and why it failed. `compile-memory` later moves the durable ones into `docs/knowledge/gotchas.md`.

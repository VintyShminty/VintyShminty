---
name: compile-memory
description: Compile the daily logs in docs/log/ into durable knowledge in docs/knowledge/ (decisions index, lessons learned, gotchas, glossary) and keep CLAUDE.md, roadmap and decision logs in sync. Use at the end of each milestone, about once a week, when Eden says "compile memory" or "update the knowledge base", or when the logs have grown long.
version: 1.0.0
---

# Compile memory

Turns the daily diary into a small, trustworthy reference. Logs are raw and chronological. Knowledge is short, deduplicated and current.

## When

- End of every milestone (required).
- About weekly while work is active.
- Before a long break, so the next start is easy.

## Files in docs/knowledge/

| File | Holds |
|---|---|
| `decisions.md` | Index of every decision with id, one line, date, status and a link to where the full text lives. Do not copy the full text. |
| `lessons-learned.md` | Process and product lessons, each with the reason and a source link. |
| `gotchas.md` | Traps in our stack and how to avoid them, each with symptom, cause, fix. |
| `glossary.md` | Product and technical terms in plain words, in Eden's vocabulary. |

## Steps

1. List the logs since the last compile (the date is at the top of `decisions.md`). Read them fully.
2. For each log item, decide where it belongs:
   - A decision goes to `decisions.md` as a link. If its real home is missing, add it there first (`docs/design.md`, `docs/blueprint/data-model.md` or `docs/roadmap.md`).
   - A trap that cost time goes to `gotchas.md`.
   - A rule of thumb about how we work goes to `lessons-learned.md`. If it should bind everyone, also put it in the relevant `docs/playbook/` file.
   - A new term goes to `glossary.md`.
   - One-off chatter stays in the log only.
3. Deduplicate. Merge entries that say the same thing. Keep the clearest wording and every source link.
4. Mark superseded facts. Do not delete them. Change the line to "Superseded by <id or link> on <date>" and move it to the bottom of its file or to the Superseded section.
5. Check against reality. If a fact names a file, command or table, confirm it still exists. Fix or mark stale ones.
6. Link every entry to its source (log date, commit, PR or doc path).
7. Sync the sources of truth:
   - `CLAUDE.md`: stack, rules, repo map and skill list match reality. Edit only the lines that are wrong, in the smallest possible diff.
   - `docs/roadmap.md`: milestone statuses and branch table.
   - `docs/design.md` decision log and `docs/blueprint/data-model.md` open decisions: closed items marked, new ones added.
8. Update the "Last compiled" date and the list of logs covered at the top of `docs/knowledge/decisions.md`.
9. Report to Eden in plain words: what is new, what was superseded, and anything in the logs that contradicts a doc and needs his call.

## Rules

- Knowledge files stay short. If one passes about 200 lines, split by topic.
- Never invent. If a log is unclear, keep it as an open question.
- Never record secrets or personal data.
- Plain language, no em or en dashes, no semicolons.

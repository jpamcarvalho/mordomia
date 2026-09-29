---
description: Orchestrate a specced feature end to end - implementer, then reviewer, fix loop until PASS, then architect docs
argument-hint: <NNN-slug>
---

Build feature **$ARGUMENTS** end to end. This command runs in the main session because agents cannot spawn agents;
the main session is the orchestrator and every agent reports back here.

Shell: `export PATH="$HOME/.docker/bin:$HOME/.local/node/bin:$PATH"` before docker/npm/npx.

## Phase 1 - Implement
Follow every step of `.claude/commands/implement.md` for `$ARGUMENTS` (prerequisite checks, status `implementing`,
`implementer` agent, OPEN QUESTIONS relayed via grill-me, resume the same implementer) until all tasks are ticked and
the implementer reports "OPEN QUESTIONS: none". Set status `review` in `specs/README.md`.
Do not stop to tell the user to run `/review`; continue to Phase 2.

## Phase 2 - Review (max 3 rounds)
1. Spawn the `reviewer` agent with the feature folder path. Show the user the verdict, AC coverage table and findings.
2. If it has `## OPEN QUESTIONS`, ask each via the **grill-me** skill, record the answers in the Decisions log of
   `requirements.md`, and re-run the reviewer (does not count as a round).
3. **CHANGES REQUIRED:**
   - Ask the user (AskUserQuestion, multiSelect) which findings to fix. If none, stop and report.
   - Add the chosen findings as new unticked tasks at the end of `tasks.md` (spawn the `architect` to write them if a
     design change is needed). Set status `implementing`.
   - Run Phase 1's implementer loop again for the new tasks (resume the same implementer with SendMessage if it is
     still available, otherwise spawn a new one), then set status `review` and start the next review round.
   - After **3** CHANGES REQUIRED rounds, stop: summarize the remaining findings and hand control back to the user
     (they can continue with `/implement` and `/review`).
4. **PASS:** go to Phase 3.

## Phase 3 - Document
Spawn the `architect` (Mode B) to write `specs/$ARGUMENTS/README.md` and update `docs/architecture.md`. Relay any open
questions via grill-me. Set status `done` in `specs/README.md` and commit:
`git add -A && git commit -m "docs(NNN): <name> done"`.

## Final report
Commits made (implementation + fix rounds + docs), number of review rounds, final test status, and any decisions the
agents made outside the spec that the user should check.

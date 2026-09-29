---
description: Review an implemented feature; on PASS the architect documents it (README.md + architecture.md)
argument-hint: <NNN-slug>
---

Review feature **$ARGUMENTS**.

1. Spawn the `reviewer` agent with the feature folder path.
2. Show the user the verdict, the AC coverage table, and the findings.
3. If it has `## OPEN QUESTIONS`, ask each one via the **grill-me** skill and record the answers in the Decisions log of
   `requirements.md`. Then re-run the reviewer.
4. **CHANGES REQUIRED:** ask the user (AskUserQuestion) which findings to fix. Add those as new unticked tasks at the end of
   `tasks.md` (the architect writes them if a design change is needed). Set status `implementing` and tell the user
   to run `/implement $ARGUMENTS`, then `/review $ARGUMENTS` again.
5. **PASS:** spawn the `architect` (Mode B) to write `specs/$ARGUMENTS/README.md` and update `docs/architecture.md`.
   Relay any open questions via grill-me. Then set status `done` in `specs/README.md` and commit:
   `git add -A && git commit -m "docs(NNN): <name> done"`.

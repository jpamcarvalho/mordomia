---
description: Implement a specced feature with the implementer agent, relaying its open questions via grill-me
argument-hint: <NNN-slug>
---

Implement feature **$ARGUMENTS**.

1. Check `specs/$ARGUMENTS/` has `requirements.md`, `design.md`, `tasks.md` and that `specs/README.md` shows it as
   `specced` or `implementing`. If not, stop and tell the user to run `/spec` first.
2. Check prerequisites: git works, Docker is running, and local Supabase is up (`npx supabase status`; start it with
   `npx supabase start` if needed). If something is missing, tell the user exactly what to do and stop.
3. Set status `implementing` in `specs/README.md`.
4. Spawn the `implementer` agent with the feature folder path.
5. When it returns `## OPEN QUESTIONS`:
   - Load the **grill-me** skill and ask each question via AskUserQuestion, one at a time, using the agent's options.
   - Append each Q/A to the **Decisions log** in `requirements.md`. If an answer changes behavior, add or adjust AC ids
     and tell the user; if it changes the design, spawn the `architect` to update design.md/tasks.md first.
   - Resume the **same** implementer with SendMessage, giving it the answers.
6. Repeat until all tasks are ticked and "OPEN QUESTIONS: none".
7. Set status `review` in `specs/README.md`, summarize the commits and test status, and tell the user the next step:
   `/review $ARGUMENTS`.

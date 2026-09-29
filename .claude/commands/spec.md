---
description: Spec a new feature — grill the user, write requirements.md, then have the architect write design.md + tasks.md
argument-hint: <feature idea>
---

Spec a new Mordomia feature: **$ARGUMENTS**

Follow `CLAUDE.md`. Do not write application code in this command.

## 1. Prepare
- Read `CLAUDE.md`, `docs/architecture.md`, `specs/README.md`, and the README of every existing feature related to the idea.
- Pick the next free number `NNN` (3 digits) and a short kebab-case slug. Confirm the slug with the user in the first question.

## 2. Grill the user (requirements)
Load the **grill-me** skill and follow it strictly: AskUserQuestion only, one question at a time, 2–4 concrete
options, acknowledge each answer in one sentence. If the code or docs already answer a question, read them and don't ask.
Walk every branch until nothing needs guessing:
- goal and users · user stories · exact behavior and edge cases (empty, duplicates, errors, limits)
- privacy: who sees / edits what (must hold for "went" vs "want" and friends vs strangers)
- UI: where it lives, screens, states, exact copy
- data: what is stored, required vs optional, validation rules
- out of scope for this version

## 3. Write `specs/NNN-slug/requirements.md`
Use `specs/_templates/requirements.md`. Every behavior becomes an EARS acceptance criterion with an id (AC-1…).
Fill the **Decisions log** with every question and answer. Add the row `NNN · name · draft` to `specs/README.md`.
Show the user a short summary and ask them (AskUserQuestion) to approve or request changes. Loop until approved,
then record the approval date in requirements.md (status stays `draft` until design is approved).

## 4. Design + tasks (architect)
Spawn the `architect` agent (Mode A) with the feature folder path. When it returns `## OPEN QUESTIONS`:
ask each one via grill-me (use its options), append Q/A to the Decisions log in requirements.md, then resume the
**same** architect agent with SendMessage, giving it the answers. Repeat until "OPEN QUESTIONS: none".

## 5. Approve
Summarize design.md (data changes, RLS, screens, test plan) and tasks.md (task count and titles), and list the
architect's `Technical decisions`. Ask the user to approve. On approval set status `specced` in `specs/README.md`.
Commit the spec (if git is available): `git add specs docs && git commit -m "spec(NNN): <name>"`.
Tell the user the next step: `/implement NNN-slug`.

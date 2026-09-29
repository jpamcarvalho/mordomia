@AGENTS.md

# Mordomia

Friends-only social app to log restaurants you **went** to and a private **want to go** list.
Stack and structure: see `docs/architecture.md` (the source of truth; read it before any work).

## Workflow: spec-driven, no assumptions

Every feature goes through three phases, each started by a command and ending with the user's approval:

| Phase | Command | Who | Output |
|---|---|---|---|
| Spec | `/spec <idea>` | main session (grill-me) → `architect` agent | `specs/NNN-slug/requirements.md`, `design.md`, `tasks.md` |
| Build | `/implement NNN-slug` | `implementer` agent | code + tests, one commit per task |
| Review | `/review NNN-slug` | `reviewer` agent → `architect` agent | review verdict, `specs/NNN-slug/README.md`, updated `docs/architecture.md` |

Shortcut: `/build NNN-slug` orchestrates Build → Review → docs in one run (fix loop: the user picks which findings to
fix, max 3 review rounds). `/implement` and `/review` remain for running a single phase.

Feature status lives in `specs/README.md` (`draft` → `specced` → `implementing` → `review` → `done`).
Templates live in `specs/_templates/`.

## Rules for everyone (main session and agents)

1. **Never assume.** If a product, data, UI, copy, security, naming or architecture decision is not written in
   `docs/architecture.md` or the feature's spec, do not decide it yourself.
   - Main session: ask the user with the **grill-me** skill (AskUserQuestion, one question at a time, 2–4 concrete options).
   - Agents: stop and return an `## OPEN QUESTIONS` section (see format below). The main session asks the user
     via grill-me, records each answer in the spec's **Decisions log**, then resumes the agent.
2. **Read before acting:** `docs/architecture.md`, the feature's `requirements.md` / `design.md` / `tasks.md`,
   and the `README.md` of every existing feature the work touches.
3. **The spec is the contract.** Implementation follows `tasks.md`; changing scope means updating the spec first
   (with the user's approval).
4. **Next.js 16** differs from older versions: read `node_modules/next/dist/docs/` before writing Next.js code
   (e.g. `src/proxy.ts` replaces middleware; `cookies()`, `params`, `searchParams` are async).
5. **Privacy is enforced in the database** (RLS in `supabase/migrations/`), never only in the UI.
6. Everything (docs, specs, code, questions) is written in **English**.
7. Commit directly to `main`, one commit per completed task: `feat(NNN): task N - <summary>`.

### OPEN QUESTIONS format (agents)

```md
## OPEN QUESTIONS
1. <question>
   - Context: <why it matters, where in the spec/code it came up>
   - Options: A) … B) … C) …
   - Blocks: <task ids / AC ids>
```

## Environment notes

- Node is installed at `~/.local/node` (no Homebrew). In shell commands use `export PATH="$HOME/.local/node/bin:$PATH"`.
- Local Supabase (`npx supabase start`) needs Docker Desktop running.

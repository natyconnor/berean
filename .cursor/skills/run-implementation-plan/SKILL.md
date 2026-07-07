---
name: run-implementation-plan
description: >-
  Autonomously execute a multi-PR implementation plan with subagents. Use when
  the user asks to auto-build, run, drive, or execute an implementation plan
  (e.g. an HTML/markdown plan with numbered PRs such as
  docs/proposals/study-mode-implementation-plan.html). Deploys one subagent per
  PR to implement, gate (agent:check + tests), review (Bugbot), and checkpoint
  sequentially on a single branch, never pushing.
---

# Run Implementation Plan

Drive a numbered-PR implementation plan to completion, one PR at a time, so the
user only has to manually test the finished branch and send it to GitHub.

You are the **orchestrator**. You do not write feature code yourself — you spawn
a scoped subagent per PR, verify its work, get it reviewed, and checkpoint it.

## Operating rules

- **Sequential only.** PRs depend on earlier PRs. Never run them in parallel.
- **One branch.** All work lands on a single feature branch as one checkpoint
  commit per PR. Commit locally; **never push, never open a GitHub PR.**
- **Trust but verify.** Re-run the gates yourself after each subagent returns.
- **Bounded retries.** If a PR can't reach green, retry the same subagent up to
  **2 times**, then **halt** and summarize. Do not skip a failing PR.
- **Scope discipline.** Each subagent implements only its PR's section. Pass it
  that section plus shared architecture/conventions — nothing else.

## Setup (once, before PR 1)

1. **Locate the plan.** Use the plan the user names, else the newest
   `docs/proposals/*.html` with numbered PR anchors. Read it fully and extract,
   in order: each PR's number, title, dependencies, file list, steps, and
   **acceptance criteria**. Also read the plan's shared "architecture" and
   "conventions" sections — these are passed to every subagent.
2. **Confirm the branch.** Ensure the working tree is clean
   (`git status --porcelain`). Create/switch to a feature branch (e.g.
   `study-mode-build`) off the current branch. If the tree is dirty, stop and
   ask before proceeding.
3. **Track progress** with TodoWrite: one todo per PR, first PR `in_progress`.

## Per-PR loop

Copy this checklist per PR and work top to bottom:

```
PR N — <title>
- [ ] 1. Implement (subagent)
- [ ] 2. Verify gates (orchestrator re-runs)
- [ ] 3. Review (Bugbot subagent) + fix Criticals
- [ ] 4. Checkpoint commit (local, no push)
- [ ] 5. Advance
```

### 1. Implement — launch a scoped implementer subagent

Use the Task tool (`subagent_type: generalPurpose`, `run_in_background: false`).
Prompt template:

```
You are implementing exactly ONE pull request from an implementation plan.
Do only what PR <N> specifies. Do not start any other PR.

## PR <N>: <title>
<paste the full PR section verbatim: goal, files, steps, acceptance criteria>

## Shared architecture (reference)
<paste the plan's architecture section: table shapes, scheduler spec, data flow>

## Conventions (must follow)
<paste the plan's conventions section>
Plus: read files before editing; use existing helpers; no `any`; Convex
functions need args+returns validators, auth + ownership checks, indexes (no
.filter), and no Date.now() in queries.

## Definition of done
- All acceptance criteria for PR <N> are met.
- `pnpm run codegen` run if schema/Convex functions changed.
- `pnpm run agent:check` passes.
- `pnpm test` passes if you added or changed any *.test.ts.
- Update docs/study-mode.md if this PR changes the data/scope/activity model.
- DO NOT commit, push, or open a PR. Leave changes in the working tree.

Report: files changed, how each acceptance criterion is satisfied, and the
exact commands you ran with their pass/fail results.
```

### 2. Verify gates (orchestrator)

Do not trust the subagent's word. Run yourself:

```bash
pnpm run agent:check
pnpm test   # only if this PR touched testable logic
```

If either fails, treat it as a failed attempt (go to Failure handling).

### 3. Review — Bugbot subagent

Launch the Task tool with `subagent_type: bugbot`, description exactly
`Bugbot`, `readonly: true`, `run_in_background: false`, and prompt:

```
Full Repository Path: <absolute repo path>
Diff: uncommitted changes
```

- If Bugbot reports **Critical/blocking** issues, resume the implementer
  subagent (`resume: <its id>`) with the findings and have it fix them, then
  re-verify gates (step 2). This counts toward the retry budget.
- Non-critical suggestions: note them in the final report; do not block.

### 4. Checkpoint commit (local only)

The user has explicitly authorized per-PR local commits for this workflow —
this is the sanctioned exception to the usual "don't commit unless asked" rule.
Commit only this PR's files; **never push.**

```bash
git add <files changed by this PR>
git commit -m "$(cat <<'EOF'
PR <N>: <title>

<one or two lines on what shipped and why>
EOF
)"
git status
```

Never use `git add -A`/`git add .`. Never `push`, `reset --hard`, force-push, or
rewrite history.

### 5. Advance

Mark the PR's todo complete, set the next PR `in_progress`, and repeat until all
PRs are done.

## Failure handling

Per PR, an "attempt" fails if gates fail (step 2) or Bugbot Criticals remain
after a fix pass. On failure:

1. Resume the same implementer subagent with the exact failure output (gate
   logs or Bugbot findings) and ask it to fix.
2. Re-verify. Allow **at most 2 fix attempts** total for the PR.
3. If still not green, **halt**: leave the working tree intact (do not revert),
   report which PR failed, the failing output, and what was tried. Wait for the
   user. Never continue to a dependent PR on a broken foundation.

## Completion report

When all PRs are green and committed, report concisely:

- The branch name and the ordered checkpoint commits (`git log --oneline`).
- Any non-blocking Bugbot suggestions deferred.
- Acceptance criteria that are **behavioral/visual** and still need the user's
  manual test (e.g. "auto-hide behaves per spec", "no visible UX change") —
  gates and review cannot prove these.
- Next step: the user manually tests the branch, then pushes it or runs the
  `split-to-prs` skill to carve the checkpoints into GitHub PRs.

## What this pipeline does not do

- It does not push or open PRs.
- It does not verify visual/behavioral correctness — that is the user's final
  manual pass by design.
- It does not parallelize dependent PRs.

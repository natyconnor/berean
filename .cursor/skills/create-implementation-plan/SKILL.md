---
name: create-implementation-plan
description: >-
  Author a multi-PR implementation plan that the run-implementation-plan skill
  can execute autonomously. Use when the user asks to create, write, draft, or
  break work into a numbered-PR plan, turn a proposal/spec into a build plan, or
  plan a large feature as a sequence of small reviewable pull requests. Produces
  a grounded docs/proposals/<feature>-implementation-plan.html with shared
  architecture + conventions and dependency-ordered PRs, each independently green.
---

# Create Implementation Plan

Turn a feature idea, proposal, or spec into a **numbered-PR implementation plan**
that the companion `run-implementation-plan` skill can drive to completion with
one subagent per PR.

You are the **planner**. You do not write feature code — you produce one
document that a downstream orchestrator reads to spawn scoped implementer
subagents. The quality of that build depends entirely on this document being
**grounded, sequenced, and self-contained.**

## The contract (what makes a plan runnable)

`run-implementation-plan` reads the newest `docs/proposals/*.html` with numbered
PR anchors and extracts, in order: each PR's **number, title, dependencies, file
list, steps, and acceptance criteria**, plus the shared **architecture** and
**conventions** sections which it pastes verbatim into *every* subagent. So the
plan MUST have:

1. **Location & format.** `docs/proposals/<feature>-implementation-plan.html`
   with sequential PR anchors `id="pr1"`, `id="pr2"`, … (the runner locates PRs
   by these anchors). Use `template.html` in this skill folder.
2. **A shared Architecture section** — every table shape, interface signature,
   and data-flow fact any PR relies on. If it lives only inside one PR block, a
   subagent building a *different* PR will not see it.
3. **A shared Conventions section** — the repo's hard rules (validation, auth,
   `pnpm run agent:check`, `pnpm run codegen`, no `Date.now()` in queries, etc.).
4. **Per PR:** dependencies (`Depends on` / `Unblocks`), full file list,
   ordered implementation steps, and acceptance criteria.

## Workflow

Copy this checklist and work top to bottom:

```
- [ ] 1. Ground: explore the codebase; verify every asset/path
- [ ] 2. Lock decisions: resolve open questions into fixed constraints
- [ ] 3. Design shared architecture + conventions
- [ ] 4. Sequence PRs: dependency-ordered, small, each independently green
- [ ] 5. Write acceptance criteria: mechanical first, behavioral flagged
- [ ] 6. Render into template.html; fill TOC; save to docs/proposals/
- [ ] 7. Verify against the checklist
```

### 1. Ground in the codebase (do not skip)

A plan that invents files or misnames symbols will send every subagent chasing
ghosts. Before writing anything:

- Explore the real code (use the `explore` subagent for breadth). Identify the
  **existing assets to reuse** — exact file paths and symbol names — and the
  **gaps** (primitives/registries that don't exist yet and must be added).
- Confirm the build/validation commands from `AGENTS.md` (`pnpm run agent:check`,
  `pnpm test`, `pnpm run codegen`, `pnpm dev`).
- If a source proposal/spec exists, read it fully and reconcile contradictions
  *before* planning — do not pass ambiguity downstream.

Every path in the "Assets to reuse" and PR "Files" lists must be real (or
explicitly tagged `(new)`).

### 2. Lock decisions

List open questions with genuine trade-offs and resolve them into a **Settled
decisions** table of fixed constraints. If a decision is truly the user's to
make (irreversible, changes scope, or product-facing), ask with `AskQuestion`
rather than guessing. Otherwise pick a sensible default and record it.

### 3. Design shared architecture + conventions

- **Architecture:** the single source of truth — data-model/table shapes, the
  signatures of shared functions/modules, and an end-to-end data-flow paragraph.
  Put anything two or more PRs depend on here, never inside one PR.
- **Conventions:** the non-negotiable rules pasted into every subagent. Seed
  from `AGENTS.md` and the repo's Convex rules; keep it to hard, checkable rules.

### 4. Sequence the PRs

This is the core skill. Ordering rules:

- **Dependency-ordered & sequential.** Later PRs may depend on earlier ones;
  none may depend on a *later* one. State `Depends on` / `Unblocks` explicitly.
- **Each PR ends green on its own.** The runner gates every PR with
  `pnpm run agent:check` (and `pnpm test`) and commits it before advancing — so
  a PR may not leave the tree broken or rely on a future PR to compile/pass.
  Early "ships silently" PRs (inert foundation: schema + pure libs + tests) are
  ideal and encouraged.
- **Small enough to review and revert.** If a PR's file list or steps sprawl,
  split it. Prefer roughly 4–10 PRs; note where a large PR "can split further."
- **Foundations first.** Schema/pure logic/server API before UI before polish.
- **Each PR is independently valuable** where possible, so the sequence degrades
  gracefully if later PRs slip.

Give each PR a concrete goal (1–3 sentences), an exhaustive file list (mark new
files `(new)`), and ordered implementation steps detailed enough that a subagent
executes them without guessing — but reference the Architecture section instead
of duplicating it.

### 5. Write acceptance criteria the runner can actually check

The runner proves PRs with `agent:check`, `pnpm test`, and a Bugbot review; it
**cannot** verify visual/behavioral correctness — that is the user's final
manual pass. So for each PR:

- Lead with **mechanically verifiable** criteria: `pnpm run agent:check` passes,
  named unit tests for any pure logic, "no existing test breaks", idempotency,
  "query uses index / validates args+returns", etc.
- Add unit tests to the plan for any non-trivial pure function (put the test
  file in that PR's file list).
- Clearly phrase **behavioral/visual** criteria (animations, layout, "no visible
  change") so the runner surfaces them to the user as needing a manual test.

### 6. Render into the template

Copy `template.html` (in this skill's folder) to
`docs/proposals/<feature>-implementation-plan.html`. Fill every `{{PLACEHOLDER}}`
and `<!-- FILL -->` region, duplicate the `<!-- PR TEMPLATE -->` block once per
PR keeping ids sequential (`pr1`, `pr2`, …), build the TOC to match, and delete
the template comments. Markdown is acceptable only if it keeps the same content
contract and clearly numbered PR sections — HTML with anchors is the default the
runner expects.

### 7. Verify

Run through the checklist below before handing off.

## Quality checklist

- [ ] Saved to `docs/proposals/<feature>-implementation-plan.html` with
      sequential `id="prN"` anchors and a matching TOC.
- [ ] Architecture section is complete and self-contained (no cross-PR
      dependency lives only inside a single PR block).
- [ ] Conventions section captures the repo's hard rules.
- [ ] Every PR has: Depends on/Unblocks, Files, Implementation steps, Acceptance
      criteria.
- [ ] Dependencies point only backward; PRs are topologically ordered.
- [ ] Each PR leaves the tree green (`agent:check`) with no reliance on a later
      PR.
- [ ] Every referenced path exists in the repo or is tagged `(new)`.
- [ ] Acceptance criteria separate mechanically-verifiable from behavioral.
- [ ] PRs are small; oversized ones are split or flagged "can split further".

## Handoff

Do not implement the plan yourself and do not commit unless asked. When the plan
is written, tell the user it is ready and that they can run the
`run-implementation-plan` skill (or say "auto-build this plan") to execute it PR
by PR on a single branch.

## Reference

- `template.html` — the styled HTML skeleton to fill in.
- The companion `.cursor/skills/run-implementation-plan/SKILL.md` — read it to
  see exactly how each section of your plan is consumed.

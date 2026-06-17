# Agent Guidelines

This file is the canonical, repository-wide instruction set for coding agents.

## Goals

- Make the smallest correct change that satisfies the request.
- Preserve existing behavior unless the user asks for a behavior change.
- Do not revert or overwrite unrelated user changes.

## Workflow

1. Read the relevant files before editing.
2. Keep edits focused and self-explanatory.
3. After any code changes, run `pnpm run agent:check` before finishing the task.
4. If checks fail, fix the issues and rerun the command.
5. Do not treat the task as complete while checks are failing unless the user explicitly says to skip them.

## Validation

Validation is required, not optional. A Cursor **stop hook** (`.cursor/hooks/agent-check-on-stop.sh`) also runs `pnpm run agent:check` automatically when source files changed and will loop the agent back with failures until checks pass.

- Main post-change command: `pnpm run agent:check` (format → lint → typecheck)
- CI also runs: `format:check`, `test`, and `build` — run these when the change is broad or touches build/test paths
- Individual commands:
  - `pnpm run format` (Prettier, write)
  - `pnpm run format:check` (Prettier, CI parity)
  - `pnpm run lint`
  - `pnpm run typecheck`
  - `pnpm test`

Run `pnpm test` when the change is risky, nearby tests already exist, or the user asks for them.

## Safety

- Never commit or push unless the user explicitly asks.
- Never add secrets, API keys, or `.env` contents to source control.
- Ask before making broad refactors or destructive changes.

## Repo Notes

- Dev server: `pnpm dev`
- Frontend build: `pnpm run build`
- Convex codegen: `pnpm run codegen`

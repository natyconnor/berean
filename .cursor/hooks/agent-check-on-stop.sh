#!/usr/bin/env bash
# Runs format, lint, and typecheck when the agent changed code this turn.
# Wired from .cursor/hooks.json on the "stop" event.
set -euo pipefail

json_input=$(cat)

status="completed"
loop_count=0
if command -v jq >/dev/null 2>&1; then
  set +e
  status=$(printf '%s' "$json_input" | jq -r '.status // "completed"' 2>/dev/null)
  loop_count=$(printf '%s' "$json_input" | jq -r '.loop_count // 0' 2>/dev/null)
  set -e
fi

debug_log() {
  printf '%s\n' "$*" >&2
}

emit_empty() {
  printf '%s\n' '{}'
  exit 0
}

fail_with_followup() {
  local exit_code=$1
  local raw_output=$2
  printf '%s' "$raw_output" | head -c 12000 | python3 -c '
import json, sys

code = int(sys.argv[1])
out = sys.stdin.read()
msg = (
    "The repository **stop hook** ran `pnpm run agent:check` after your last "
    "turn because source files changed.\n\n"
    f"**Result:** failed with exit code **{code}**.\n\n"
    "Fix the issues below, then continue. Do not mark the task complete until "
    "checks pass.\n\n"
    "```text\n" + out + "\n```\n"
)
print(json.dumps({"followup_message": msg}, ensure_ascii=False))
' "$exit_code"
  exit 0
}

sanitize_cursor_bundled_runtimes_from_path() {
  if command -v python3 >/dev/null 2>&1; then
    PATH="$(
      python3 -c '
import os
skip = (".cursor-server", ".vscode-server")
path = os.environ.get("PATH", "")
print(":".join(part for part in path.split(":")
               if part and not any(token in part for token in skip)))
'
    )"
    export PATH
  fi
}

has_code_changes() {
  git diff --quiet HEAD -- \
    src \
    convex \
    shared \
    package.json \
    pnpm-lock.yaml \
    tsconfig.json \
    tsconfig.app.json \
    tsconfig.node.json \
    eslint.config.js \
    vite.config.ts 2>/dev/null || return 0
  git diff --cached --quiet -- \
    src \
    convex \
    shared \
    package.json \
    pnpm-lock.yaml \
    tsconfig.json \
    tsconfig.app.json \
    tsconfig.node.json \
    eslint.config.js \
    vite.config.ts 2>/dev/null || return 0
  return 1
}

if [[ "${status}" == "aborted" ]]; then
  debug_log "agent-check-on-stop: status=aborted — skipping checks"
  emit_empty
fi

if ! has_code_changes; then
  debug_log "agent-check-on-stop: no code changes — skipping checks"
  emit_empty
fi

sanitize_cursor_bundled_runtimes_from_path

if ! command -v pnpm >/dev/null 2>&1; then
  debug_log "agent-check-on-stop: pnpm not found on PATH"
  fail_with_followup 127 "pnpm was not found on PATH. Install pnpm or run checks manually."
fi

debug_log "agent-check-on-stop: running pnpm run agent:check (loop_count=${loop_count})"

set +e
output=$(pnpm run agent:check 2>&1)
exit_code=$?
set -e

if [[ "${exit_code}" -eq 0 ]]; then
  debug_log "agent-check-on-stop: checks passed"
  emit_empty
fi

debug_log "agent-check-on-stop: checks failed (exit ${exit_code})"
fail_with_followup "${exit_code}" "${output}"

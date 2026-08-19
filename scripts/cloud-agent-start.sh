#!/usr/bin/env bash
# Per-boot start step for the Berean Cloud Agent development environment.
#
# Brings up the two long-running dev services and stays attached:
#   1. The local (anonymous) Convex backend + function watcher.
#   2. The Vite dev server (in preview mode so it auto-signs-in anonymously).
#
# Safe to run again after a restart: any stale Convex backend on port 3210 is
# stopped first so the deployment can re-bind cleanly.

set -euo pipefail

cd "$(dirname "$0")/.."

export CONVEX_AGENT_MODE=anonymous
# The Vite dev server can grow past Node's default old-space limit during long
# sessions with on-demand route compilation, so give it more headroom.
export NODE_OPTIONS="${NODE_OPTIONS:-} --max-old-space-size=4096"
export VERCEL_ENV=preview

CONVEX_PORT=3210
CONVEX_LOG=/tmp/berean-convex-dev.log

stop_stale_backend() {
  # Stop a previously-running local backend so a restart does not hit
  # "backend already running on port ${CONVEX_PORT}".
  local pids
  pids="$(ss -ltnpH "sport = :${CONVEX_PORT}" 2>/dev/null |
    grep -oE 'pid=[0-9]+' | cut -d= -f2 | sort -u || true)"
  for pid in ${pids}; do
    echo "Stopping stale Convex backend (pid ${pid}) on port ${CONVEX_PORT}"
    kill "${pid}" 2>/dev/null || true
  done
  if [ -n "${pids}" ]; then sleep 2; fi
}

stop_stale_backend

echo "==> Starting local Convex backend (logs: ${CONVEX_LOG})"
pnpm exec convex dev --tail-logs disable >"${CONVEX_LOG}" 2>&1 &

echo "==> Waiting for Convex backend on port ${CONVEX_PORT}"
for _ in $(seq 1 90); do
  if curl -sf -o /dev/null "http://127.0.0.1:${CONVEX_PORT}/version" 2>/dev/null; then
    echo "    Convex backend is ready."
    break
  fi
  sleep 1
done

echo "==> Starting Vite dev server on http://0.0.0.0:5173"
pnpm dev --host 0.0.0.0 --port 5173 &

# Stay attached to both services; exit if either stops.
wait -n

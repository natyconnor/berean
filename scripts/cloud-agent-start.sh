#!/usr/bin/env bash
# Per-boot start step for the Berean Cloud Agent development environment.
#
# Brings up the two long-running dev services and stays attached:
#   1. The local (anonymous) Convex backend + function watcher.
#   2. The Vite dev server (in preview mode so it auto-signs-in anonymously).
#
# Vite's on-demand compiler can OOM during long browse sessions. This script
# restarts Vite instead of exiting the start step (`wait -n` used to fail
# start-user with 134 and leave agents without a frontend).
#
# Safe to run again after a restart: any stale Convex backend on port 3210 is
# stopped first so the deployment can re-bind cleanly.

set -euo pipefail

cd "$(dirname "$0")/.."

export CONVEX_AGENT_MODE=anonymous
# Vite's on-demand compiler can grow well past 4GB during a browsing session
# (computer-use agents compile many routes quickly). The VM has ~16GB; give
# the heap room, and restart Vite if it still OOMs instead of exiting start.
export NODE_OPTIONS="${NODE_OPTIONS:-} --max-old-space-size=8192"
export VERCEL_ENV=preview

CONVEX_PORT=3210
CONVEX_LOG=/tmp/berean-convex-dev.log
VITE_LOG=/tmp/berean-vite-dev.log

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
CONVEX_PID=$!

echo "==> Waiting for Convex backend on port ${CONVEX_PORT}"
for _ in $(seq 1 90); do
  if curl -sf -o /dev/null "http://127.0.0.1:${CONVEX_PORT}/version" 2>/dev/null; then
    echo "    Convex backend is ready."
    break
  fi
  sleep 1
done

# Restart Vite on crash. `wait -n` previously exited the whole start step
# (status 134) when Node hit the heap limit, which left agents without a
# frontend even though Convex was still healthy.
echo "==> Starting Vite dev server on http://0.0.0.0:5173 (logs: ${VITE_LOG})"
(
  while true; do
    pnpm dev --host 0.0.0.0 --port 5173 >>"${VITE_LOG}" 2>&1 || true
    echo "==> Vite exited; restarting in 2s..." | tee -a "${VITE_LOG}"
    sleep 2
  done
) &

# Stay attached to Convex. If the backend dies, start fails; Vite is
# supervised in the loop above.
wait "${CONVEX_PID}"

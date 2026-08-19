#!/usr/bin/env bash
# Idempotent install step for the Berean Cloud Agent development environment.
#
# Responsibilities (safe to run repeatedly):
#   1. Install JS dependencies from the lockfile.
#   2. Provision a local, account-free ("anonymous") Convex deployment, push the
#      Convex functions, and write VITE_CONVEX_URL into .env.local.
#   3. Configure the Convex Auth keys (JWT_PRIVATE_KEY / JWKS / SITE_URL) and,
#      when available, the optional ESV_API_KEY, on that deployment.
#
# The long-running dev servers (Convex backend + Vite) are started separately as
# environment "terminals"; nothing here should stay running after it returns.

set -euo pipefail

cd "$(dirname "$0")/.."

# Run the Convex CLI without prompting for a login/account.
export CONVEX_AGENT_MODE=anonymous

echo "==> Installing dependencies (pnpm install --frozen-lockfile)"
pnpm install --frozen-lockfile

echo "==> Provisioning local Convex deployment and pushing functions"
if curl -sf -o /dev/null http://127.0.0.1:3210/version 2>/dev/null; then
  # A local backend is already running (e.g. the "convex" terminal). The running
  # `convex dev` already keeps functions pushed, so we only refresh generated
  # types here to avoid a "backend already running on port 3210" conflict.
  echo "    Local Convex backend already running; regenerating types only."
  pnpm exec convex codegen --typecheck disable
else
  # --once provisions the anonymous deployment, downloads the open-source backend
  # binary (cached under ~/.cache/convex), pushes the functions, regenerates
  # convex/_generated, and writes VITE_CONVEX_URL to .env.local. It then exits,
  # so the backend is not left running by the install step.
  pnpm exec convex dev --once --tail-logs disable
fi

echo "==> Configuring Convex Auth environment variables"
node scripts/setup-convex-auth.mjs

echo "==> Cloud Agent setup complete"

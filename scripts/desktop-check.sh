#!/usr/bin/env bash
# Typecheck and lint the desktop shell in electron/.
#
# electron/ is a standalone package with its own dependencies, so its sources
# can only be checked once those are installed. Web-only checkouts and web CI
# never install them; there this is a no-op rather than a failure, unless
# DESKTOP_CHECK_REQUIRED is set (the CI desktop job), where skipping would hide
# a broken install.
set -euo pipefail

cd "$(dirname "$0")/.."

if [[ ! -d electron/node_modules ]]; then
  if [[ -n "${DESKTOP_CHECK_REQUIRED:-}" ]]; then
    echo "desktop:check failed: electron/ dependencies are not installed." >&2
    exit 1
  fi
  echo "desktop:check skipped: electron/ dependencies are not installed."
  echo "Run \`pnpm --dir electron install\` to check the desktop shell."
  exit 0
fi

pnpm --dir electron run typecheck

# The root ESLint config ignores electron/ (see eslint.config.js), so name the
# sources explicitly.
pnpm exec eslint --no-ignore "electron/*.ts"

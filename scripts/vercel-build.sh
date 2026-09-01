#!/usr/bin/env bash
# Vercel build: deploy Convex, then Vite, with VITE_CONVEX_URL set to the
# deployment that was just claimed.
set -euo pipefail

args=(
  deploy
  --cmd 'pnpm run build'
  --cmd-url-env-var-name VITE_CONVEX_URL
)

if [[ "${VERCEL_ENV:-}" == "preview" ]]; then
  branch="${VERCEL_GIT_COMMIT_REF:-}"
  if [[ -z "$branch" ]]; then
    echo "VERCEL_GIT_COMMIT_REF is required for preview deploys" >&2
    exit 1
  fi
  # Claim by a hyphenated name. The CLI defaults to the raw git ref (which may
  # contain slashes). Reusing that identifier after a failed first provision can
  # keep later Vercel builds attached to a half-created preview backend.
  preview_name="${branch//\//-}"
  echo "Convex preview name: $preview_name"
  args+=(--preview-name "$preview_name")
fi

exec pnpm exec convex "${args[@]}"

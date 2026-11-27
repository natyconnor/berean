#!/usr/bin/env bash
# Vercel build: deploy Convex, then Vite, with VITE_CONVEX_URL set to the
# deployment that was just claimed, then start post-deploy backfills.
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

pnpm exec convex "${args[@]}"

# Let testers load a small sample set (#353 F29, `/memory?previewSeed=…`). The
# server allows it only where this flag is set, so production never gets it.
# Non-fatal: without the flag, small sets fail with a clear error.
if [[ "${VERCEL_ENV:-}" == "preview" ]]; then
  pnpm exec convex env set BEREAN_ALLOW_PREVIEW_SEED 1 \
    --preview-name "$preview_name" ||
    echo "Couldn't set BEREAN_ALLOW_PREVIEW_SEED; previewSeed will be rejected" >&2
fi

# Build every user's note totals row (#353) on the deployment just pushed, so
# open tabs never wait on a missing row. The mutation runs one batch and
# schedules the rest, so this returns quickly. Rerun by hand with the same
# command. With a preview deploy key, --preview-name picks that preview; with
# the production key, --prod (the key's own deployment).
run_args=(
  run migrations:backfillNoteMilestones '{}'
  --codegen disable
  --typecheck disable
)
if [[ "${VERCEL_ENV:-}" == "preview" ]]; then
  run_args+=(--preview-name "$preview_name")
else
  run_args+=(--prod)
fi

for attempt in 1 2 3; do
  if pnpm exec convex "${run_args[@]}"; then
    exit 0
  fi
  echo "backfillNoteMilestones kickoff failed (attempt $attempt)" >&2
  sleep 5
done
echo "backfillNoteMilestones kickoff failed after 3 attempts" >&2
exit 1

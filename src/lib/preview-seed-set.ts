import {
  PREVIEW_MEMORY_PACKS,
  PREVIEW_MEMORY_VERSE_IDS,
} from "./preview-memory-seed";
import { buildPreviewPassagePacks } from "./preview-passage-seed";

/**
 * A preview small set (#353 F29): `/memory?previewSeed=john-3-16,sample-mix`
 * seeds just those verses and packs instead of the full sample.
 */
export interface PreviewSeedSet {
  verseIds: ReadonlySet<string>;
  packSlugs: ReadonlySet<string>;
  passagePackIds: ReadonlySet<string>;
}

/** Comma-separated `previewSeed` tokens; undefined when none are given. */
export function parsePreviewSeedTokens(raw: unknown): string[] | undefined {
  if (typeof raw !== "string") return undefined;
  const tokens = raw
    .split(",")
    .map((token) => token.trim())
    .filter(Boolean);
  return tokens.length > 0 ? tokens : undefined;
}

/**
 * Resolve tokens to what gets seeded. A verse pack brings its verses; a verse
 * brings only itself. Any unknown token throws, so nothing is written.
 */
export function resolvePreviewSeedSet(
  tokens: readonly string[],
): PreviewSeedSet {
  if (tokens.length === 0) throw new Error("No sample items were named.");
  const verseIds = new Set<string>();
  const packSlugs = new Set<string>();
  const passagePackIds = new Set<string>();
  // Ids only; the deployment's own pack list is checked when seeding.
  const passageIds = new Set(
    buildPreviewPassagePacks(0, 0, undefined).map((pack) => pack.id),
  );
  const unknown: string[] = [];

  for (const token of tokens) {
    const pack = PREVIEW_MEMORY_PACKS.find((p) => p.slug === token);
    if (pack) {
      packSlugs.add(pack.slug);
      for (const id of pack.verseIds) verseIds.add(id);
    } else if (PREVIEW_MEMORY_VERSE_IDS.includes(token)) {
      verseIds.add(token);
    } else if (passageIds.has(token)) {
      passagePackIds.add(token);
    } else {
      unknown.push(token);
    }
  }

  if (unknown.length > 0) {
    throw new Error(`Unknown sample items: ${unknown.join(", ")}`);
  }
  return { verseIds, packSlugs, passagePackIds };
}

/** Convex env var that `scripts/vercel-build.sh` sets on preview deployments only. */
export const PREVIEW_SEED_FLAG = "BEREAN_ALLOW_PREVIEW_SEED";

/**
 * A small set loads only on a Convex preview deployment (F31). Fails closed:
 * production, dev and an unset flag all reject, anonymous users included.
 */
export function assertPreviewSeedSetAllowed(flag: string | undefined): void {
  if (flag === "1" || flag === "true") return;
  throw new Error("Sample subsets load only on preview deployments.");
}

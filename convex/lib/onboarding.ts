import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";

/**
 * Hard cap on how many notes we scan when computing onboarding milestones.
 * Reading mode requires knowing whether the library has at least 12 notes,
 * so anything larger than `READING_MIN_TOTAL_NOTES + 1` is enough information.
 * We choose a slightly larger ceiling so distinct-tag counts remain meaningful.
 */
const NOTE_SCAN_LIMIT = 30;

export interface OnboardingMilestonesSnapshot {
  notesCount: number;
  taggedNotesCount: number;
  distinctTagCount: number;
  heartsCount: number;
  hasInlineVerseLink: boolean;
  hasExplicitVerseLink: boolean;
  starterTagCount: number;
  customTagCount: number;
}

export interface UserHintRecord {
  hintId: string;
  shownAt?: number;
  completedAt?: number;
  dismissedAt?: number;
}

export const EMPTY_MILESTONES: OnboardingMilestonesSnapshot = {
  notesCount: 0,
  taggedNotesCount: 0,
  distinctTagCount: 0,
  heartsCount: 0,
  hasInlineVerseLink: false,
  hasExplicitVerseLink: false,
  starterTagCount: 0,
  customTagCount: 0,
};

/**
 * Compute a bounded snapshot of the user's library for milestone gating. The
 * counts are capped (notes via NOTE_SCAN_LIMIT, links/hearts via `.first()`)
 * because we only need binary-style comparisons against thresholds.
 */
export async function computeOnboardingMilestones(
  ctx: QueryCtx,
  userId: Id<"users">,
): Promise<OnboardingMilestonesSnapshot> {
  const notes = await ctx.db
    .query("notes")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .take(NOTE_SCAN_LIMIT);

  let taggedNotesCount = 0;
  const distinctTags = new Set<string>();
  for (const note of notes) {
    if (note.tags.length === 0) continue;
    taggedNotesCount += 1;
    for (const tag of note.tags) distinctTags.add(tag);
  }

  const inlineLink = await ctx.db
    .query("noteInlineVerseLinks")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .first();
  const explicitLink = await ctx.db
    .query("noteVerseLinks")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .first();
  const firstHeart = await ctx.db
    .query("savedVerses")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .first();

  let heartsCount = 0;
  if (firstHeart) {
    const recentHearts = await ctx.db
      .query("savedVerses")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .take(2);
    heartsCount = recentHearts.length;
  }

  const userTags = await ctx.db
    .query("userTags")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .collect();
  let starterTagCount = 0;
  let customTagCount = 0;
  for (const row of userTags) {
    if (row.source === "starter") starterTagCount += 1;
    else if (row.source === "custom") customTagCount += 1;
  }

  return {
    notesCount: notes.length,
    taggedNotesCount,
    distinctTagCount: distinctTags.size,
    heartsCount,
    hasInlineVerseLink: inlineLink !== null,
    hasExplicitVerseLink: explicitLink !== null,
    starterTagCount,
    customTagCount,
  };
}

export function summarizeHints(
  rows: Doc<"userFeatureHints">[],
): UserHintRecord[] {
  return rows.map((row) => ({
    hintId: row.hintId,
    shownAt: row.shownAt,
    completedAt: row.completedAt,
    dismissedAt: row.dismissedAt,
  }));
}

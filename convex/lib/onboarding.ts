import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

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

/** Note totals stored on `userOnboardingMilestones`. */
export interface NoteMilestoneCounts {
  notesCount: number;
  taggedNotesCount: number;
  tagCounts: { tag: string; count: number }[];
}

const EMPTY_NOTE_COUNTS: NoteMilestoneCounts = {
  notesCount: 0,
  taggedNotesCount: 0,
  tagCounts: [],
};

/**
 * Apply one note write to the totals. `before` / `after` are the note's tags,
 * or null when the note did not exist before / no longer exists after.
 */
export function applyNoteChange(
  counts: NoteMilestoneCounts,
  before: readonly string[] | null,
  after: readonly string[] | null,
): NoteMilestoneCounts {
  let { notesCount, taggedNotesCount } = counts;
  const tagCounts = new Map(
    counts.tagCounts.map((row) => [row.tag, row.count]),
  );
  const shift = (tags: readonly string[], delta: 1 | -1) => {
    notesCount += delta;
    if (tags.length > 0) taggedNotesCount += delta;
    for (const tag of new Set(tags)) {
      const next = (tagCounts.get(tag) ?? 0) + delta;
      if (next > 0) tagCounts.set(tag, next);
      else tagCounts.delete(tag);
    }
  };
  if (before) shift(before, -1);
  if (after) shift(after, 1);
  return {
    notesCount,
    taggedNotesCount,
    tagCounts: Array.from(tagCounts, ([tag, count]) => ({ tag, count })),
  };
}

export function countNotes(
  notes: readonly { tags: readonly string[] }[],
): NoteMilestoneCounts {
  return notes.reduce(
    (counts, note) => applyNoteChange(counts, null, note.tags),
    EMPTY_NOTE_COUNTS,
  );
}

async function loadNoteMilestonesRow(
  ctx: QueryCtx,
  userId: Id<"users">,
): Promise<Doc<"userOnboardingMilestones"> | null> {
  return await ctx.db
    .query("userOnboardingMilestones")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .unique();
}

/** Recount every note and write the user's row. Run after the note writes. */
export async function rebuildNoteMilestones(
  ctx: MutationCtx,
  userId: Id<"users">,
): Promise<void> {
  const notes = await ctx.db
    .query("notes")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .collect();
  const row = await loadNoteMilestonesRow(ctx, userId);
  const next = { ...countNotes(notes), updatedAt: Date.now() };
  if (row) await ctx.db.patch(row._id, next);
  else await ctx.db.insert("userOnboardingMilestones", { userId, ...next });
}

/** Build the row once for users who had notes before it existed. */
export async function ensureNoteMilestonesRow(
  ctx: MutationCtx,
  userId: Id<"users">,
): Promise<void> {
  if (await loadNoteMilestonesRow(ctx, userId)) return;
  await rebuildNoteMilestones(ctx, userId);
}

/**
 * Keep the row in step with one note write. Call after the write: a missing
 * row is rebuilt from the notes, which already include this change.
 */
export async function recordNoteChange(
  ctx: MutationCtx,
  userId: Id<"users">,
  before: readonly string[] | null,
  after: readonly string[] | null,
): Promise<void> {
  if (before && after && sameTags(before, after)) return;
  const row = await loadNoteMilestonesRow(ctx, userId);
  if (!row) {
    await rebuildNoteMilestones(ctx, userId);
    return;
  }
  await ctx.db.patch(row._id, {
    ...applyNoteChange(row, before, after),
    updatedAt: Date.now(),
  });
}

function sameTags(a: readonly string[], b: readonly string[]): boolean {
  const left = new Set(a);
  const right = new Set(b);
  return left.size === right.size && [...left].every((tag) => right.has(tag));
}

/**
 * Snapshot of the user's library for milestone gating. Note and tag totals
 * come from one `userOnboardingMilestones` row, never from note documents;
 * links/hearts stay bounded via `.first()` because we only need comparisons
 * against thresholds. Returns null until `ensureNoteMilestones` has built the
 * row, so callers wait instead of showing a library as empty.
 */
export async function computeOnboardingMilestones(
  ctx: QueryCtx,
  userId: Id<"users">,
): Promise<OnboardingMilestonesSnapshot | null> {
  const noteCounts = await loadNoteMilestonesRow(ctx, userId);
  if (!noteCounts) return null;

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
    notesCount: noteCounts.notesCount,
    taggedNotesCount: noteCounts.taggedNotesCount,
    distinctTagCount: noteCounts.tagCounts.length,
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

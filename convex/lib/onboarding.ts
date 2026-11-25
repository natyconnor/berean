import { internal } from "../_generated/api";
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
  start: NoteMilestoneCounts = EMPTY_NOTE_COUNTS,
): NoteMilestoneCounts {
  return notes.reduce(
    (counts, note) => applyNoteChange(counts, null, note.tags),
    start,
  );
}

/** Notes counted per recount transaction, to stay under read limits. */
export const NOTE_RECOUNT_PAGE_SIZE = 500;

async function loadNoteMilestonesRow(
  ctx: QueryCtx,
  userId: Id<"users">,
): Promise<Doc<"userOnboardingMilestones"> | null> {
  return await ctx.db
    .query("userOnboardingMilestones")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .unique();
}

/**
 * Count the next page of the user's notes into their row, creating an
 * unfinished row (no `builtAt`) if there is none. Returns true once the row is
 * complete.
 *
 * Notes are walked in `by_userId` order (by `_creationTime`, unique per table)
 * from `scannedThrough`, the last note counted. Writers only apply their own
 * change to an unfinished row when the note is at or behind that mark, so each
 * note is counted once, in its latest state, however writes and pages
 * interleave.
 */
export async function recountNoteMilestonesPage(
  ctx: MutationCtx,
  userId: Id<"users">,
): Promise<boolean> {
  const row = await loadNoteMilestonesRow(ctx, userId);
  if (row?.builtAt !== undefined) return true;

  const scannedThrough = row?.scannedThrough ?? 0;
  const notes = await ctx.db
    .query("notes")
    .withIndex("by_userId", (q) =>
      q.eq("userId", userId).gt("_creationTime", scannedThrough),
    )
    .take(NOTE_RECOUNT_PAGE_SIZE);
  const done = notes.length < NOTE_RECOUNT_PAGE_SIZE;
  const now = Date.now();
  const next = {
    ...countNotes(notes, row ?? EMPTY_NOTE_COUNTS),
    updatedAt: now,
    builtAt: done ? now : undefined,
    scannedThrough: done ? undefined : notes[notes.length - 1]._creationTime,
  };
  if (row) await ctx.db.patch(row._id, next);
  else await ctx.db.insert("userOnboardingMilestones", { userId, ...next });
  return done;
}

/**
 * Build the user's row if it is missing or unfinished: count one page now and
 * schedule the rest. Safe to call repeatedly; extra calls only repeat pages
 * from the saved mark.
 */
export async function ensureNoteMilestonesRow(
  ctx: MutationCtx,
  userId: Id<"users">,
): Promise<void> {
  if (await recountNoteMilestonesPage(ctx, userId)) return;
  await ctx.scheduler.runAfter(0, internal.onboarding.recountNoteMilestones, {
    userId,
  });
}

/** Drop the row and count again, after a bulk rewrite of the user's notes. */
export async function resetNoteMilestones(
  ctx: MutationCtx,
  userId: Id<"users">,
): Promise<void> {
  const row = await loadNoteMilestonesRow(ctx, userId);
  if (row) await ctx.db.delete(row._id);
  await ensureNoteMilestonesRow(ctx, userId);
}

/**
 * Keep the row in step with one note write. Call after the write, with the
 * note as it was before (or as inserted). Without a row, starts a recount,
 * which counts the note in its current state.
 */
export async function recordNoteChange(
  ctx: MutationCtx,
  userId: Id<"users">,
  note: Doc<"notes">,
  before: readonly string[] | null,
  after: readonly string[] | null,
): Promise<void> {
  if (before && after && sameTags(before, after)) return;
  const row = await loadNoteMilestonesRow(ctx, userId);
  if (!row) {
    await ensureNoteMilestonesRow(ctx, userId);
    return;
  }
  const aheadOfRecount =
    row.builtAt === undefined && note._creationTime > (row.scannedThrough ?? 0);
  if (aheadOfRecount) return;
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
  if (noteCounts?.builtAt === undefined) return null;

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

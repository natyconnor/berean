import { query, mutation, type QueryCtx } from "./_generated/server";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { getCurrentUserId, getCurrentUserIdOrNull } from "./lib/auth";
import { findOrCreateVerseRefId } from "./lib/verseRefs";
import { heartSpanIfAbsent, loadUserHeartSpans } from "./lib/savedVerses";
import {
  adjustUserMemoryStats,
  deletePackMembershipsForVerse,
  findSavedVerse,
  findVerseMemory,
} from "./lib/verseMemory";
import { getVerseRefBoundsErrorMessage } from "../shared/verse-ref-validation";
import {
  exactSpanMatch,
  HEART_MANY_CHUNK,
  overlappingSpans,
} from "../src/lib/hearted-verse-coverage";

/**
 * The verse's live memory schedule, when a `verseMemory` row exists. Included
 * so the reader can decorate the heart with a mastery ring (see
 * `masteryRingFraction`) without a per-verse follow-up query — the join happens
 * inside this single per-chapter query.
 */
const savedMemoryValidator = v.object({
  status: v.union(
    v.literal("new"),
    v.literal("learning"),
    v.literal("reviewing"),
    v.literal("mastered"),
  ),
  learnStage: v.number(),
  stageReps: v.optional(v.number()),
  intervalDays: v.number(),
  dueAt: v.number(),
  lastReviewedAt: v.optional(v.number()),
});

const savedVerseListItem = v.object({
  _id: v.id("savedVerses"),
  verseRefId: v.id("verseRefs"),
  book: v.string(),
  chapter: v.number(),
  startVerse: v.number(),
  endVerse: v.number(),
  createdAt: v.number(),
  memory: v.optional(savedMemoryValidator),
});

type SavedVerseListItem = {
  _id: Id<"savedVerses">;
  verseRefId: Id<"verseRefs">;
  book: string;
  chapter: number;
  startVerse: number;
  endVerse: number;
  createdAt: number;
  memory?: {
    status: Doc<"verseMemory">["status"];
    learnStage: number;
    stageReps?: number;
    intervalDays: number;
    dueAt: number;
    lastReviewedAt?: number;
  };
};

async function toListItem(
  ctx: QueryCtx,
  row: Doc<"savedVerses">,
  userId: Id<"users">,
): Promise<SavedVerseListItem | null> {
  const ref = await ctx.db.get(row.verseRefId);
  if (!ref || ref.userId !== userId) {
    return null;
  }
  const memory = await findVerseMemory(ctx, userId, row.verseRefId);
  return {
    _id: row._id,
    verseRefId: row.verseRefId,
    book: ref.book,
    chapter: ref.chapter,
    startVerse: ref.startVerse,
    endVerse: ref.endVerse,
    createdAt: row.createdAt,
    memory: memory
      ? {
          status: memory.status,
          learnStage: memory.learnStage,
          stageReps: memory.stageReps,
          intervalDays: memory.intervalDays,
          dueAt: memory.dueAt,
          lastReviewedAt: memory.lastReviewedAt,
        }
      : undefined,
  };
}

export const listForChapter = query({
  args: { book: v.string(), chapter: v.number() },
  returns: v.array(savedVerseListItem),
  handler: async (ctx, args) => {
    const userId = await getCurrentUserIdOrNull(ctx);
    if (!userId) {
      return [];
    }

    const rows = await ctx.db
      .query("savedVerses")
      .withIndex("by_userId_book_chapter", (q) =>
        q
          .eq("userId", userId)
          .eq("book", args.book)
          .eq("chapter", args.chapter),
      )
      .collect();

    const items: SavedVerseListItem[] = [];

    for (const row of rows) {
      const item = await toListItem(ctx, row, userId);
      if (item) {
        items.push(item);
      }
    }

    return items;
  },
});

export const listAll = query({
  args: {},
  returns: v.array(savedVerseListItem),
  handler: async (ctx) => {
    const userId = await getCurrentUserIdOrNull(ctx);
    if (!userId) {
      return [];
    }

    const rows = await ctx.db
      .query("savedVerses")
      .withIndex("by_userId_createdAt", (q) => q.eq("userId", userId))
      .collect();

    rows.sort((a, b) => b.createdAt - a.createdAt);

    const items: SavedVerseListItem[] = [];

    for (const row of rows) {
      const item = await toListItem(ctx, row, userId);
      if (item) {
        items.push(item);
      }
    }

    return items;
  },
});

export const toggle = mutation({
  args: {
    book: v.string(),
    chapter: v.number(),
    startVerse: v.number(),
    endVerse: v.number(),
  },
  returns: v.union(v.literal("added"), v.literal("removed")),
  handler: async (ctx, args) => {
    const userId = await getCurrentUserId(ctx);

    const boundsError = getVerseRefBoundsErrorMessage({
      book: args.book,
      chapter: args.chapter,
      startVerse: args.startVerse,
      endVerse: args.endVerse,
    });
    if (boundsError) {
      throw new Error(boundsError);
    }

    const span = {
      book: args.book,
      chapter: args.chapter,
      startVerse: args.startVerse,
      endVerse: args.endVerse,
    };
    const verseRefId = await findOrCreateVerseRefId(ctx, userId, span);
    const existing = await findSavedVerse(ctx, userId, verseRefId);

    if (existing) {
      // Un-hearting removes the bookmark and drops the verse from Memory:
      // pack membership is deleted, isHearted is cleared, but spaced-repetition
      // progress and review history on verseMemory survive for a later re-heart.
      await ctx.db.delete(existing._id);
      const memory = await findVerseMemory(ctx, userId, verseRefId);
      if (memory) {
        if (memory.isHearted === true) {
          await adjustUserMemoryStats(
            ctx,
            userId,
            Date.now(),
            memory.status,
            null,
          );
        }
        await ctx.db.patch(memory._id, { isHearted: false });
      }
      await deletePackMembershipsForVerse(ctx, userId, verseRefId);
      return "removed" as const;
    }

    // Hearting a verse seeds its memory record (idempotent: a re-heart after
    // un-hearting reuses the existing row rather than creating a duplicate).
    await heartSpanIfAbsent(ctx, userId, span, Date.now());
    return "added" as const;
  },
});

const heartManySpan = v.object({
  book: v.string(),
  chapter: v.number(),
  startVerse: v.number(),
  endVerse: v.number(),
});

export const heartMany = mutation({
  args: {
    spans: v.array(heartManySpan),
    now: v.number(),
  },
  returns: v.object({
    added: v.number(),
    skippedExact: v.number(),
    skippedOverlap: v.number(),
    skippedInvalid: v.number(),
  }),
  handler: async (ctx, args) => {
    const userId = await getCurrentUserId(ctx);

    if (args.spans.length > HEART_MANY_CHUNK) {
      throw new Error(
        `heartMany accepts at most ${HEART_MANY_CHUNK} spans per call.`,
      );
    }

    if (args.spans.length === 0) {
      return {
        added: 0,
        skippedExact: 0,
        skippedOverlap: 0,
        skippedInvalid: 0,
      };
    }

    const userHearts = await loadUserHeartSpans(ctx, userId);
    let added = 0;
    let skippedExact = 0;
    let skippedOverlap = 0;
    let skippedInvalid = 0;

    for (const span of args.spans) {
      const boundsError = getVerseRefBoundsErrorMessage(span);
      if (boundsError) {
        skippedInvalid += 1;
        continue;
      }

      if (exactSpanMatch(span, userHearts)) {
        skippedExact += 1;
        continue;
      }

      if (overlappingSpans(span, userHearts).length > 0) {
        skippedOverlap += 1;
        continue;
      }

      const result = await heartSpanIfAbsent(ctx, userId, span, args.now);
      if (result === "exists") {
        skippedExact += 1;
        continue;
      }

      userHearts.push(span);
      added += 1;
    }

    return { added, skippedExact, skippedOverlap, skippedInvalid };
  },
});

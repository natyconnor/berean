import { query, mutation, type QueryCtx } from "./_generated/server";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { getCurrentUserId, getCurrentUserIdOrNull } from "./lib/auth";
import { findOrCreateVerseRefId } from "./lib/verseRefs";
import { findVerseMemory, seedVerseMemory } from "./lib/verseMemory";
import { getVerseRefBoundsErrorMessage } from "../shared/verse-ref-validation";

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

    const verseRefId = await findOrCreateVerseRefId(ctx, userId, {
      book: args.book,
      chapter: args.chapter,
      startVerse: args.startVerse,
      endVerse: args.endVerse,
    });

    const existing = await ctx.db
      .query("savedVerses")
      .withIndex("by_userId_verseRefId", (q) =>
        q.eq("userId", userId).eq("verseRefId", verseRefId),
      )
      .unique();

    if (existing) {
      // Un-hearting removes the bookmark but intentionally leaves any
      // `verseMemory` row untouched, so spaced-repetition progress and review
      // history survive a heart toggle. See docs/study-mode.md.
      await ctx.db.delete(existing._id);
      const memory = await findVerseMemory(ctx, userId, verseRefId);
      if (memory) {
        await ctx.db.patch(memory._id, { isHearted: false });
      }
      return "removed" as const;
    }

    const now = Date.now();
    await ctx.db.insert("savedVerses", {
      userId,
      verseRefId,
      book: args.book,
      chapter: args.chapter,
      createdAt: now,
    });

    // Hearting a verse seeds its memory record (idempotent: a re-heart after
    // un-hearting reuses the existing row rather than creating a duplicate).
    await seedVerseMemory(ctx, userId, verseRefId, now);

    return "added" as const;
  },
});

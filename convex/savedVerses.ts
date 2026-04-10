import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { getCurrentUserId, getCurrentUserIdOrNull } from "./lib/auth";
import { findOrCreateVerseRefId } from "./lib/verseRefs";
import { getVerseRefBoundsErrorMessage } from "../shared/verse-ref-validation";

const savedVerseListItem = v.object({
  _id: v.id("savedVerses"),
  verseRefId: v.id("verseRefs"),
  book: v.string(),
  chapter: v.number(),
  startVerse: v.number(),
  endVerse: v.number(),
  createdAt: v.number(),
});

async function toListItem(
  ctx: {
    db: { get: (id: Id<"verseRefs">) => Promise<Doc<"verseRefs"> | null> };
  },
  row: Doc<"savedVerses">,
  userId: Id<"users">,
): Promise<{
  _id: Id<"savedVerses">;
  verseRefId: Id<"verseRefs">;
  book: string;
  chapter: number;
  startVerse: number;
  endVerse: number;
  createdAt: number;
} | null> {
  const ref = await ctx.db.get(row.verseRefId);
  if (!ref || ref.userId !== userId) {
    return null;
  }
  return {
    _id: row._id,
    verseRefId: row.verseRefId,
    book: ref.book,
    chapter: ref.chapter,
    startVerse: ref.startVerse,
    endVerse: ref.endVerse,
    createdAt: row.createdAt,
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

    const items: Array<{
      _id: Id<"savedVerses">;
      verseRefId: Id<"verseRefs">;
      book: string;
      chapter: number;
      startVerse: number;
      endVerse: number;
      createdAt: number;
    }> = [];

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

    const items: Array<{
      _id: Id<"savedVerses">;
      verseRefId: Id<"verseRefs">;
      book: string;
      chapter: number;
      startVerse: number;
      endVerse: number;
      createdAt: number;
    }> = [];

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
      await ctx.db.delete(existing._id);
      return "removed" as const;
    }

    await ctx.db.insert("savedVerses", {
      userId,
      verseRefId,
      book: args.book,
      chapter: args.chapter,
      createdAt: Date.now(),
    });

    return "added" as const;
  },
});

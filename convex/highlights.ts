import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getCurrentUserId, getCurrentUserIdOrNull } from "./lib/auth";

const highlightValue = v.object({
  _id: v.id("highlights"),
  book: v.string(),
  chapter: v.number(),
  verse: v.number(),
  startOffset: v.number(),
  endOffset: v.number(),
  color: v.string(),
  createdAt: v.number(),
});

export const getForChapter = query({
  args: {
    book: v.string(),
    chapter: v.number(),
  },
  returns: v.array(highlightValue),
  handler: async (ctx, args) => {
    const userId = await getCurrentUserIdOrNull(ctx);
    if (!userId) return [];
    const rows = await ctx.db
      .query("highlights")
      .withIndex("by_userId_book_chapter", (q) =>
        q.eq("userId", userId).eq("book", args.book).eq("chapter", args.chapter),
      )
      .collect();
    return rows.map((row) => ({
      _id: row._id,
      book: row.book,
      chapter: row.chapter,
      verse: row.verse,
      startOffset: row.startOffset,
      endOffset: row.endOffset,
      color: row.color,
      createdAt: row.createdAt,
    }));
  },
});

export const create = mutation({
  args: {
    book: v.string(),
    chapter: v.number(),
    verse: v.number(),
    startOffset: v.number(),
    endOffset: v.number(),
    color: v.string(),
  },
  returns: v.id("highlights"),
  handler: async (ctx, args) => {
    const userId = await getCurrentUserId(ctx);
    return await ctx.db.insert("highlights", {
      userId,
      book: args.book,
      chapter: args.chapter,
      verse: args.verse,
      startOffset: args.startOffset,
      endOffset: args.endOffset,
      color: args.color,
      createdAt: Date.now(),
    });
  },
});

export const remove = mutation({
  args: { id: v.id("highlights") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getCurrentUserId(ctx);
    const highlight = await ctx.db.get(args.id);
    if (!highlight || highlight.userId !== userId) {
      throw new Error("Highlight not found or access denied");
    }
    await ctx.db.delete(args.id);
    return null;
  },
});

export const removeForVerse = mutation({
  args: {
    book: v.string(),
    chapter: v.number(),
    verse: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getCurrentUserId(ctx);
    const rows = await ctx.db
      .query("highlights")
      .withIndex("by_userId_book_chapter_verse", (q) =>
        q
          .eq("userId", userId)
          .eq("book", args.book)
          .eq("chapter", args.chapter)
          .eq("verse", args.verse),
      )
      .collect();
    for (const row of rows) {
      await ctx.db.delete(row._id);
    }
    return null;
  },
});

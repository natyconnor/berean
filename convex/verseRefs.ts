import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getCurrentUserId, getCurrentUserIdOrNull } from "./lib/auth";
import { findOrCreateVerseRefId } from "./lib/verseRefs";

export const findOrCreate = mutation({
  args: {
    book: v.string(),
    chapter: v.number(),
    startVerse: v.number(),
    endVerse: v.number(),
  },
  returns: v.id("verseRefs"),
  handler: async (ctx, args) => {
    const userId = await getCurrentUserId(ctx);
    return await findOrCreateVerseRefId(ctx, userId, args);
  },
});

export const getByBookChapter = query({
  args: { book: v.string(), chapter: v.number() },
  returns: v.array(
    v.object({
      _id: v.id("verseRefs"),
      _creationTime: v.number(),
      userId: v.optional(v.id("users")),
      book: v.string(),
      chapter: v.number(),
      startVerse: v.number(),
      endVerse: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    const userId = await getCurrentUserIdOrNull(ctx);
    if (!userId) return [];
    return await ctx.db
      .query("verseRefs")
      .withIndex("by_userId_book_chapter", (q) =>
        q
          .eq("userId", userId)
          .eq("book", args.book)
          .eq("chapter", args.chapter),
      )
      .collect();
  },
});

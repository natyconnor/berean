import { query, mutation } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { v } from "convex/values";
import { getCurrentUserId, getCurrentUserIdOrNull } from "./lib/auth";
import { verseRefLinkValue, type VerseRefLink } from "./lib/publicValues";

function toVerseRefLink(ref: Doc<"verseRefs">): VerseRefLink {
  return {
    _id: ref._id,
    book: ref.book,
    chapter: ref.chapter,
    startVerse: ref.startVerse,
    endVerse: ref.endVerse,
  };
}

export const create = mutation({
  args: {
    verseRefId1: v.id("verseRefs"),
    verseRefId2: v.id("verseRefs"),
  },
  returns: v.id("verseLinks"),
  handler: async (ctx, args) => {
    const userId = await getCurrentUserId(ctx);

    const [id1, id2] =
      args.verseRefId1 < args.verseRefId2
        ? [args.verseRefId1, args.verseRefId2]
        : [args.verseRefId2, args.verseRefId1];

    const existing = await ctx.db
      .query("verseLinks")
      .withIndex("by_userId_verseRefId1", (q) =>
        q.eq("userId", userId).eq("verseRefId1", id1),
      )
      .collect();
    const match = existing.find((l) => l.verseRefId2 === id2);
    if (match) return match._id;

    return await ctx.db.insert("verseLinks", {
      userId,
      verseRefId1: id1,
      verseRefId2: id2,
    });
  },
});

export const getLinksForVerseRef = query({
  args: { verseRefId: v.id("verseRefs") },
  returns: v.array(verseRefLinkValue),
  handler: async (ctx, args) => {
    const userId = await getCurrentUserIdOrNull(ctx);
    if (!userId) return [];

    const asFirst = await ctx.db
      .query("verseLinks")
      .withIndex("by_userId_verseRefId1", (q) =>
        q.eq("userId", userId).eq("verseRefId1", args.verseRefId),
      )
      .collect();
    const asSecond = await ctx.db
      .query("verseLinks")
      .withIndex("by_userId_verseRefId2", (q) =>
        q.eq("userId", userId).eq("verseRefId2", args.verseRefId),
      )
      .collect();

    const linkedIds = [
      ...asFirst.map((l) => l.verseRefId2),
      ...asSecond.map((l) => l.verseRefId1),
    ];
    const linkedRefs = await Promise.all(linkedIds.map((id) => ctx.db.get(id)));
    return linkedRefs
      .filter((ref): ref is Doc<"verseRefs"> => !!ref && ref.userId === userId)
      .map(toVerseRefLink);
  },
});

export const remove = mutation({
  args: {
    verseRefId1: v.id("verseRefs"),
    verseRefId2: v.id("verseRefs"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getCurrentUserId(ctx);

    const [id1, id2] =
      args.verseRefId1 < args.verseRefId2
        ? [args.verseRefId1, args.verseRefId2]
        : [args.verseRefId2, args.verseRefId1];
    const links = await ctx.db
      .query("verseLinks")
      .withIndex("by_userId_verseRefId1", (q) =>
        q.eq("userId", userId).eq("verseRefId1", id1),
      )
      .collect();
    const link = links.find((l) => l.verseRefId2 === id2);
    if (link) await ctx.db.delete(link._id);
    return null;
  },
});

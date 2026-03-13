import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getCurrentUserId, getCurrentUserIdOrNull } from "./lib/auth";

export const create = mutation({
  args: {
    verseRefId1: v.id("verseRefs"),
    verseRefId2: v.id("verseRefs"),
  },
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
      .withIndex("by_verseRefId2", (q) => q.eq("verseRefId2", args.verseRefId))
      .filter((q) => q.eq(q.field("userId"), userId))
      .collect();

    const linkedIds = [
      ...asFirst.map((l) => l.verseRefId2),
      ...asSecond.map((l) => l.verseRefId1),
    ];
    const linkedRefs = await Promise.all(linkedIds.map((id) => ctx.db.get(id)));
    return linkedRefs.filter(Boolean);
  },
});

export const remove = mutation({
  args: {
    verseRefId1: v.id("verseRefs"),
    verseRefId2: v.id("verseRefs"),
  },
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
  },
});

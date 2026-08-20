import { mutation } from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { getCurrentUserId } from "./lib/auth";
import { findOrCreateVerseRefId } from "./lib/verseRefs";
import { adjustUserMemoryStats, seedVerseMemory } from "./lib/verseMemory";
import { isDueForLearning, isDueForReview } from "../src/lib/memory-scheduler";
import { buildPreviewMemorySeed } from "../src/lib/preview-memory-seed";

async function isAnonymousUser(
  ctx: MutationCtx,
  userId: Id<"users">,
): Promise<boolean> {
  const account = await ctx.db
    .query("authAccounts")
    .withIndex("userIdAndProvider", (q) =>
      q.eq("userId", userId).eq("provider", "anonymous"),
    )
    .unique();
  return account !== null;
}

/**
 * Preview/dev sample data is meant for throwaway accounts. On a production
 * Convex deployment we only allow anonymous users (Vercel preview auto-sign-in)
 * so a Google session that happens to open a preview URL cannot wipe real
 * hearted verses.
 */
async function assertPreviewMemorySeedAllowed(
  ctx: MutationCtx,
  userId: Id<"users">,
): Promise<void> {
  const deployment = process.env.CONVEX_DEPLOYMENT;
  if (!deployment?.startsWith("prod:")) return;
  if (await isAnonymousUser(ctx, userId)) return;
  throw new Error(
    "Sample memory data on production is limited to anonymous preview users.",
  );
}

async function clearUserMemory(ctx: MutationCtx, userId: Id<"users">) {
  const packs = await ctx.db
    .query("packs")
    .withIndex("by_userId_lastOpenedAt", (q) => q.eq("userId", userId))
    .collect();
  for (const pack of packs) {
    const members = await ctx.db
      .query("packVerses")
      .withIndex("by_packId", (q) => q.eq("packId", pack._id))
      .collect();
    for (const member of members) {
      await ctx.db.delete(member._id);
    }
    await ctx.db.delete(pack._id);
  }

  const reviews = await ctx.db
    .query("verseMemoryReviews")
    .withIndex("by_userId_createdAt", (q) => q.eq("userId", userId))
    .collect();
  for (const review of reviews) {
    await ctx.db.delete(review._id);
  }

  const memories = await ctx.db
    .query("verseMemory")
    .withIndex("by_userId_dueAt", (q) => q.eq("userId", userId))
    .collect();
  for (const memory of memories) {
    await ctx.db.delete(memory._id);
  }

  const saved = await ctx.db
    .query("savedVerses")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .collect();
  for (const row of saved) {
    await ctx.db.delete(row._id);
  }

  const stats = await ctx.db
    .query("userMemoryStats")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .unique();
  if (stats) await ctx.db.delete(stats._id);
}

const seedSummaryValidator = v.object({
  verseCount: v.number(),
  packCount: v.number(),
  reviewLogCount: v.number(),
  dueReviewCount: v.number(),
  learningDueCount: v.number(),
  verses: v.array(
    v.object({
      id: v.string(),
      label: v.string(),
      howToTry: v.string(),
      book: v.string(),
      chapter: v.number(),
      startVerse: v.number(),
      endVerse: v.number(),
    }),
  ),
  packs: v.array(
    v.object({
      name: v.string(),
      description: v.string(),
      verseCount: v.number(),
    }),
  ),
});

export const seedPreviewMemory = mutation({
  args: { now: v.number() },
  returns: seedSummaryValidator,
  handler: async (ctx, args) => {
    const userId = await getCurrentUserId(ctx);
    await assertPreviewMemorySeedAllowed(ctx, userId);

    const plan = buildPreviewMemorySeed(args.now);
    await clearUserMemory(ctx, userId);

    const memoryIdByVerseId = new Map<string, Id<"verseMemory">>();
    const verseRefIdByVerseId = new Map<string, Id<"verseRefs">>();

    for (const verse of plan.verses) {
      const verseRefId = await findOrCreateVerseRefId(
        ctx,
        userId,
        verse.reference,
      );
      await ctx.db.insert("savedVerses", {
        userId,
        verseRefId,
        book: verse.reference.book,
        chapter: verse.reference.chapter,
        createdAt: args.now,
      });

      const memoryId = await seedVerseMemory(ctx, userId, verseRefId, args.now);
      const created = await ctx.db.get(memoryId);
      if (!created) throw new Error("Failed to seed verse memory");

      if (created.status !== verse.schedule.status) {
        await adjustUserMemoryStats(
          ctx,
          userId,
          args.now,
          created.status,
          verse.schedule.status,
        );
      }

      await ctx.db.patch(memoryId, {
        status: verse.schedule.status,
        learnStage: verse.schedule.learnStage,
        stageReps: verse.schedule.stageReps,
        ease: verse.schedule.ease,
        intervalDays: verse.schedule.intervalDays,
        dueAt: verse.schedule.dueAt,
        consecutiveCorrect: verse.schedule.consecutiveCorrect,
        lapses: verse.schedule.lapses,
        earlyReviewApplied: verse.schedule.earlyReviewApplied,
        lastReviewedAt: verse.lastReviewedAt,
        isHearted: true,
      });

      memoryIdByVerseId.set(verse.id, memoryId);
      verseRefIdByVerseId.set(verse.id, verseRefId);
    }

    for (const review of plan.reviews) {
      const verseRefId = verseRefIdByVerseId.get(review.verseId);
      const verseMemoryId = memoryIdByVerseId.get(review.verseId);
      if (!verseRefId || !verseMemoryId) continue;
      await ctx.db.insert("verseMemoryReviews", {
        userId,
        verseRefId,
        verseMemoryId,
        quality: review.quality,
        accuracy: review.accuracy,
        stage: review.stage,
        mode: review.mode,
        createdAt: review.createdAt,
      });
    }

    for (const pack of plan.packs) {
      const packId = await ctx.db.insert("packs", {
        userId,
        name: pack.name,
        kind: "custom",
        createdAt: args.now,
        lastOpenedAt: args.now,
      });
      let order = 0;
      for (const verseId of pack.verseIds) {
        const verseRefId = verseRefIdByVerseId.get(verseId);
        if (!verseRefId) continue;
        await ctx.db.insert("packVerses", {
          userId,
          packId,
          verseRefId,
          order,
          createdAt: args.now,
        });
        order += 1;
      }
    }

    const dueReviewCount = plan.verses.filter((verse) =>
      isDueForReview(verse.schedule, args.now),
    ).length;
    const learningDueCount = plan.verses.filter((verse) =>
      isDueForLearning(
        { ...verse.schedule, lastReviewedAt: verse.lastReviewedAt },
        args.now,
      ),
    ).length;

    return {
      verseCount: plan.verses.length,
      packCount: plan.packs.length,
      reviewLogCount: plan.reviews.length,
      dueReviewCount,
      learningDueCount,
      verses: plan.verses.map((verse) => ({
        id: verse.id,
        label: verse.label,
        howToTry: verse.howToTry,
        book: verse.reference.book,
        chapter: verse.reference.chapter,
        startVerse: verse.reference.startVerse,
        endVerse: verse.reference.endVerse,
      })),
      packs: plan.packs.map((pack) => ({
        name: pack.name,
        description: pack.description,
        verseCount: pack.verseIds.length,
      })),
    };
  },
});

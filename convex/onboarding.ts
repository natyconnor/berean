import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { getCurrentUserId, getCurrentUserIdOrNull } from "./lib/auth";
import {
  EMPTY_MILESTONES,
  computeOnboardingMilestones,
  summarizeHints,
} from "./lib/onboarding";
import { resolveTutorialStatus } from "./lib/tutorial";

const milestonesValue = v.object({
  notesCount: v.number(),
  taggedNotesCount: v.number(),
  distinctTagCount: v.number(),
  heartsCount: v.number(),
  hasInlineVerseLink: v.boolean(),
  hasExplicitVerseLink: v.boolean(),
  starterTagCount: v.number(),
  customTagCount: v.number(),
});

const hintRecordValue = v.object({
  hintId: v.string(),
  shownAt: v.optional(v.number()),
  completedAt: v.optional(v.number()),
  dismissedAt: v.optional(v.number()),
});

const onboardingStatusValue = v.object({
  mainTutorialCompletedAt: v.optional(v.number()),
  advancedSearchTutorialCompletedAt: v.optional(v.number()),
  focusModeTutorialCompletedAt: v.optional(v.number()),
  categoryColors: v.record(v.string(), v.string()),
  milestones: milestonesValue,
  hints: v.array(hintRecordValue),
});

export const getOnboardingStatus = query({
  args: {},
  returns: onboardingStatusValue,
  handler: async (ctx) => {
    const userId = await getCurrentUserIdOrNull(ctx);
    if (!userId) {
      const tutorial = resolveTutorialStatus(null);
      return {
        ...tutorial,
        milestones: EMPTY_MILESTONES,
        hints: [],
      };
    }

    const settings = await ctx.db
      .query("userSettings")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .first();

    const milestones = await computeOnboardingMilestones(ctx, userId);
    const hints = await ctx.db
      .query("userFeatureHints")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .collect();

    return {
      ...resolveTutorialStatus(settings),
      milestones,
      hints: summarizeHints(hints),
    };
  },
});

async function upsertHint(
  ctx: MutationCtx,
  userId: Id<"users">,
  hintId: string,
  patch: {
    shownAt?: number;
    completedAt?: number;
    dismissedAt?: number;
  },
) {
  const now = Date.now();
  const existing = await ctx.db
    .query("userFeatureHints")
    .withIndex("by_userId_hintId", (q) =>
      q.eq("userId", userId).eq("hintId", hintId),
    )
    .first();

  if (existing) {
    await ctx.db.patch(existing._id, {
      ...patch,
      updatedAt: now,
    });
    return;
  }

  await ctx.db.insert("userFeatureHints", {
    userId,
    hintId,
    ...patch,
    createdAt: now,
    updatedAt: now,
  });
}

export const markHintShown = mutation({
  args: { hintId: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getCurrentUserId(ctx);
    await upsertHint(ctx, userId, args.hintId, { shownAt: Date.now() });
    return null;
  },
});

export const completeHint = mutation({
  args: { hintId: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getCurrentUserId(ctx);
    await upsertHint(ctx, userId, args.hintId, { completedAt: Date.now() });
    return null;
  },
});

export const dismissHint = mutation({
  args: { hintId: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getCurrentUserId(ctx);
    await upsertHint(ctx, userId, args.hintId, { dismissedAt: Date.now() });
    return null;
  },
});

export const resetHint = mutation({
  args: { hintId: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getCurrentUserId(ctx);
    const existing = await ctx.db
      .query("userFeatureHints")
      .withIndex("by_userId_hintId", (q) =>
        q.eq("userId", userId).eq("hintId", args.hintId),
      )
      .first();
    if (existing) {
      await ctx.db.delete(existing._id);
    }
    return null;
  },
});

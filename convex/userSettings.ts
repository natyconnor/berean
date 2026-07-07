import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { getCurrentUserId, getCurrentUserIdOrNull } from "./lib/auth";
import { resolveTutorialStatus } from "./lib/tutorial";

const HEX_COLOR_PATTERN = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

async function getOrCreateUserSettings(
  ctx: Pick<MutationCtx, "db">,
  userId: Id<"users">,
  now: number,
) {
  const existing = await ctx.db
    .query("userSettings")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .first();
  if (existing) return existing;

  const settingsId = await ctx.db.insert("userSettings", {
    userId,
    createdAt: now,
    updatedAt: now,
  });
  return await ctx.db.get(settingsId);
}

const modeDockPreferenceValidator = v.union(
  v.literal("auto-hide"),
  v.literal("always"),
  v.literal("off"),
);

const DEFAULT_MODE_DOCK_PREFERENCE = "auto-hide" as const;

/** The user's Mode Dock behavior preference (defaults to "auto-hide"). */
export const getModeDockPreference = query({
  args: {},
  returns: modeDockPreferenceValidator,
  handler: async (ctx) => {
    const userId = await getCurrentUserIdOrNull(ctx);
    if (!userId) {
      return DEFAULT_MODE_DOCK_PREFERENCE;
    }

    const settings = await ctx.db
      .query("userSettings")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .first();

    return settings?.modeDock ?? DEFAULT_MODE_DOCK_PREFERENCE;
  },
});

export const setModeDockPreference = mutation({
  args: { mode: modeDockPreferenceValidator },
  returns: modeDockPreferenceValidator,
  handler: async (ctx, args) => {
    const userId = await getCurrentUserId(ctx);
    const now = Date.now();
    const settings = await getOrCreateUserSettings(ctx, userId, now);

    if (!settings) {
      throw new Error("Unable to initialize user settings");
    }

    await ctx.db.patch(settings._id, {
      modeDock: args.mode,
      updatedAt: now,
    });

    return args.mode;
  },
});

const tutorialStatusValue = v.object({
  mainTutorialCompletedAt: v.optional(v.number()),
  advancedSearchTutorialCompletedAt: v.optional(v.number()),
  focusModeTutorialCompletedAt: v.optional(v.number()),
  categoryColors: v.record(v.string(), v.string()),
});

export const getTutorialStatus = query({
  args: {},
  returns: tutorialStatusValue,
  handler: async (ctx) => {
    const userId = await getCurrentUserIdOrNull(ctx);
    if (!userId) {
      return resolveTutorialStatus(null);
    }

    const settings = await ctx.db
      .query("userSettings")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .first();

    return resolveTutorialStatus(settings);
  },
});

export const completeMainTutorial = mutation({
  args: {},
  returns: v.object({
    completedAt: v.number(),
  }),
  handler: async (ctx) => {
    const userId = await getCurrentUserId(ctx);
    const now = Date.now();
    const settings = await getOrCreateUserSettings(ctx, userId, now);

    if (!settings) {
      throw new Error("Unable to initialize user settings");
    }

    await ctx.db.patch(settings._id, {
      mainOnboardingCompletedAt: now,
      updatedAt: now,
    });

    return {
      completedAt: now,
    };
  },
});

export const completeAdvancedSearchTutorial = mutation({
  args: {},
  returns: v.object({
    completedAt: v.number(),
  }),
  handler: async (ctx) => {
    const userId = await getCurrentUserId(ctx);
    const now = Date.now();
    const settings = await getOrCreateUserSettings(ctx, userId, now);

    if (!settings) {
      throw new Error("Unable to initialize user settings");
    }

    await ctx.db.patch(settings._id, {
      advancedSearchOnboardingCompletedAt: now,
      updatedAt: now,
    });

    return {
      completedAt: now,
    };
  },
});

export const completeFocusModeTutorial = mutation({
  args: {},
  returns: v.object({
    completedAt: v.number(),
  }),
  handler: async (ctx) => {
    const userId = await getCurrentUserId(ctx);
    const now = Date.now();
    const settings = await getOrCreateUserSettings(ctx, userId, now);

    if (!settings) {
      throw new Error("Unable to initialize user settings");
    }

    await ctx.db.patch(settings._id, {
      focusModeOnboardingCompletedAt: now,
      updatedAt: now,
    });

    return {
      completedAt: now,
    };
  },
});

export const setStarterTagCategoryColor = mutation({
  args: {
    categoryId: v.string(),
    color: v.string(),
  },
  returns: v.object({
    categoryColors: v.record(v.string(), v.string()),
  }),
  handler: async (ctx, args) => {
    const userId = await getCurrentUserId(ctx);
    const now = Date.now();
    const settings = await getOrCreateUserSettings(ctx, userId, now);

    if (!settings) {
      throw new Error("Unable to initialize user settings");
    }
    if (!HEX_COLOR_PATTERN.test(args.color)) {
      throw new Error("Invalid color format");
    }

    const nextColors = {
      ...(settings.starterTagCategoryColors ?? {}),
      [args.categoryId]: args.color,
    };

    await ctx.db.patch(settings._id, {
      starterTagCategoryColors: nextColors,
      updatedAt: now,
    });

    return {
      categoryColors: nextColors,
    };
  },
});

import { query, mutation, type MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import type { Doc, Id } from "./_generated/dataModel";
import { getCurrentUserId, getCurrentUserIdOrNull } from "./lib/auth";
import { findOrCreateVerseRefId } from "./lib/verseRefs";
import {
  adjustUserMemoryStats,
  findVerseMemory,
  isLiveHeartedMemory,
  seedVerseMemory,
} from "./lib/verseMemory";
import {
  filterScopeMembers,
  loadCustomMembers,
  loadHeartedMembers,
  loadOwnedPack,
  loadPackMembers,
  nextPackOrder,
  type PackMember,
} from "./lib/packs";
import { getVerseRefBoundsErrorMessage } from "../shared/verse-ref-validation";
import {
  isDueForReview,
  isLearningPhase,
  isReviewPhase,
  type MemorySchedule,
} from "../src/lib/memory-scheduler";
import {
  applyUnifiedGrade,
  canonicalUnifiedSchedule,
} from "../src/lib/unified-review-schedule";
import { scopesEqual } from "../src/lib/scope-equality";
import { packAllowsUnifiedRecitation } from "../src/lib/contiguous-spans";
import { verseMatchesScope } from "../src/lib/verse-scope-match";

/**
 * A pack is a per-user named verse set. `scope` packs resolve their members
 * LIVE from `savedVerses` ∩ scope; `custom` packs store explicit ordered
 * membership rows in `packVerses`. Pack membership is hearted-only: unhearting
 * a verse removes it from all custom packs.
 */

const kindValidator = v.union(v.literal("scope"), v.literal("custom"));

const statusValidator = v.union(
  v.literal("new"),
  v.literal("learning"),
  v.literal("reviewing"),
  v.literal("mastered"),
);

// Identical shape to studySessions.scope (verbatim). Present only on scope packs.
const scopeValidator = v.object({
  books: v.array(v.string()),
  chapterRanges: v.optional(
    v.array(
      v.object({
        book: v.string(),
        startChapter: v.number(),
        endChapter: v.number(),
      }),
    ),
  ),
  tags: v.array(v.string()),
  tagMatchMode: v.union(v.literal("any"), v.literal("all")),
});

const packValidator = v.object({
  _id: v.id("packs"),
  name: v.string(),
  kind: kindValidator,
  scope: v.optional(scopeValidator),
  createdAt: v.number(),
  lastOpenedAt: v.number(),
  unifiedReviewEnabled: v.optional(v.boolean()),
});

const packListItem = v.object({
  _id: v.id("packs"),
  name: v.string(),
  kind: kindValidator,
  verseCount: v.number(),
  dueCount: v.number(),
  lastOpenedAt: v.number(),
  unifiedReviewEnabled: v.optional(v.boolean()),
});

const qualityValidator = v.union(
  v.literal("exact"),
  v.literal("close"),
  v.literal("off"),
);

const memoryScheduleValidator = v.object({
  status: statusValidator,
  learnStage: v.number(),
  stageReps: v.number(),
  ease: v.number(),
  intervalDays: v.number(),
  dueAt: v.number(),
  consecutiveCorrect: v.number(),
  lapses: v.number(),
  earlyReviewApplied: v.boolean(),
});

const packMemberValidator = v.object({
  verseRefId: v.id("verseRefs"),
  book: v.string(),
  chapter: v.number(),
  startVerse: v.number(),
  endVerse: v.number(),
  status: statusValidator,
  learnStage: v.number(),
  stageReps: v.number(),
  ease: v.number(),
  intervalDays: v.number(),
  consecutiveCorrect: v.number(),
  lapses: v.number(),
  earlyReviewApplied: v.optional(v.boolean()),
  dueAt: v.number(),
  lastReviewedAt: v.optional(v.number()),
  isDue: v.boolean(),
});

export const create = mutation({
  args: {
    name: v.string(),
    kind: kindValidator,
    scope: v.optional(scopeValidator),
  },
  returns: v.id("packs"),
  handler: async (ctx, args) => {
    const userId = await getCurrentUserId(ctx);

    if (args.kind === "scope" && !args.scope) {
      throw new Error("Scope packs require a scope");
    }
    if (args.kind === "custom" && args.scope) {
      throw new Error("Custom packs cannot have a scope");
    }

    const now = Date.now();

    // Scope packs are identified by their filter. Reuse the most recently
    // opened pack with the same scope so "Memorize this scope" is idempotent.
    if (args.kind === "scope" && args.scope) {
      const existingPacks = await ctx.db
        .query("packs")
        .withIndex("by_userId_lastOpenedAt", (q) => q.eq("userId", userId))
        .order("desc")
        .collect();
      const match = existingPacks.find(
        (pack) =>
          pack.kind === "scope" &&
          pack.scope !== undefined &&
          scopesEqual(pack.scope, args.scope!),
      );
      if (match) {
        await ctx.db.patch(match._id, { lastOpenedAt: now });
        return match._id;
      }
    }

    return await ctx.db.insert("packs", {
      userId,
      name: args.name,
      kind: args.kind,
      scope: args.kind === "scope" ? args.scope : undefined,
      createdAt: now,
      lastOpenedAt: now,
    });
  },
});

export const listMine = query({
  args: { paginationOpts: paginationOptsValidator, now: v.number() },
  returns: v.object({
    page: v.array(packListItem),
    isDone: v.boolean(),
    continueCursor: v.string(),
    splitCursor: v.optional(v.union(v.string(), v.null())),
    pageStatus: v.optional(
      v.union(
        v.literal("SplitRecommended"),
        v.literal("SplitRequired"),
        v.null(),
      ),
    ),
  }),
  handler: async (ctx, args) => {
    const userId = await getCurrentUserIdOrNull(ctx);
    if (!userId) {
      return { page: [], isDone: true, continueCursor: "" };
    }

    const paginated = await ctx.db
      .query("packs")
      .withIndex("by_userId_lastOpenedAt", (q) => q.eq("userId", userId))
      .order("desc")
      .paginate(args.paginationOpts);

    if (paginated.page.length === 0) {
      return { ...paginated, page: [] };
    }

    // Lightweight list counts: one savedVerses pass + hearted memory map for
    // scope packs; custom packs count membership rows (hearted-filtered).
    const saved = await ctx.db
      .query("savedVerses")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .collect();
    const memories = await ctx.db
      .query("verseMemory")
      .withIndex("by_userId_isHearted", (q) =>
        q.eq("userId", userId).eq("isHearted", true),
      )
      .collect();
    const memoryByRef = new Map(
      memories.map((m) => [m.verseRefId, m] as const),
    );

    const page = [];
    for (const pack of paginated.page) {
      let verseCount = 0;
      let dueCount = 0;

      if (pack.kind === "scope" && pack.scope) {
        for (const row of saved) {
          if (
            !verseMatchesScope(
              { book: row.book, chapter: row.chapter },
              pack.scope,
            )
          ) {
            continue;
          }
          verseCount += 1;
          const memory = memoryByRef.get(row.verseRefId);
          if (memory && isDueForReview(memory, args.now)) {
            dueCount += 1;
          }
        }
      } else {
        const members = await loadCustomMembers(ctx, userId, pack._id);
        verseCount = members.length;
        for (const m of members) {
          if (isDueForReview(m, args.now)) dueCount += 1;
        }
      }

      if (pack.unifiedReviewEnabled && verseCount > 0) {
        dueCount = dueCount > 0 ? 1 : 0;
      }

      page.push({
        _id: pack._id,
        name: pack.name,
        kind: pack.kind,
        verseCount,
        dueCount,
        lastOpenedAt: pack.lastOpenedAt,
        unifiedReviewEnabled: pack.unifiedReviewEnabled,
      });
    }

    return { ...paginated, page };
  },
});

export const get = query({
  args: { id: v.id("packs") },
  returns: v.union(packValidator, v.null()),
  handler: async (ctx, args) => {
    const userId = await getCurrentUserIdOrNull(ctx);
    if (!userId) return null;

    const pack = await loadOwnedPack(ctx, args.id, userId);
    if (!pack) return null;

    return {
      _id: pack._id,
      name: pack.name,
      kind: pack.kind,
      scope: pack.scope,
      createdAt: pack.createdAt,
      lastOpenedAt: pack.lastOpenedAt,
      unifiedReviewEnabled: pack.unifiedReviewEnabled,
    };
  },
});

export const rename = mutation({
  args: { id: v.id("packs"), name: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getCurrentUserId(ctx);
    const pack = await loadOwnedPack(ctx, args.id, userId);
    if (!pack) throw new Error("Pack not found");
    await ctx.db.patch(args.id, { name: args.name });
    return null;
  },
});

export const remove = mutation({
  args: { id: v.id("packs") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getCurrentUserId(ctx);
    const pack = await loadOwnedPack(ctx, args.id, userId);
    if (!pack) throw new Error("Pack not found");

    // Delete the pack and its membership rows only. Hearts (`savedVerses`) and
    // spaced-repetition progress (`verseMemory`) are intentionally preserved.
    const members = await ctx.db
      .query("packVerses")
      .withIndex("by_packId", (q) => q.eq("packId", args.id))
      .collect();
    for (const member of members) {
      await ctx.db.delete(member._id);
    }
    await ctx.db.delete(args.id);
    return null;
  },
});

export const touch = mutation({
  args: { id: v.id("packs") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getCurrentUserId(ctx);
    const pack = await loadOwnedPack(ctx, args.id, userId);
    if (!pack) return null;
    await ctx.db.patch(args.id, { lastOpenedAt: Date.now() });
    return null;
  },
});

export const addVerse = mutation({
  args: {
    id: v.id("packs"),
    book: v.string(),
    chapter: v.number(),
    startVerse: v.number(),
    endVerse: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getCurrentUserId(ctx);
    const pack = await loadOwnedPack(ctx, args.id, userId);
    if (!pack) throw new Error("Pack not found");

    const boundsError = getVerseRefBoundsErrorMessage({
      book: args.book,
      chapter: args.chapter,
      startVerse: args.startVerse,
      endVerse: args.endVerse,
    });
    if (boundsError) {
      throw new Error(boundsError);
    }

    if (
      pack.kind === "scope" &&
      (!pack.scope ||
        !verseMatchesScope(
          { book: args.book, chapter: args.chapter },
          pack.scope,
        ))
    ) {
      throw new Error("That verse is outside this pack's scope.");
    }

    const verseRefId = await findOrCreateVerseRefId(ctx, userId, {
      book: args.book,
      chapter: args.chapter,
      startVerse: args.startVerse,
      endVerse: args.endVerse,
    });
    const now = Date.now();

    // Invariant: pack members are hearted. Heart the verse if not already, and
    // seed its memory row (idempotent) so it participates in spaced repetition.
    const existingSaved = await ctx.db
      .query("savedVerses")
      .withIndex("by_userId_verseRefId", (q) =>
        q.eq("userId", userId).eq("verseRefId", verseRefId),
      )
      .unique();
    if (!existingSaved) {
      await ctx.db.insert("savedVerses", {
        userId,
        verseRefId,
        book: args.book,
        chapter: args.chapter,
        createdAt: now,
      });
    }
    await seedVerseMemory(ctx, userId, verseRefId, now);

    // Scope packs resolve members live, so they need no membership row. Custom
    // packs append the verse to their explicit ordered membership (idempotent).
    if (pack.kind === "custom") {
      const existingMember = await ctx.db
        .query("packVerses")
        .withIndex("by_userId_packId_verseRefId", (q) =>
          q
            .eq("userId", userId)
            .eq("packId", args.id)
            .eq("verseRefId", verseRefId),
        )
        .unique();
      if (!existingMember) {
        const order = await nextPackOrder(ctx, userId, args.id);
        await ctx.db.insert("packVerses", {
          userId,
          packId: args.id,
          verseRefId,
          order,
          createdAt: now,
        });
      }
    }

    return null;
  },
});

export const removeVerse = mutation({
  args: { id: v.id("packs"), verseRefId: v.id("verseRefs") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getCurrentUserId(ctx);
    const pack = await loadOwnedPack(ctx, args.id, userId);
    if (!pack) throw new Error("Pack not found");
    if (pack.kind !== "custom") {
      throw new Error("Can only remove verses from custom packs");
    }

    // Removes membership only; the verse stays hearted (and in Memory).
    const member = await ctx.db
      .query("packVerses")
      .withIndex("by_userId_packId_verseRefId", (q) =>
        q
          .eq("userId", userId)
          .eq("packId", args.id)
          .eq("verseRefId", args.verseRefId),
      )
      .unique();
    if (member) {
      await ctx.db.delete(member._id);
    }
    return null;
  },
});

export const resolveMembers = query({
  args: { id: v.id("packs"), now: v.number() },
  returns: v.array(packMemberValidator),
  handler: async (ctx, args) => {
    const userId = await getCurrentUserIdOrNull(ctx);
    if (!userId) return [];

    const pack = await loadOwnedPack(ctx, args.id, userId);
    if (!pack) return [];

    const members = await loadPackMembers(ctx, userId, pack);

    return members.map((m) => ({
      ...m,
      isDue: isDueForReview(m, args.now),
    }));
  },
});

/**
 * Queue every `new` member of a pack for learning, so the whole set can be
 * learned in one session instead of one span at a time.
 *
 * Only `new` rows move: they become `learning` and due now, keeping their
 * (zero) learn band and reps. Rows already learning, reviewing, or mastered
 * keep their schedule untouched, which also makes a repeat call enroll 0.
 */
export const enrollLearning = mutation({
  args: { id: v.id("packs"), now: v.number() },
  returns: v.object({ enrolled: v.number() }),
  handler: async (ctx, args) => {
    const userId = await getCurrentUserId(ctx);
    const pack = await loadOwnedPack(ctx, args.id, userId);
    if (!pack) throw new Error("Pack not found");

    const members = await loadPackMembers(ctx, userId, pack);

    let enrolled = 0;
    for (const member of members) {
      if (member.status !== "new") continue;

      const memory = await findVerseMemory(ctx, userId, member.verseRefId);
      if (!memory || memory.status !== "new") continue;

      await ctx.db.patch(memory._id, { status: "learning", dueAt: args.now });
      if (isLiveHeartedMemory(memory)) {
        await adjustUserMemoryStats(ctx, userId, args.now, "new", "learning");
      }
      enrolled += 1;
    }

    return { enrolled };
  },
});

export const previewScopeCount = query({
  args: { scope: scopeValidator, now: v.number() },
  returns: v.object({ verseCount: v.number(), dueCount: v.number() }),
  handler: async (ctx, args) => {
    const userId = await getCurrentUserIdOrNull(ctx);
    if (!userId) return { verseCount: 0, dueCount: 0 };

    const hearted = await loadHeartedMembers(ctx, userId);
    const members = filterScopeMembers(hearted, args.scope);

    let dueCount = 0;
    for (const m of members) {
      if (isDueForReview(m, args.now)) dueCount += 1;
    }
    return { verseCount: members.length, dueCount };
  },
});

function toSchedule(member: PackMember): MemorySchedule {
  return {
    status: member.status,
    learnStage: member.learnStage,
    stageReps: member.stageReps,
    ease: member.ease,
    intervalDays: member.intervalDays,
    dueAt: member.dueAt,
    consecutiveCorrect: member.consecutiveCorrect,
    lapses: member.lapses,
    earlyReviewApplied: member.earlyReviewApplied ?? false,
  };
}

async function patchMemberSchedule(
  ctx: MutationCtx,
  userId: Id<"users">,
  verseRefId: PackMember["verseRefId"],
  next: MemorySchedule,
  now: number,
  lastReviewedAt?: number,
): Promise<void> {
  const memory = await findVerseMemory(ctx, userId, verseRefId);
  if (!memory) return;

  if (memory.status !== next.status && isLiveHeartedMemory(memory)) {
    await adjustUserMemoryStats(ctx, userId, now, memory.status, next.status);
  }

  await ctx.db.patch(memory._id, {
    status: next.status,
    learnStage: next.learnStage,
    stageReps: next.stageReps,
    ease: next.ease,
    intervalDays: next.intervalDays,
    dueAt: next.dueAt,
    consecutiveCorrect: next.consecutiveCorrect,
    lapses: next.lapses,
    earlyReviewApplied: next.earlyReviewApplied,
    ...(lastReviewedAt !== undefined ? { lastReviewedAt } : {}),
  });
}

/**
 * Turn unified recitation on or off for a scope pack. Enabling snapshots every
 * member onto a conservative due-now schedule. Disabling only clears the flag.
 */
export const setUnifiedReview = mutation({
  args: {
    id: v.id("packs"),
    enabled: v.boolean(),
    now: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getCurrentUserId(ctx);
    const pack = await loadOwnedPack(ctx, args.id, userId);
    if (!pack) throw new Error("Pack not found");

    if (!args.enabled) {
      await ctx.db.patch(args.id, { unifiedReviewEnabled: false });
      return null;
    }

    if (pack.kind !== "scope") {
      throw new Error("Unified review is only available for scope packs");
    }

    const members = await loadPackMembers(ctx, userId, pack);
    if (members.length < 2) {
      throw new Error("Unified review needs more than one hearted member");
    }
    if (!pack.scope) {
      throw new Error("Unified review is only available for scope packs");
    }
    const memberSpans = members.map((member) => ({
      book: member.book,
      chapter: member.chapter,
      startVerse: member.startVerse,
      endVerse: member.endVerse,
    }));
    if (!packAllowsUnifiedRecitation(memberSpans, pack.scope)) {
      throw new Error("Unified review needs a contiguous passage");
    }
    if (!members.every((member) => isReviewPhase(member.status))) {
      throw new Error(
        "Unified review requires every member to be in review phase",
      );
    }

    const canonical = canonicalUnifiedSchedule(
      members.map(toSchedule),
      args.now,
    );
    for (const member of members) {
      await patchMemberSchedule(
        ctx,
        userId,
        member.verseRefId,
        canonical,
        args.now,
      );
    }
    await ctx.db.patch(args.id, { unifiedReviewEnabled: true });
    return null;
  },
});

/**
 * Record one recitation grade onto every member of a unified pack. Members
 * share the resulting schedule. Heatmap logs one review per member.
 */
export const recordUnifiedReview = mutation({
  args: {
    id: v.id("packs"),
    quality: qualityValidator,
    accuracy: v.number(),
    now: v.number(),
    wordCount: v.number(),
    tzOffsetMinutes: v.optional(v.number()),
    durationMs: v.optional(v.number()),
  },
  returns: memoryScheduleValidator,
  handler: async (ctx, args) => {
    const userId = await getCurrentUserId(ctx);
    const pack = await loadOwnedPack(ctx, args.id, userId);
    if (!pack) throw new Error("Pack not found");
    if (!pack.unifiedReviewEnabled) {
      throw new Error("Unified review is not enabled for this pack");
    }
    if (pack.kind !== "scope") {
      throw new Error("Unified review is only available for scope packs");
    }

    const members = await loadPackMembers(ctx, userId, pack);
    if (members.length === 0) {
      throw new Error("Cannot record a unified review on an empty pack");
    }
    if (members.some((member) => isLearningPhase(member.status))) {
      throw new Error(
        "Cannot record a unified review while any member is still learning",
      );
    }

    const memories: Array<{
      member: PackMember;
      memory: Doc<"verseMemory">;
    }> = [];
    for (const member of members) {
      const memory = await findVerseMemory(ctx, userId, member.verseRefId);
      if (!memory) {
        throw new Error("Unified review is missing a verse memory row");
      }
      memories.push({ member, memory });
    }

    const canonical = canonicalUnifiedSchedule(
      members.map(toSchedule),
      args.now,
    );
    const next = applyUnifiedGrade(canonical, {
      quality: args.quality,
      accuracy: args.accuracy,
      mode: "review",
      now: args.now,
      wordCount: args.wordCount,
      tzOffsetMinutes: args.tzOffsetMinutes,
    });

    for (const { member, memory } of memories) {
      await ctx.db.insert("verseMemoryReviews", {
        userId,
        verseRefId: member.verseRefId,
        verseMemoryId: memory._id,
        quality: args.quality,
        accuracy: args.accuracy,
        stage: memory.learnStage,
        mode: "review",
        durationMs: args.durationMs,
        createdAt: args.now,
      });

      await patchMemberSchedule(
        ctx,
        userId,
        member.verseRefId,
        next,
        args.now,
        args.now,
      );
    }

    return next;
  },
});

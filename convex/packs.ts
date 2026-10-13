import { query, mutation, type MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import type { Doc, Id } from "./_generated/dataModel";
import { getCurrentUserId, getCurrentUserIdOrNull } from "./lib/auth";
import { findVerseRefId } from "./lib/verseRefs";
import {
  adjustUserMemoryStats,
  findVerseMemory,
  isInMemory,
} from "./lib/verseMemory";
import { memorizeSpan, stopMemorizingPack } from "./lib/memorize";
import {
  filterScopeMembers,
  loadCustomMembers,
  loadInMemoryMembers,
  loadOwnedPack,
  loadPackMembers,
  nextPackOrder,
  type PackMember,
} from "./lib/packs";
import {
  deletePassageAndReviews,
  findPassageByPackId,
} from "./lib/passageMemory";
import { loadPassageDueRecords, passageDueByPackId } from "./lib/passageDue";
import { passageStatusValidator } from "./lib/passageValues";
import {
  isPassageDueForReview,
  isProjectedPassageDueForLearning,
} from "../src/lib/passage-due";
import {
  isDueForReview,
  isLearningPhase,
  isReviewPhase,
  holdReviewingInterval,
  type MemorySchedule,
} from "../src/lib/memory-scheduler";
import {
  applyUnifiedGrade,
  canonicalUnifiedSchedule,
} from "../src/lib/unified-review-schedule";
import { MEMORIZE_MAX_PACK_SPANS } from "../src/lib/memorize-status";
import { scopesEqual } from "../src/lib/scope-equality";
import { packAllowsUnifiedRecitation } from "../src/lib/contiguous-spans";
import { verseMatchesScope } from "../src/lib/verse-scope-match";
import {
  MEMORY_PRESETS,
  chapterPresetScope,
  getMemoryPreset,
  passagesForCollectionStart,
  type PresetPassage,
} from "../shared/memory-presets";

/**
 * A pack is a per-user named verse set. `scope` packs resolve their members
 * LIVE from the in-Memory verses ∩ scope; `custom` packs store explicit ordered
 * membership rows in `packVerses`, and their members are the rows whose verse
 * is in Memory. Rows survive stopping and unhearting, so memorizing a verse
 * again restores its membership.
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
  passageStatus: v.optional(passageStatusValidator),
  solidCount: v.optional(v.number()),
  attachedCount: v.optional(v.number()),
  pieceCount: v.optional(v.number()),
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
  args: {
    paginationOpts: paginationOptsValidator,
    now: v.number(),
    tzOffsetMinutes: v.number(),
  },
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

    // Lightweight list counts: one in-Memory member pass for scope packs;
    // custom packs count membership rows whose verse is in Memory.
    const needsInMemory = paginated.page.some(
      (pack) => pack.kind === "scope" && pack.scope,
    );
    const inMemory = needsInMemory
      ? await loadInMemoryMembers(ctx, userId)
      : [];
    const passageByPackId = passageDueByPackId(
      await loadPassageDueRecords(ctx, userId, args.now),
    );

    const page = [];
    for (const pack of paginated.page) {
      let verseCount = 0;
      let dueCount = 0;

      if (pack.kind === "scope" && pack.scope) {
        for (const member of inMemory) {
          if (
            !verseMatchesScope(
              { book: member.book, chapter: member.chapter },
              pack.scope,
            )
          ) {
            continue;
          }
          verseCount += 1;
          if (isDueForReview(member, args.now)) dueCount += 1;
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

      const passage = passageByPackId.get(pack._id);
      if (passage) {
        page.push({
          _id: pack._id,
          name: pack.name,
          kind: pack.kind,
          verseCount,
          dueCount:
            isPassageDueForReview(passage, args.now) ||
            isProjectedPassageDueForLearning(
              passage,
              args.now,
              args.tzOffsetMinutes,
            )
              ? 1
              : 0,
          lastOpenedAt: pack.lastOpenedAt,
          unifiedReviewEnabled: pack.unifiedReviewEnabled,
          passageStatus: passage.status,
          solidCount: passage.solidCount,
          attachedCount: passage.attachedCount,
          pieceCount: passage.pieceCount,
        });
        continue;
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

    // Delete membership + passage overlay. Hearts (`savedVerses`) and
    // spaced-repetition progress (`verseMemory`) are intentionally preserved.
    const passage = await findPassageByPackId(ctx, args.id);
    if (passage && passage.userId === userId) {
      await deletePassageAndReviews(ctx, passage);
    }

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

/**
 * Stop memorizing a passage or pack, then delete the pack. A passage's
 * progress is cleared and its heart stays. A pack's members that are in no
 * other pack leave Memory with their progress kept.
 */
export const stopMemorizing = mutation({
  args: { id: v.id("packs"), now: v.number() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getCurrentUserId(ctx);
    const pack = await loadOwnedPack(ctx, args.id, userId);
    if (!pack) throw new Error("Pack not found");
    await stopMemorizingPack(ctx, userId, pack, args.now);
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

    const now = Date.now();
    // Pack members are in Memory (Up next until they start) and hearted.
    const { verseRefId } = await memorizeSpan(
      ctx,
      userId,
      {
        book: args.book,
        chapter: args.chapter,
        startVerse: args.startVerse,
        endVerse: args.endVerse,
      },
      now,
      { upNext: true },
    );

    // Scope packs resolve members live, so they need no membership row.
    if (pack.kind === "custom") {
      await appendPackVerse(ctx, userId, pack._id, verseRefId, now);
    }

    return null;
  },
});

/**
 * Append a verse to a custom pack's ordered membership (idempotent). Returns
 * whether a row was added.
 */
async function appendPackVerse(
  ctx: MutationCtx,
  userId: Id<"users">,
  packId: Id<"packs">,
  verseRefId: Id<"verseRefs">,
  now: number,
  order?: number,
): Promise<boolean> {
  const existingMember = await ctx.db
    .query("packVerses")
    .withIndex("by_userId_packId_verseRefId", (q) =>
      q.eq("userId", userId).eq("packId", packId).eq("verseRefId", verseRefId),
    )
    .unique();
  if (existingMember) return false;
  await ctx.db.insert("packVerses", {
    userId,
    packId,
    verseRefId,
    order: order ?? (await nextPackOrder(ctx, userId, packId)),
    createdAt: now,
  });
  return true;
}

const MAX_PACK_NAME_LENGTH = 80;

const spanValidator = v.object({
  book: v.string(),
  chapter: v.number(),
  startVerse: v.number(),
  endVerse: v.number(),
});

/**
 * Create a custom pack and memorize its spans as Up next, in the order given
 * (a repeated span joins once). Each span gets a heart when none covers it.
 */
export const createAndMemorize = mutation({
  args: {
    name: v.string(),
    spans: v.array(spanValidator),
    now: v.number(),
  },
  returns: v.object({ packId: v.id("packs") }),
  handler: async (ctx, args) => {
    const userId = await getCurrentUserId(ctx);

    const name = args.name.trim();
    if (name.length === 0 || name.length > MAX_PACK_NAME_LENGTH) {
      throw new Error(
        `Pack names must be 1 to ${MAX_PACK_NAME_LENGTH} characters.`,
      );
    }
    if (
      args.spans.length === 0 ||
      args.spans.length > MEMORIZE_MAX_PACK_SPANS
    ) {
      throw new Error(
        `A pack can start with 1 to ${MEMORIZE_MAX_PACK_SPANS} verses.`,
      );
    }

    const packId = await ctx.db.insert("packs", {
      userId,
      name,
      kind: "custom",
      createdAt: args.now,
      lastOpenedAt: args.now,
    });
    let order = 0;
    for (const span of args.spans) {
      const { verseRefId } = await memorizeSpan(ctx, userId, span, args.now, {
        upNext: true,
      });
      if (
        await appendPackVerse(ctx, userId, packId, verseRefId, args.now, order)
      ) {
        order += 1;
      }
    }
    return { packId };
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

    // Removes membership only; the verse stays hearted and in Memory.
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
      if (!memory || !isInMemory(memory) || memory.status !== "new") continue;

      await ctx.db.patch(memory._id, { status: "learning", dueAt: args.now });
      await adjustUserMemoryStats(ctx, userId, args.now, "new", "learning");
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

    const inMemory = await loadInMemoryMembers(ctx, userId);
    const members = filterScopeMembers(inMemory, args.scope);

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

  if (memory.status !== next.status && isInMemory(memory)) {
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
      throw new Error("Unified review needs more than one member");
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

/**
 * Spend a unified pack after the learner declines an 80%+ retry. Holds the
 * shared interval without logging another recitation.
 */
export const acceptRetryHold = mutation({
  args: {
    id: v.id("packs"),
    now: v.number(),
    tzOffsetMinutes: v.optional(v.number()),
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

    const canonical = canonicalUnifiedSchedule(
      members.map(toSchedule),
      args.now,
    );
    const next = holdReviewingInterval(
      canonical,
      args.now,
      args.tzOffsetMinutes,
    );

    for (const member of members) {
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

const presetProgressItem = v.object({
  presetId: v.string(),
  packId: v.union(v.id("packs"), v.null()),
  memorizedPassageIds: v.array(v.string()),
});

/** Memorize a collection passage as Up next and append it to the pack. */
async function memorizePassageIntoPack(
  ctx: MutationCtx,
  userId: Id<"users">,
  packId: Id<"packs">,
  passage: PresetPassage,
  order: number,
  now: number,
): Promise<void> {
  const { verseRefId } = await memorizeSpan(
    ctx,
    userId,
    {
      book: passage.book,
      chapter: passage.chapter,
      startVerse: passage.startVerse,
      endVerse: passage.endVerse,
    },
    now,
    { upNext: true },
  );
  await appendPackVerse(ctx, userId, packId, verseRefId, now, order);
}

function presetPackName(fallback: string, name: string | undefined): string {
  const trimmed = name?.trim();
  return trimmed ? trimmed : fallback;
}

/**
 * Start a catalog preset as a normal pack. Chapters become scope packs and
 * open into passage learning on the client. Collection passages are memorized
 * as Up next (and hearted) in pack order. A full collection is idempotent via
 * `presetId`. A subset becomes a new custom pack without `presetId`.
 */
export const startPreset = mutation({
  args: {
    presetId: v.string(),
    name: v.optional(v.string()),
    passageIds: v.optional(v.array(v.string())),
  },
  returns: v.object({
    packId: v.id("packs"),
    created: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const userId = await getCurrentUserId(ctx);
    const preset = getMemoryPreset(args.presetId);
    if (!preset) throw new Error("Unknown preset");
    const now = Date.now();

    if (preset.kind === "chapter") {
      const scope = chapterPresetScope(preset);
      const existing = await ctx.db
        .query("packs")
        .withIndex("by_userId_presetId", (q) =>
          q.eq("userId", userId).eq("presetId", preset.id),
        )
        .first();
      if (existing) {
        await ctx.db.patch(existing._id, { lastOpenedAt: now });
        return { packId: existing._id, created: false };
      }
      const owned = await ctx.db
        .query("packs")
        .withIndex("by_userId_lastOpenedAt", (q) => q.eq("userId", userId))
        .collect();
      const sameScope = owned.find(
        (pack) =>
          pack.kind === "scope" &&
          pack.scope !== undefined &&
          scopesEqual(pack.scope, scope),
      );
      if (sameScope) {
        await ctx.db.patch(sameScope._id, { lastOpenedAt: now });
        return { packId: sameScope._id, created: false };
      }
      const packId = await ctx.db.insert("packs", {
        userId,
        name: presetPackName(preset.title, args.name),
        kind: "scope",
        scope,
        presetId: preset.id,
        createdAt: now,
        lastOpenedAt: now,
      });
      return { packId, created: true };
    }

    let passages;
    let full;
    try {
      ({ passages, full } = passagesForCollectionStart(
        preset,
        args.passageIds,
      ));
    } catch {
      throw new Error("Unknown passage in this preset");
    }
    if (passages.length === 0) {
      throw new Error("Choose at least one passage");
    }

    if (full) {
      const existing = await ctx.db
        .query("packs")
        .withIndex("by_userId_presetId", (q) =>
          q.eq("userId", userId).eq("presetId", preset.id),
        )
        .first();
      if (existing) {
        await ctx.db.patch(existing._id, { lastOpenedAt: now });
        return { packId: existing._id, created: false };
      }
    }

    const packId = await ctx.db.insert("packs", {
      userId,
      name: presetPackName(preset.title, args.name),
      kind: "custom",
      ...(full ? { presetId: preset.id } : {}),
      createdAt: now,
      lastOpenedAt: now,
    });
    for (let index = 0; index < passages.length; index++) {
      await memorizePassageIntoPack(
        ctx,
        userId,
        packId,
        passages[index],
        index,
        now,
      );
    }
    return { packId, created: true };
  },
});

/** Which presets already have a pack, and which collection spans are in Memory. */
export const presetProgress = query({
  args: {},
  returns: v.array(presetProgressItem),
  handler: async (ctx) => {
    const userId = await getCurrentUserIdOrNull(ctx);
    if (!userId) return [];

    const owned = await ctx.db
      .query("packs")
      .withIndex("by_userId_lastOpenedAt", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();

    const items = [];
    for (const preset of MEMORY_PRESETS) {
      if (preset.kind === "chapter") {
        const scope = chapterPresetScope(preset);
        const match = owned.find(
          (pack) =>
            pack.presetId === preset.id ||
            (pack.kind === "scope" &&
              pack.scope !== undefined &&
              scopesEqual(pack.scope, scope)),
        );
        items.push({
          presetId: preset.id,
          packId: match?._id ?? null,
          memorizedPassageIds: [],
        });
        continue;
      }

      const match = owned.find(
        (pack) => pack.presetId === preset.id && pack.kind === "custom",
      );
      const memorizedPassageIds: string[] = [];
      for (const passage of preset.passages) {
        const verseRefId = await findVerseRefId(ctx, userId, passage);
        if (!verseRefId) continue;
        const memory = await findVerseMemory(ctx, userId, verseRefId);
        if (memory && isInMemory(memory)) memorizedPassageIds.push(passage.id);
      }
      items.push({
        presetId: preset.id,
        packId: match?._id ?? null,
        memorizedPassageIds,
      });
    }
    return items;
  },
});

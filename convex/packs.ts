import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { getCurrentUserId, getCurrentUserIdOrNull } from "./lib/auth";
import { findOrCreateVerseRefId } from "./lib/verseRefs";
import { seedVerseMemory } from "./lib/verseMemory";
import {
  filterScopeMembers,
  loadCustomMembers,
  loadHeartedMembers,
  loadOwnedPack,
  nextPackOrder,
  type PackMember,
} from "./lib/packs";
import { getVerseRefBoundsErrorMessage } from "../shared/verse-ref-validation";
import { isDueForReview } from "../src/lib/memory-scheduler";
import { scopesEqual } from "../src/lib/scope-equality";
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
});

const packListItem = v.object({
  _id: v.id("packs"),
  name: v.string(),
  kind: kindValidator,
  verseCount: v.number(),
  dueCount: v.number(),
  lastOpenedAt: v.number(),
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
  intervalDays: v.number(),
  dueAt: v.number(),
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

      page.push({
        _id: pack._id,
        name: pack.name,
        kind: pack.kind,
        verseCount,
        dueCount,
        lastOpenedAt: pack.lastOpenedAt,
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

    let members: PackMember[];
    if (pack.kind === "scope" && pack.scope) {
      const hearted = await loadHeartedMembers(ctx, userId);
      members = filterScopeMembers(hearted, pack.scope);
    } else {
      members = await loadCustomMembers(ctx, userId, args.id);
    }

    return members.map((m) => ({
      ...m,
      isDue: isDueForReview(m, args.now),
    }));
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

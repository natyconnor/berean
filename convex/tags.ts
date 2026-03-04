import { internalMutation, mutation, query } from "./_generated/server"
import { v } from "convex/values"
import type { Id } from "./_generated/dataModel"
import type { MutationCtx } from "./_generated/server"
import { getCurrentUserId, getCurrentUserIdOrNull } from "./lib/auth"
import { normalizeTag, normalizeTags, syncUserTagsFromNote } from "./lib/tags"

const DEFAULT_SUGGEST_LIMIT = 8
const MAX_SUGGEST_LIMIT = 20
const MAX_SUGGEST_SCAN = 300
const MAX_CATALOG_ITEMS = 500
const DEFAULT_BACKFILL_NOTE_LIMIT = 500
const MAX_BACKFILL_NOTE_LIMIT = 2000

const tagCatalogItem = v.object({
  tag: v.string(),
  label: v.string(),
  source: v.union(v.literal("custom"), v.literal("starter")),
  lastUsedAt: v.optional(v.number()),
})

function resolveLimit(limit: number | undefined, defaultLimit: number, maxLimit: number): number {
  if (typeof limit !== "number" || Number.isNaN(limit)) return defaultLimit
  return Math.min(Math.max(Math.floor(limit), 1), maxLimit)
}

async function runUserTagBackfill(
  ctx: Pick<MutationCtx, "db">,
  userId: Id<"users">,
  noteLimit: number
): Promise<{ notesScanned: number; uniqueTagsSynced: number }> {
  const notes = await ctx.db
    .query("notes")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .take(noteLimit)

  const tagPool: string[] = []
  for (const note of notes) {
    tagPool.push(...note.tags)
  }

  const uniqueTags = normalizeTags(tagPool)
  await syncUserTagsFromNote(ctx, userId, uniqueTags, Date.now())

  return {
    notesScanned: notes.length,
    uniqueTagsSynced: uniqueTags.length,
  }
}

export const listCatalog = query({
  args: {},
  returns: v.array(tagCatalogItem),
  handler: async (ctx) => {
    const userId = await getCurrentUserIdOrNull(ctx)
    if (!userId) return []

    const rows = await ctx.db
      .query("userTags")
      .withIndex("by_userId_updatedAt", (q) => q.eq("userId", userId))
      .order("desc")
      .take(MAX_CATALOG_ITEMS)

    return rows
      .sort((a, b) => a.label.localeCompare(b.label))
      .map((row) => ({
        tag: row.tag,
        label: row.label,
        source: row.source,
        lastUsedAt: row.lastUsedAt,
      }))
  },
})

export const suggest = query({
  args: {
    query: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  returns: v.array(tagCatalogItem),
  handler: async (ctx, args) => {
    const userId = await getCurrentUserIdOrNull(ctx)
    if (!userId) return []

    const limit = resolveLimit(args.limit, DEFAULT_SUGGEST_LIMIT, MAX_SUGGEST_LIMIT)
    const prefix = normalizeTag(args.query ?? "")

    const candidates =
      prefix.length === 0
        ? await ctx.db
            .query("userTags")
            .withIndex("by_userId_updatedAt", (q) => q.eq("userId", userId))
            .order("desc")
            .take(limit)
        : await ctx.db
            .query("userTags")
            .withIndex("by_userId_updatedAt", (q) => q.eq("userId", userId))
            .order("desc")
            .take(MAX_SUGGEST_SCAN)

    const filtered =
      prefix.length === 0 ? candidates : candidates.filter((row) => row.tag.startsWith(prefix))

    return filtered
      .sort((a, b) => {
        const aRank = a.lastUsedAt ?? a.updatedAt
        const bRank = b.lastUsedAt ?? b.updatedAt
        if (aRank !== bRank) return bRank - aRank
        return a.label.localeCompare(b.label)
      })
      .slice(0, limit)
      .map((row) => ({
        tag: row.tag,
        label: row.label,
        source: row.source,
        lastUsedAt: row.lastUsedAt,
      }))
  },
})

export const addMany = mutation({
  args: {
    tags: v.array(v.string()),
    source: v.optional(v.union(v.literal("custom"), v.literal("starter"))),
  },
  returns: v.object({
    requested: v.number(),
    added: v.number(),
    updated: v.number(),
  }),
  handler: async (ctx, args) => {
    const userId = await getCurrentUserId(ctx)
    const now = Date.now()
    const normalizedTags = normalizeTags(args.tags)
    const source = args.source ?? "custom"

    let added = 0
    let updated = 0

    for (const tag of normalizedTags) {
      const existing = await ctx.db
        .query("userTags")
        .withIndex("by_userId_tag", (q) => q.eq("userId", userId).eq("tag", tag))
        .first()

      if (existing) {
        await ctx.db.patch(existing._id, {
          label: existing.label || tag,
          source: existing.source === "custom" ? "custom" : source,
          updatedAt: now,
        })
        updated += 1
        continue
      }

      await ctx.db.insert("userTags", {
        userId,
        tag,
        label: tag,
        source,
        createdAt: now,
        updatedAt: now,
      })
      added += 1
    }

    return {
      requested: normalizedTags.length,
      added,
      updated,
    }
  },
})

export const removeMany = mutation({
  args: { tags: v.array(v.string()) },
  returns: v.object({
    requested: v.number(),
    removed: v.number(),
  }),
  handler: async (ctx, args) => {
    const userId = await getCurrentUserId(ctx)
    const normalizedTags = normalizeTags(args.tags)
    let removed = 0

    for (const tag of normalizedTags) {
      const existing = await ctx.db
        .query("userTags")
        .withIndex("by_userId_tag", (q) => q.eq("userId", userId).eq("tag", tag))
        .first()
      if (!existing) continue
      await ctx.db.delete(existing._id)
      removed += 1
    }

    return {
      requested: normalizedTags.length,
      removed,
    }
  },
})

export const removeCustomTagAndDetach = mutation({
  args: { tag: v.string() },
  returns: v.object({
    removedFromCatalog: v.boolean(),
    notesUpdated: v.number(),
  }),
  handler: async (ctx, args) => {
    const userId = await getCurrentUserId(ctx)
    const tag = normalizeTag(args.tag)

    if (!tag) {
      throw new Error("Tag is required")
    }

    const existing = await ctx.db
      .query("userTags")
      .withIndex("by_userId_tag", (q) => q.eq("userId", userId).eq("tag", tag))
      .first()

    if (existing && existing.source !== "custom") {
      throw new Error("Only custom tags can be deleted here")
    }

    if (existing) {
      await ctx.db.delete(existing._id)
    }

    const notes = await ctx.db
      .query("notes")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .collect()

    const now = Date.now()
    let notesUpdated = 0
    for (const note of notes) {
      const normalizedNoteTags = normalizeTags(note.tags)
      if (!normalizedNoteTags.includes(tag)) continue

      const nextTags = normalizedNoteTags.filter((noteTag) => noteTag !== tag)
      await ctx.db.patch(note._id, {
        tags: nextTags,
        updatedAt: now,
      })
      notesUpdated += 1
    }

    return {
      removedFromCatalog: !!existing,
      notesUpdated,
    }
  },
})

export const backfillCatalogFromNotes = mutation({
  args: { noteLimit: v.optional(v.number()) },
  returns: v.object({
    notesScanned: v.number(),
    uniqueTagsSynced: v.number(),
  }),
  handler: async (ctx, args) => {
    const userId = await getCurrentUserId(ctx)
    const noteLimit = resolveLimit(
      args.noteLimit,
      DEFAULT_BACKFILL_NOTE_LIMIT,
      MAX_BACKFILL_NOTE_LIMIT
    )
    return await runUserTagBackfill(ctx, userId, noteLimit)
  },
})

export const backfillCatalogFromNotesInternal = internalMutation({
  args: {
    userId: v.id("users"),
    noteLimit: v.optional(v.number()),
  },
  returns: v.object({
    notesScanned: v.number(),
    uniqueTagsSynced: v.number(),
  }),
  handler: async (ctx, args) => {
    const noteLimit = resolveLimit(
      args.noteLimit,
      DEFAULT_BACKFILL_NOTE_LIMIT,
      MAX_BACKFILL_NOTE_LIMIT
    )
    return await runUserTagBackfill(ctx, args.userId, noteLimit)
  },
})

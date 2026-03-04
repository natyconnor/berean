import { query, mutation } from "./_generated/server"
import { v } from "convex/values"
import { getCurrentUserId, getCurrentUserIdOrNull } from "./lib/auth"
import { matchesTagFilters, normalizeTags, syncUserTagsFromNote } from "./lib/tags"

const DEFAULT_SEARCH_LIMIT = 50
const MAX_SEARCH_LIMIT = 100
const SEARCH_WINDOW_MULTIPLIER = 4
const MAX_SEARCH_WINDOW = 400

function resolveSearchLimit(limit: number | undefined): number {
  if (typeof limit !== "number" || Number.isNaN(limit)) return DEFAULT_SEARCH_LIMIT
  return Math.min(Math.max(Math.floor(limit), 1), MAX_SEARCH_LIMIT)
}

export const getById = query({
  args: { id: v.id("notes") },
  handler: async (ctx, args) => {
    const userId = await getCurrentUserIdOrNull(ctx)
    if (!userId) return null
    const note = await ctx.db.get(args.id)
    if (!note) return null
    if (note.userId !== userId) return null
    return note
  },
})

export const search = query({
  args: {
    query: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
    matchMode: v.optional(v.union(v.literal("any"), v.literal("all"))),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getCurrentUserIdOrNull(ctx)
    if (!userId) return []

    const queryText = args.query?.trim() ?? ""
    const selectedTags = normalizeTags(args.tags ?? [])
    const matchMode = args.matchMode ?? "any"
    const limit = resolveSearchLimit(args.limit)
    const searchWindow = Math.min(
      Math.max(limit * SEARCH_WINDOW_MULTIPLIER, DEFAULT_SEARCH_LIMIT),
      MAX_SEARCH_WINDOW
    )

    if (queryText.length < 2 && selectedTags.length === 0) {
      return []
    }

    const baseResults =
      queryText.length >= 2
        ? await ctx.db
            .query("notes")
            .withSearchIndex("search_content", (search) =>
              search.search("content", queryText).eq("userId", userId)
            )
            .take(searchWindow)
        : await ctx.db
            .query("notes")
            .withIndex("by_userId", (q) => q.eq("userId", userId))
            .order("desc")
            .take(searchWindow)

    return baseResults
      .filter((note) => matchesTagFilters(note.tags, selectedTags, matchMode))
      .slice(0, limit)
  },
})

export const allTags = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getCurrentUserIdOrNull(ctx)
    if (!userId) return []
    const notes = await ctx.db
      .query("notes")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .collect()
    const tagSet = new Set<string>()
    for (const note of notes) {
      for (const tag of note.tags) {
        tagSet.add(tag)
      }
    }
    return Array.from(tagSet).sort()
  },
})

export const create = mutation({
  args: { content: v.string(), tags: v.array(v.string()) },
  handler: async (ctx, args) => {
    const userId = await getCurrentUserId(ctx)
    const now = Date.now()
    const tags = normalizeTags(args.tags)
    const noteId = await ctx.db.insert("notes", {
      userId,
      content: args.content,
      tags,
      createdAt: now,
      updatedAt: now,
    })
    await syncUserTagsFromNote(ctx, userId, tags, now)
    return noteId
  },
})

export const update = mutation({
  args: {
    id: v.id("notes"),
    content: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const userId = await getCurrentUserId(ctx)
    const note = await ctx.db.get(args.id)
    if (!note || note.userId !== userId) {
      throw new Error("Note not found or access denied")
    }

    const now = Date.now()
    const patch: { content?: string; tags?: string[]; updatedAt: number } = {
      updatedAt: now,
    }
    if (args.content !== undefined) {
      patch.content = args.content
    }
    if (args.tags !== undefined) {
      patch.tags = normalizeTags(args.tags)
    }

    await ctx.db.patch(args.id, patch)

    if (patch.tags) {
      await syncUserTagsFromNote(ctx, userId, patch.tags, now)
    }
  },
})

export const remove = mutation({
  args: { id: v.id("notes") },
  handler: async (ctx, args) => {
    const userId = await getCurrentUserId(ctx)
    const note = await ctx.db.get(args.id)
    if (!note || note.userId !== userId) {
      throw new Error("Note not found or access denied")
    }
    const links = await ctx.db
      .query("noteVerseLinks")
      .withIndex("by_noteId", (q) => q.eq("noteId", args.id))
      .collect()
    for (const link of links) {
      await ctx.db.delete(link._id)
    }
    await ctx.db.delete(args.id)
  },
})

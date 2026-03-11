import { query, mutation, type MutationCtx } from "./_generated/server"
import { v } from "convex/values"
import type { Doc, Id } from "./_generated/dataModel"
import { getCurrentUserId, getCurrentUserIdOrNull } from "./lib/auth"
import { matchesTagFilters, normalizeTags, syncUserTagsFromNote } from "./lib/tags"
import {
  extractVerseRefsFromNoteBody,
  noteBodyToPlainText,
  noteBodyValue,
  type NoteBodyInput,
} from "./lib/noteContent"
import { findOrCreateVerseRefId } from "./lib/verseRefs"
import { getVerseRefBoundsErrorMessage } from "../src/lib/verse-ref-validation"

const DEFAULT_SEARCH_LIMIT = 50
const MAX_SEARCH_LIMIT = 100
const SEARCH_WINDOW_MULTIPLIER = 4
const MAX_SEARCH_WINDOW = 400
const MAX_WORKSPACE_RESULTS = 100

const verseRefSummary = v.object({
  book: v.string(),
  chapter: v.number(),
  startVerse: v.number(),
  endVerse: v.number(),
})

const noteBodySummary = v.union(noteBodyValue, v.null())

const workspaceSearchResult = v.object({
  noteId: v.id("notes"),
  content: v.string(),
  body: noteBodySummary,
  tags: v.array(v.string()),
  createdAt: v.number(),
  updatedAt: v.number(),
  verseRefs: v.array(verseRefSummary),
  primaryRef: v.union(verseRefSummary, v.null()),
})

function resolveSearchLimit(limit: number | undefined): number {
  if (typeof limit !== "number" || Number.isNaN(limit)) return DEFAULT_SEARCH_LIMIT
  return Math.min(Math.max(Math.floor(limit), 1), MAX_SEARCH_LIMIT)
}

function compareVerseRefs(
  a: { book: string; chapter: number; startVerse: number; endVerse: number },
  b: { book: string; chapter: number; startVerse: number; endVerse: number }
): number {
  const byBook = a.book.localeCompare(b.book)
  if (byBook !== 0) return byBook
  if (a.chapter !== b.chapter) return a.chapter - b.chapter
  if (a.startVerse !== b.startVerse) return a.startVerse - b.startVerse
  return a.endVerse - b.endVerse
}

function isVerseRefForUser(
  ref: Doc<"verseRefs"> | null,
  userId: Id<"users">
): ref is Doc<"verseRefs"> {
  return !!ref && ref.userId === userId
}

function formatInlineVerseRef(ref: {
  book: string
  chapter: number
  startVerse: number
  endVerse: number
}): string {
  if (ref.startVerse === ref.endVerse) {
    return `${ref.book} ${ref.chapter}:${ref.startVerse}`
  }
  return `${ref.book} ${ref.chapter}:${ref.startVerse}-${ref.endVerse}`
}

function assertValidInlineVerseRefs(body: NoteBodyInput) {
  const refs = extractVerseRefsFromNoteBody(body)
  for (const ref of refs) {
    const errorMessage = getVerseRefBoundsErrorMessage(ref)
    if (errorMessage) {
      throw new Error(`Invalid inline verse reference "${formatInlineVerseRef(ref)}": ${errorMessage}`)
    }
  }
}

async function syncInlineVerseLinksForNote(
  ctx: MutationCtx,
  userId: Id<"users">,
  noteId: Id<"notes">,
  body: NoteBodyInput | undefined
) {
  const existingLinks = await ctx.db
    .query("noteInlineVerseLinks")
    .withIndex("by_userId_noteId", (q) => q.eq("userId", userId).eq("noteId", noteId))
    .collect()

  if (!body) {
    for (const link of existingLinks) {
      await ctx.db.delete(link._id)
    }
    return
  }

  const refs = extractVerseRefsFromNoteBody(body)
  const targetIds = new Set<Id<"verseRefs">>()
  for (const ref of refs) {
    const verseRefId = await findOrCreateVerseRefId(ctx, userId, ref)
    targetIds.add(verseRefId)
  }

  const existingIds = new Set(existingLinks.map((link) => link.verseRefId))
  for (const link of existingLinks) {
    if (!targetIds.has(link.verseRefId)) {
      await ctx.db.delete(link._id)
    }
  }

  for (const verseRefId of targetIds) {
    if (existingIds.has(verseRefId)) continue
    await ctx.db.insert("noteInlineVerseLinks", {
      userId,
      noteId,
      verseRefId,
    })
  }
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

export const searchWorkspace = query({
  args: {
    query: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
    matchMode: v.optional(v.union(v.literal("any"), v.literal("all"))),
    limit: v.optional(v.number()),
  },
  returns: v.array(workspaceSearchResult),
  handler: async (ctx, args) => {
    const userId = await getCurrentUserIdOrNull(ctx)
    if (!userId) return []

    const queryText = args.query?.trim() ?? ""
    const selectedTags = normalizeTags(args.tags ?? [])
    const matchMode = args.matchMode ?? "any"
    const limit = Math.min(resolveSearchLimit(args.limit), MAX_WORKSPACE_RESULTS)
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

    const notes = baseResults
      .filter((note) => matchesTagFilters(note.tags, selectedTags, matchMode))
      .slice(0, limit)

    return await Promise.all(
      notes.map(async (note) => {
        const links = await ctx.db
          .query("noteVerseLinks")
          .withIndex("by_userId_noteId", (q) => q.eq("userId", userId).eq("noteId", note._id))
          .collect()
        const refs = await Promise.all(links.map((link) => ctx.db.get(link.verseRefId)))
        const verseRefs = refs
          .filter((ref): ref is Doc<"verseRefs"> => isVerseRefForUser(ref, userId))
          .map((ref) => ({
            book: ref.book,
            chapter: ref.chapter,
            startVerse: ref.startVerse,
            endVerse: ref.endVerse,
          }))
          .sort(compareVerseRefs)

        return {
          noteId: note._id,
          content: note.content,
          body: note.body ?? null,
          tags: note.tags,
          createdAt: note.createdAt,
          updatedAt: note.updatedAt,
          verseRefs,
          primaryRef: verseRefs[0] ?? null,
        }
      })
    )
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
  args: {
    content: v.optional(v.string()),
    body: v.optional(noteBodyValue),
    tags: v.array(v.string()),
  },
  returns: v.id("notes"),
  handler: async (ctx, args) => {
    const userId = await getCurrentUserId(ctx)
    const now = Date.now()
    const tags = normalizeTags(args.tags)
    const content = args.body ? noteBodyToPlainText(args.body) : args.content?.trim() ?? ""

    if (content.trim().length === 0) {
      throw new Error("Note content is required")
    }

    if (args.body) {
      assertValidInlineVerseRefs(args.body)
    }

    const noteId = await ctx.db.insert("notes", {
      userId,
      content,
      ...(args.body ? { body: args.body } : {}),
      tags,
      createdAt: now,
      updatedAt: now,
    })
    await syncInlineVerseLinksForNote(ctx, userId, noteId, args.body)
    await syncUserTagsFromNote(ctx, userId, tags, now)
    return noteId
  },
})

export const update = mutation({
  args: {
    id: v.id("notes"),
    content: v.optional(v.string()),
    body: v.optional(noteBodyValue),
    tags: v.optional(v.array(v.string())),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getCurrentUserId(ctx)
    const note = await ctx.db.get(args.id)
    if (!note || note.userId !== userId) {
      throw new Error("Note not found or access denied")
    }

    const now = Date.now()
    const patch: {
      content?: string
      body?: NoteBodyInput
      tags?: string[]
      updatedAt: number
    } = {
      updatedAt: now,
    }
    if (args.body !== undefined) {
      const nextContent = noteBodyToPlainText(args.body)
      if (nextContent.trim().length === 0) {
        throw new Error("Note content is required")
      }
      assertValidInlineVerseRefs(args.body)
      patch.body = args.body
      patch.content = nextContent
    } else if (args.content !== undefined) {
      if (args.content.trim().length === 0) {
        throw new Error("Note content is required")
      }
      patch.content = args.content
    }
    if (args.tags !== undefined) {
      patch.tags = normalizeTags(args.tags)
    }

    await ctx.db.patch(args.id, patch)
    if (args.body !== undefined) {
      await syncInlineVerseLinksForNote(ctx, userId, args.id, args.body)
    }

    if (patch.tags) {
      await syncUserTagsFromNote(ctx, userId, patch.tags, now)
    }
    return null
  },
})

export const remove = mutation({
  args: { id: v.id("notes") },
  returns: v.null(),
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
    const inlineLinks = await ctx.db
      .query("noteInlineVerseLinks")
      .withIndex("by_noteId", (q) => q.eq("noteId", args.id))
      .collect()
    for (const link of inlineLinks) {
      await ctx.db.delete(link._id)
    }
    await ctx.db.delete(args.id)
    return null
  },
})

import { query, mutation } from "./_generated/server"
import type { Doc } from "./_generated/dataModel"
import { v } from "convex/values"
import { getCurrentUserId, getCurrentUserIdOrNull } from "./lib/auth"

function isNote(doc: unknown): doc is Doc<"notes"> {
  return (
    doc !== null &&
    typeof doc === "object" &&
    "content" in doc &&
    "tags" in doc &&
    "createdAt" in doc
  )
}

export const link = mutation({
  args: { noteId: v.id("notes"), verseRefId: v.id("verseRefs") },
  returns: v.id("noteVerseLinks"),
  handler: async (ctx, args) => {
    const userId = await getCurrentUserId(ctx)
    const [note, verseRef] = await Promise.all([ctx.db.get(args.noteId), ctx.db.get(args.verseRefId)])
    if (!note || note.userId !== userId) {
      throw new Error("Note not found or access denied")
    }
    if (!verseRef || verseRef.userId !== userId) {
      throw new Error("Verse reference not found or access denied")
    }
    const existing = await ctx.db
      .query("noteVerseLinks")
      .withIndex("by_userId_noteId_verseRefId", (q) =>
        q.eq("userId", userId).eq("noteId", args.noteId).eq("verseRefId", args.verseRefId)
      )
      .unique()
    if (existing) return existing._id
    return await ctx.db.insert("noteVerseLinks", { ...args, userId })
  },
})

export const unlink = mutation({
  args: { noteId: v.id("notes"), verseRefId: v.id("verseRefs") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getCurrentUserId(ctx)
    const existing = await ctx.db
      .query("noteVerseLinks")
      .withIndex("by_userId_noteId_verseRefId", (q) =>
        q.eq("userId", userId).eq("noteId", args.noteId).eq("verseRefId", args.verseRefId)
      )
      .unique()
    if (existing) {
      await ctx.db.delete(existing._id)
    }
    return null
  },
})

export const getNotesForVerseRef = query({
  args: { verseRefId: v.id("verseRefs") },
  handler: async (ctx, args) => {
    const userId = await getCurrentUserIdOrNull(ctx)
    if (!userId) return []
    const links = await ctx.db
      .query("noteVerseLinks")
      .withIndex("by_userId_verseRefId", (q) =>
        q.eq("userId", userId).eq("verseRefId", args.verseRefId)
      )
      .collect()
    const rawNotes = await Promise.all(links.map((l) => ctx.db.get(l.noteId)))
    return rawNotes.filter(isNote)
  },
})

export const getVerseRefsForNote = query({
  args: { noteId: v.id("notes") },
  handler: async (ctx, args) => {
    const userId = await getCurrentUserIdOrNull(ctx)
    if (!userId) return []
    const links = await ctx.db
      .query("noteVerseLinks")
      .withIndex("by_userId_noteId", (q) => q.eq("userId", userId).eq("noteId", args.noteId))
      .collect()
    const refs = await Promise.all(links.map((l) => ctx.db.get(l.verseRefId)))
    return refs.filter(Boolean)
  },
})

export const getNotesForChapter = query({
  args: { book: v.string(), chapter: v.number() },
  handler: async (ctx, args) => {
    const userId = await getCurrentUserIdOrNull(ctx)
    if (!userId) return []
    const verseRefs = await ctx.db
      .query("verseRefs")
      .withIndex("by_userId_book_chapter", (q) =>
        q.eq("userId", userId).eq("book", args.book).eq("chapter", args.chapter)
      )
      .collect()

    const result: Array<{
      verseRef: (typeof verseRefs)[0]
      notes: Doc<"notes">[]
    }> = []

    for (const ref of verseRefs) {
      const links = await ctx.db
        .query("noteVerseLinks")
        .withIndex("by_userId_verseRefId", (q) => q.eq("userId", userId).eq("verseRefId", ref._id))
        .collect()
      const rawNotes = await Promise.all(links.map((l) => ctx.db.get(l.noteId)))
      const notes = rawNotes.filter(isNote)
      if (notes.length > 0) {
        result.push({ verseRef: ref, notes })
      }
    }

    return result
  },
})

import { query, mutation } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { v } from "convex/values";
import { getCurrentUserId, getCurrentUserIdOrNull } from "./lib/auth";
import {
  chapterNoteEntryValue,
  noteSummaryValue,
  verseRefLinkValue,
  type NoteSummary,
  type VerseRefLink,
  type VerseRefSummary,
} from "./lib/publicValues";

function isNote(doc: unknown): doc is Doc<"notes"> {
  return (
    doc !== null &&
    typeof doc === "object" &&
    "content" in doc &&
    "tags" in doc &&
    "createdAt" in doc
  );
}

function toNoteSummary(note: Doc<"notes">): NoteSummary {
  return {
    _id: note._id,
    content: note.content,
    ...(note.body ? { body: note.body } : {}),
    tags: note.tags,
    createdAt: note.createdAt,
    updatedAt: note.updatedAt,
  };
}

function toVerseRefSummary(ref: Doc<"verseRefs">): VerseRefSummary {
  return {
    book: ref.book,
    chapter: ref.chapter,
    startVerse: ref.startVerse,
    endVerse: ref.endVerse,
  };
}

function toVerseRefLink(ref: Doc<"verseRefs">): VerseRefLink {
  return {
    _id: ref._id,
    ...toVerseRefSummary(ref),
  };
}

export const link = mutation({
  args: { noteId: v.id("notes"), verseRefId: v.id("verseRefs") },
  returns: v.id("noteVerseLinks"),
  handler: async (ctx, args) => {
    const userId = await getCurrentUserId(ctx);
    const [note, verseRef] = await Promise.all([
      ctx.db.get(args.noteId),
      ctx.db.get(args.verseRefId),
    ]);
    if (!note || note.userId !== userId) {
      throw new Error("Note not found or access denied");
    }
    if (!verseRef || verseRef.userId !== userId) {
      throw new Error("Verse reference not found or access denied");
    }
    const existing = await ctx.db
      .query("noteVerseLinks")
      .withIndex("by_userId_noteId_verseRefId", (q) =>
        q
          .eq("userId", userId)
          .eq("noteId", args.noteId)
          .eq("verseRefId", args.verseRefId),
      )
      .unique();
    if (existing) return existing._id;
    return await ctx.db.insert("noteVerseLinks", { ...args, userId });
  },
});

export const unlink = mutation({
  args: { noteId: v.id("notes"), verseRefId: v.id("verseRefs") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getCurrentUserId(ctx);
    const existing = await ctx.db
      .query("noteVerseLinks")
      .withIndex("by_userId_noteId_verseRefId", (q) =>
        q
          .eq("userId", userId)
          .eq("noteId", args.noteId)
          .eq("verseRefId", args.verseRefId),
      )
      .unique();
    if (existing) {
      await ctx.db.delete(existing._id);
    }
    return null;
  },
});

export const getNotesForVerseRef = query({
  args: { verseRefId: v.id("verseRefs") },
  returns: v.array(noteSummaryValue),
  handler: async (ctx, args) => {
    const userId = await getCurrentUserIdOrNull(ctx);
    if (!userId) return [];
    const links = await ctx.db
      .query("noteVerseLinks")
      .withIndex("by_userId_verseRefId", (q) =>
        q.eq("userId", userId).eq("verseRefId", args.verseRefId),
      )
      .collect();
    const rawNotes = await Promise.all(links.map((l) => ctx.db.get(l.noteId)));
    return rawNotes.filter(isNote).map(toNoteSummary);
  },
});

export const getVerseRefsForNote = query({
  args: { noteId: v.id("notes") },
  returns: v.array(verseRefLinkValue),
  handler: async (ctx, args) => {
    const userId = await getCurrentUserIdOrNull(ctx);
    if (!userId) return [];
    const links = await ctx.db
      .query("noteVerseLinks")
      .withIndex("by_userId_noteId", (q) =>
        q.eq("userId", userId).eq("noteId", args.noteId),
      )
      .collect();
    const refs = await Promise.all(links.map((l) => ctx.db.get(l.verseRefId)));
    return refs
      .filter((ref): ref is Doc<"verseRefs"> => !!ref && ref.userId === userId)
      .map(toVerseRefLink);
  },
});

export const getNotesForChapter = query({
  args: { book: v.string(), chapter: v.number() },
  returns: v.array(chapterNoteEntryValue),
  handler: async (ctx, args) => {
    const userId = await getCurrentUserIdOrNull(ctx);
    if (!userId) return [];
    const verseRefs = await ctx.db
      .query("verseRefs")
      .withIndex("by_userId_book_chapter", (q) =>
        q
          .eq("userId", userId)
          .eq("book", args.book)
          .eq("chapter", args.chapter),
      )
      .collect();

    const linksByVerseRef = await Promise.all(
      verseRefs.map(async (ref) => ({
        ref,
        links: await ctx.db
          .query("noteVerseLinks")
          .withIndex("by_userId_verseRefId", (q) =>
            q.eq("userId", userId).eq("verseRefId", ref._id),
          )
          .collect(),
      })),
    );

    const uniqueNoteIds = new Set<string>();
    for (const entry of linksByVerseRef) {
      for (const link of entry.links) {
        uniqueNoteIds.add(String(link.noteId));
      }
    }

    const rawNotes = await Promise.all(
      Array.from(uniqueNoteIds).map((noteId) =>
        ctx.db.get(noteId as Id<"notes">),
      ),
    );
    const notesById = new Map(
      rawNotes
        .filter(isNote)
        .map((note) => [String(note._id), note] as const),
    );

    return linksByVerseRef.flatMap(({ ref, links }) => {
      const notes = links.flatMap((link) => {
        const note = notesById.get(String(link.noteId));
        return note ? [toNoteSummary(note)] : [];
      });
      return notes.length > 0
        ? [
            {
              verseRef: toVerseRefSummary(ref),
              notes,
            },
          ]
        : [];
    });
  },
});

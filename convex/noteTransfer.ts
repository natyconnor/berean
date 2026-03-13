import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

import { getCurrentUserId, getCurrentUserIdOrNull } from "./lib/auth";
import {
  createPlainTextNoteBody,
  noteBodyToPlainText,
} from "./lib/noteContent";
import { normalizeTags, syncUserTagsFromNote } from "./lib/tags";
import { findOrCreateVerseRefId } from "./lib/verseRefs";

const verseRefSummary = v.object({
  book: v.string(),
  chapter: v.number(),
  startVerse: v.number(),
  endVerse: v.number(),
});

export const exportableLinkedNote = v.object({
  noteId: v.id("notes"),
  content: v.string(),
  tags: v.array(v.string()),
  createdAt: v.number(),
  updatedAt: v.number(),
  verseRef: verseRefSummary,
});

export const importedNoteInput = v.object({
  book: v.string(),
  chapter: v.number(),
  verse: v.number(),
  content: v.string(),
  tags: v.array(v.string()),
});

export const listExportableNotes = query({
  args: {},
  returns: v.array(exportableLinkedNote),
  handler: async (ctx) => {
    const userId = await getCurrentUserIdOrNull(ctx);
    if (!userId) return [];

    const links = await ctx.db
      .query("noteVerseLinks")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .collect();

    const exported: Array<{
      noteId: (typeof links)[number]["noteId"];
      content: string;
      tags: string[];
      createdAt: number;
      updatedAt: number;
      verseRef: {
        book: string;
        chapter: number;
        startVerse: number;
        endVerse: number;
      };
    }> = [];

    for (const link of links) {
      const [note, verseRef] = await Promise.all([
        ctx.db.get(link.noteId),
        ctx.db.get(link.verseRefId),
      ]);

      if (!note || note.userId !== userId) continue;
      if (!verseRef || verseRef.userId !== userId) continue;

      exported.push({
        noteId: note._id,
        content: note.content,
        tags: note.tags,
        createdAt: note.createdAt,
        updatedAt: note.updatedAt,
        verseRef: {
          book: verseRef.book,
          chapter: verseRef.chapter,
          startVerse: verseRef.startVerse,
          endVerse: verseRef.endVerse,
        },
      });
    }

    return exported.sort((a, b) => {
      const byBook = a.verseRef.book.localeCompare(b.verseRef.book);
      if (byBook !== 0) return byBook;
      if (a.verseRef.chapter !== b.verseRef.chapter) {
        return a.verseRef.chapter - b.verseRef.chapter;
      }
      if (a.verseRef.startVerse !== b.verseRef.startVerse) {
        return a.verseRef.startVerse - b.verseRef.startVerse;
      }
      if (a.verseRef.endVerse !== b.verseRef.endVerse) {
        return a.verseRef.endVerse - b.verseRef.endVerse;
      }
      return a.createdAt - b.createdAt;
    });
  },
});

export const importNotesBatch = mutation({
  args: {
    notes: v.array(importedNoteInput),
  },
  returns: v.object({
    importedCount: v.number(),
    duplicateCount: v.number(),
  }),
  handler: async (ctx, args) => {
    const userId = await getCurrentUserId(ctx);
    const now = Date.now();
    const existingNotes = await ctx.db
      .query("notes")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .collect();
    const seenContents = new Set(
      existingNotes
        .map((note) => note.content.replace(/\r\n/g, "\n").trim())
        .filter((content) => content.length > 0),
    );

    let importedCount = 0;
    let duplicateCount = 0;
    for (const importedNote of args.notes) {
      const tags = normalizeTags(importedNote.tags);
      const body = createPlainTextNoteBody(importedNote.content);
      const content = noteBodyToPlainText(body).trim();
      if (content.length === 0) {
        continue;
      }
      if (seenContents.has(content)) {
        duplicateCount += 1;
        continue;
      }

      const noteId = await ctx.db.insert("notes", {
        userId,
        content,
        body,
        tags,
        createdAt: now,
        updatedAt: now,
      });

      const verseRefId = await findOrCreateVerseRefId(ctx, userId, {
        book: importedNote.book,
        chapter: importedNote.chapter,
        startVerse: importedNote.verse,
        endVerse: importedNote.verse,
      });

      const existingLink = await ctx.db
        .query("noteVerseLinks")
        .withIndex("by_userId_noteId_verseRefId", (q) =>
          q
            .eq("userId", userId)
            .eq("noteId", noteId)
            .eq("verseRefId", verseRefId),
        )
        .unique();

      if (!existingLink) {
        await ctx.db.insert("noteVerseLinks", {
          userId,
          noteId,
          verseRefId,
        });
      }

      await syncUserTagsFromNote(ctx, userId, tags, now);
      seenContents.add(content);
      importedCount += 1;
    }

    return { importedCount, duplicateCount };
  },
});

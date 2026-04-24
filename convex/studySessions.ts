import { query, mutation, type QueryCtx } from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { getCurrentUserId, getCurrentUserIdOrNull } from "./lib/auth";
import { matchesTagFilters, type TagMatchMode } from "./lib/tags";

const scopeValue = v.object({
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

type Scope = {
  books: string[];
  chapterRanges?: Array<{
    book: string;
    startChapter: number;
    endChapter: number;
  }>;
  tags: string[];
  tagMatchMode: TagMatchMode;
};

function refMatchesScope(scope: Scope, book: string, chapter: number): boolean {
  if (scope.books.length === 0) return true;
  if (!scope.books.includes(book)) return false;

  const range = scope.chapterRanges?.find((r) => r.book === book);
  if (!range) return true;
  return chapter >= range.startChapter && chapter <= range.endChapter;
}

function referenceKeyStringForVerseRef(ref: {
  book: string;
  chapter: number;
  startVerse: number;
  endVerse: number;
}): string {
  return `${ref.book}|${ref.chapter}|${ref.startVerse}|${ref.endVerse}`;
}

function countDistinctTeachPassageKeysFromNotes(
  notes: Array<{
    refs: Array<{
      book: string;
      chapter: number;
      startVerse: number;
      endVerse: number;
    }>;
  }>,
): number {
  const keys = new Set<string>();
  for (const n of notes) {
    for (const r of n.refs) {
      keys.add(referenceKeyStringForVerseRef(r));
    }
  }
  return keys.size;
}

const sessionListItem = v.object({
  _id: v.id("studySessions"),
  name: v.optional(v.string()),
  scope: scopeValue,
  lastView: v.optional(v.string()),
  createdAt: v.number(),
  lastOpenedAt: v.number(),
});

const sessionListWithCountsItem = v.object({
  _id: v.id("studySessions"),
  name: v.optional(v.string()),
  scope: scopeValue,
  lastView: v.optional(v.string()),
  createdAt: v.number(),
  lastOpenedAt: v.number(),
  savedVersesCount: v.number(),
  notesCount: v.number(),
  teachPassagesCount: v.number(),
});

export const create = mutation({
  args: { scope: scopeValue, name: v.optional(v.string()) },
  returns: v.id("studySessions"),
  handler: async (ctx, args) => {
    const userId = await getCurrentUserId(ctx);
    const now = Date.now();
    return await ctx.db.insert("studySessions", {
      userId,
      name: args.name,
      scope: args.scope,
      createdAt: now,
      lastOpenedAt: now,
    });
  },
});

export const listMine = query({
  args: {},
  returns: v.array(sessionListWithCountsItem),
  handler: async (ctx) => {
    const userId = await getCurrentUserIdOrNull(ctx);
    if (!userId) return [];

    const rows = await ctx.db
      .query("studySessions")
      .withIndex("by_userId_lastOpenedAt", (q) => q.eq("userId", userId))
      .collect();

    rows.sort((a, b) => b.lastOpenedAt - a.lastOpenedAt);

    if (rows.length === 0) return [];

    // Fetch user-scoped data once and filter per session. This avoids an N*M
    // pattern where N is sessions and M is content documents.
    const savedVerses = await ctx.db
      .query("savedVerses")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .collect();

    const noteLinks = await ctx.db
      .query("noteVerseLinks")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .collect();

    const verseRefMap = new Map<
      string,
      {
        book: string;
        chapter: number;
        startVerse: number;
        endVerse: number;
      }
    >();
    for (const link of noteLinks) {
      const key = String(link.verseRefId);
      if (verseRefMap.has(key)) continue;
      const ref = await ctx.db.get(link.verseRefId);
      if (!ref || ref.userId !== userId) continue;
      verseRefMap.set(key, {
        book: ref.book,
        chapter: ref.chapter,
        startVerse: ref.startVerse,
        endVerse: ref.endVerse,
      });
    }

    const uniqueNoteIds = new Set(noteLinks.map((l) => String(l.noteId)));
    const noteMap = new Map<string, { tags: string[] }>();
    for (const link of noteLinks) {
      const key = String(link.noteId);
      if (noteMap.has(key)) continue;
      if (!uniqueNoteIds.has(key)) continue;
      const note = await ctx.db.get(link.noteId);
      if (!note || note.userId !== userId) continue;
      noteMap.set(key, { tags: note.tags });
    }

    return rows.map((r) => {
      const scope = r.scope;

      let savedVersesCount = 0;
      for (const sv of savedVerses) {
        if (refMatchesScope(scope, sv.book, sv.chapter)) savedVersesCount++;
      }

      const countedNotes = new Set<string>();
      const teachPassageKeys = new Set<string>();
      for (const link of noteLinks) {
        const vref = verseRefMap.get(String(link.verseRefId));
        if (!vref) continue;
        if (!refMatchesScope(scope, vref.book, vref.chapter)) continue;
        const noteIdStr = String(link.noteId);
        const note = noteMap.get(noteIdStr);
        if (!note) continue;
        if (
          scope.tags.length > 0 &&
          !matchesTagFilters(note.tags, scope.tags, scope.tagMatchMode)
        ) {
          continue;
        }
        teachPassageKeys.add(referenceKeyStringForVerseRef(vref));
        if (!countedNotes.has(noteIdStr)) {
          countedNotes.add(noteIdStr);
        }
      }

      return {
        _id: r._id,
        name: r.name,
        scope: r.scope,
        lastView: r.lastView,
        createdAt: r.createdAt,
        lastOpenedAt: r.lastOpenedAt,
        savedVersesCount,
        notesCount: countedNotes.size,
        teachPassagesCount: teachPassageKeys.size,
      };
    });
  },
});

export const get = query({
  args: { id: v.id("studySessions") },
  returns: v.union(sessionListItem, v.null()),
  handler: async (ctx, args) => {
    const userId = await getCurrentUserIdOrNull(ctx);
    if (!userId) return null;

    const session = await ctx.db.get(args.id);
    if (!session || session.userId !== userId) return null;

    return {
      _id: session._id,
      name: session.name,
      scope: session.scope,
      lastView: session.lastView,
      createdAt: session.createdAt,
      lastOpenedAt: session.lastOpenedAt,
    };
  },
});

export const remove = mutation({
  args: { id: v.id("studySessions") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getCurrentUserId(ctx);
    const session = await ctx.db.get(args.id);
    if (!session || session.userId !== userId) {
      throw new Error("Session not found");
    }
    await ctx.db.delete(args.id);
    return null;
  },
});

export const touch = mutation({
  args: {
    id: v.id("studySessions"),
    lastView: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getCurrentUserId(ctx);
    const session = await ctx.db.get(args.id);
    if (!session || session.userId !== userId) return null;
    const patch: {
      lastOpenedAt: number;
      lastView?: string;
    } = {
      lastOpenedAt: Date.now(),
    };
    if (args.lastView !== undefined) {
      patch.lastView = args.lastView;
    }
    await ctx.db.patch(args.id, patch);
    return null;
  },
});

// ---------- scope resolution helpers ----------

async function collectSavedVersesForScope(
  ctx: QueryCtx,
  userId: Id<"users">,
  scope: Scope,
) {
  const rows = await ctx.db
    .query("savedVerses")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .collect();

  const results: Array<{
    _id: Id<"savedVerses">;
    book: string;
    chapter: number;
    startVerse: number;
    endVerse: number;
  }> = [];

  for (const row of rows) {
    const ref = await ctx.db.get(row.verseRefId);
    if (!ref || ref.userId !== userId) continue;
    if (!refMatchesScope(scope, ref.book, ref.chapter)) continue;
    results.push({
      _id: row._id,
      book: ref.book,
      chapter: ref.chapter,
      startVerse: ref.startVerse,
      endVerse: ref.endVerse,
    });
  }

  return results;
}

async function collectNotesForScope(
  ctx: QueryCtx,
  userId: Id<"users">,
  scope: Scope,
) {
  const noteLinks = await ctx.db
    .query("noteVerseLinks")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .collect();

  const noteMap = new Map<
    string,
    {
      noteId: Id<"notes">;
      content: string;
      tags: string[];
      createdAt: number;
      updatedAt: number;
      refs: Array<{
        book: string;
        chapter: number;
        startVerse: number;
        endVerse: number;
      }>;
    }
  >();

  for (const link of noteLinks) {
    const ref = await ctx.db.get(link.verseRefId);
    if (!ref || ref.userId !== userId) continue;
    if (!refMatchesScope(scope, ref.book, ref.chapter)) continue;

    const noteIdStr = String(link.noteId);
    if (!noteMap.has(noteIdStr)) {
      const note = await ctx.db.get(link.noteId);
      if (!note || note.userId !== userId) continue;

      if (
        scope.tags.length > 0 &&
        !matchesTagFilters(note.tags, scope.tags, scope.tagMatchMode)
      ) {
        continue;
      }

      noteMap.set(noteIdStr, {
        noteId: link.noteId,
        content: note.content,
        tags: note.tags,
        createdAt: note.createdAt,
        updatedAt: note.updatedAt,
        refs: [],
      });
    }

    const entry = noteMap.get(noteIdStr);
    if (entry) {
      entry.refs.push({
        book: ref.book,
        chapter: ref.chapter,
        startVerse: ref.startVerse,
        endVerse: ref.endVerse,
      });
    }
  }

  return Array.from(noteMap.values());
}

const resolvedSavedVerse = v.object({
  _id: v.id("savedVerses"),
  book: v.string(),
  chapter: v.number(),
  startVerse: v.number(),
  endVerse: v.number(),
});

const resolvedNote = v.object({
  noteId: v.id("notes"),
  content: v.string(),
  tags: v.array(v.string()),
  createdAt: v.number(),
  updatedAt: v.number(),
  refs: v.array(
    v.object({
      book: v.string(),
      chapter: v.number(),
      startVerse: v.number(),
      endVerse: v.number(),
    }),
  ),
});

export const resolveScope = query({
  args: { id: v.id("studySessions") },
  returns: v.union(
    v.object({
      savedVerses: v.array(resolvedSavedVerse),
      notes: v.array(resolvedNote),
      teachPassagesCount: v.number(),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const userId = await getCurrentUserIdOrNull(ctx);
    if (!userId) return null;

    const session = await ctx.db.get(args.id);
    if (!session || session.userId !== userId) return null;

    const scope = session.scope;
    const savedVerses = await collectSavedVersesForScope(ctx, userId, scope);
    const notes = await collectNotesForScope(ctx, userId, scope);
    return {
      savedVerses,
      notes,
      teachPassagesCount: countDistinctTeachPassageKeysFromNotes(notes),
    };
  },
});

export const previewCounts = query({
  args: { scope: scopeValue },
  returns: v.union(
    v.object({
      savedVersesCount: v.number(),
      notesCount: v.number(),
      teachPassagesCount: v.number(),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const userId = await getCurrentUserIdOrNull(ctx);
    if (!userId) return null;

    const scope = args.scope;
    const savedVerses = await collectSavedVersesForScope(ctx, userId, scope);
    const notes = await collectNotesForScope(ctx, userId, scope);
    return {
      savedVersesCount: savedVerses.length,
      notesCount: notes.length,
      teachPassagesCount: countDistinctTeachPassageKeysFromNotes(notes),
    };
  },
});

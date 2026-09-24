import { useMemo } from "react";
import { useMutation } from "convex/react";
import { useQuery } from "convex-helpers/react/cache";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { logInteraction } from "@/lib/dev-log";
import type { NoteBody } from "@/lib/note-inline-content";
import type { VerseRef } from "@/lib/verse-ref-utils";
import {
  buildChapterScopedNotes,
  buildPassageNotesByAnchor,
  buildSingleVerseNotes,
  buildVerseToPassageAnchor,
} from "@/components/notes/model/note-model";

export function useChapterNotesData(book: string, chapter: number) {
  const chapterNotesResult = useQuery(api.noteVerseLinks.getNotesForChapter, {
    book,
    chapter,
  });
  const createNote = useMutation(api.notes.create);
  const updateNote = useMutation(api.notes.update);
  const removeNote = useMutation(api.notes.remove);
  const findOrCreateRef = useMutation(api.verseRefs.findOrCreate);
  const linkNote = useMutation(api.noteVerseLinks.link);

  const chapterNotes = chapterNotesResult;

  const chapterScopedNotes = useMemo(
    () => buildChapterScopedNotes(chapterNotes),
    [chapterNotes],
  );
  const singleVerseNotes = useMemo(
    () => buildSingleVerseNotes(chapterNotes),
    [chapterNotes],
  );
  const passageNotesByAnchor = useMemo(
    () => buildPassageNotesByAnchor(chapterNotes),
    [chapterNotes],
  );
  const verseToPassageAnchor = useMemo(
    () => buildVerseToPassageAnchor(chapterNotes),
    [chapterNotes],
  );

  const saveNewNote = async (
    verseRef: VerseRef,
    body: NoteBody,
    tags: string[],
  ) => {
    logInteraction("notes", "create-started", {
      book: verseRef.book,
      chapter: verseRef.chapter,
      startVerse: verseRef.startVerse,
      endVerse: verseRef.endVerse,
      scope: verseRef.scope,
      tagCount: tags.length,
    });
    try {
      const noteId = await createNote({ body, tags });
      const verseRefId = await findOrCreateRef({
        book: verseRef.book,
        chapter: verseRef.chapter,
        startVerse: verseRef.startVerse,
        endVerse: verseRef.endVerse,
        ...(verseRef.scope === "chapter" ? { scope: "chapter" as const } : {}),
      });
      await linkNote({ noteId, verseRefId });
      logInteraction("notes", "created", {
        noteId,
        book: verseRef.book,
        chapter: verseRef.chapter,
        startVerse: verseRef.startVerse,
        endVerse: verseRef.endVerse,
        scope: verseRef.scope,
        tagCount: tags.length,
      });
    } catch (error) {
      logInteraction("notes", "create-failed", {
        book: verseRef.book,
        chapter: verseRef.chapter,
        startVerse: verseRef.startVerse,
        endVerse: verseRef.endVerse,
        scope: verseRef.scope,
        message: error instanceof Error ? error.message : "unknown-error",
        tagCount: tags.length,
      });
      throw error;
    }
  };

  const saveEditedNote = async (
    noteId: Id<"notes">,
    body: NoteBody,
    tags: string[],
    verseRef?: VerseRef,
  ) => {
    logInteraction("notes", "update-started", {
      noteId,
      tagCount: tags.length,
      ...(verseRef
        ? {
            book: verseRef.book,
            chapter: verseRef.chapter,
            startVerse: verseRef.startVerse,
            endVerse: verseRef.endVerse,
          }
        : {}),
    });
    try {
      await updateNote({
        id: noteId,
        body,
        tags,
        ...(verseRef ? { verseRef } : {}),
      });
      logInteraction("notes", "updated", {
        noteId,
        tagCount: tags.length,
        ...(verseRef
          ? {
              book: verseRef.book,
              chapter: verseRef.chapter,
              startVerse: verseRef.startVerse,
              endVerse: verseRef.endVerse,
            }
          : {}),
      });
    } catch (error) {
      logInteraction("notes", "update-failed", {
        noteId,
        message: error instanceof Error ? error.message : "unknown-error",
        tagCount: tags.length,
      });
      throw error;
    }
  };

  const deleteNote = async (noteId: Id<"notes">) => {
    logInteraction("notes", "delete-started", { noteId });
    try {
      await removeNote({ id: noteId });
      logInteraction("notes", "deleted", { noteId });
    } catch (error) {
      logInteraction("notes", "delete-failed", {
        noteId,
        message: error instanceof Error ? error.message : "unknown-error",
      });
      throw error;
    }
  };

  return {
    chapterScopedNotes,
    singleVerseNotes,
    passageNotesByAnchor,
    verseToPassageAnchor,
    saveNewNote,
    saveEditedNote,
    deleteNote,
  };
}

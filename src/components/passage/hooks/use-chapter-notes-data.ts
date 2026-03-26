import { useMemo } from "react";
import { useMutation } from "convex/react";
import { useQuery } from "convex-helpers/react/cache";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { logInteraction } from "@/lib/dev-log";
import type { NoteBody } from "@/lib/note-inline-content";
import {
  buildPassageNotesByAnchor,
  buildSingleVerseNotes,
  buildVerseToPassageAnchor,
} from "@/components/notes/model/note-model";

interface SaveNoteRef {
  book: string;
  chapter: number;
  startVerse: number;
  endVerse: number;
}

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
    verseRef: SaveNoteRef,
    body: NoteBody,
    tags: string[],
  ) => {
    logInteraction("notes", "create-started", {
      book: verseRef.book,
      chapter: verseRef.chapter,
      startVerse: verseRef.startVerse,
      endVerse: verseRef.endVerse,
      tagCount: tags.length,
    });
    try {
      const noteId = await createNote({ body, tags });
      const verseRefId = await findOrCreateRef(verseRef);
      await linkNote({ noteId, verseRefId });
      logInteraction("notes", "created", {
        noteId,
        book: verseRef.book,
        chapter: verseRef.chapter,
        startVerse: verseRef.startVerse,
        endVerse: verseRef.endVerse,
        tagCount: tags.length,
      });
    } catch (error) {
      logInteraction("notes", "create-failed", {
        book: verseRef.book,
        chapter: verseRef.chapter,
        startVerse: verseRef.startVerse,
        endVerse: verseRef.endVerse,
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
  ) => {
    logInteraction("notes", "update-started", {
      noteId,
      tagCount: tags.length,
    });
    try {
      await updateNote({ id: noteId, body, tags });
      logInteraction("notes", "updated", {
        noteId,
        tagCount: tags.length,
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
    singleVerseNotes,
    passageNotesByAnchor,
    verseToPassageAnchor,
    saveNewNote,
    saveEditedNote,
    deleteNote,
  };
}

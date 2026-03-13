import { useMemo } from "react";
import { useMutation } from "convex/react";
import { useQuery } from "convex-helpers/react/cache";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import type { NoteBody } from "@/lib/note-inline-content";
import {
  buildPassageNotesByAnchor,
  buildSingleVerseNotes,
  buildVerseToPassageAnchor,
  type ChapterNoteEntry,
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

  const chapterNotes = useMemo(
    () => (chapterNotesResult ?? []) as ChapterNoteEntry[],
    [chapterNotesResult],
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
    verseRef: SaveNoteRef,
    body: NoteBody,
    tags: string[],
  ) => {
    const noteId = await createNote({ body, tags });
    const verseRefId = await findOrCreateRef(verseRef);
    await linkNote({ noteId, verseRefId });
  };

  const saveEditedNote = async (
    noteId: Id<"notes">,
    body: NoteBody,
    tags: string[],
  ) => {
    await updateNote({ id: noteId, body, tags });
  };

  const deleteNote = async (noteId: Id<"notes">) => {
    await removeNote({ id: noteId });
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

import { useCallback, useState } from "react";
import type { Id } from "../../../../convex/_generated/dataModel";
import type { NoteBody } from "@/lib/note-inline-content";
import type { NoteWithRef } from "@/components/notes/model/note-model";
import { chapterScopeVerseRef } from "@/components/notes/model/note-model";

interface UseChapterNotesPanelOptions {
  book: string;
  chapter: number;
  notes: NoteWithRef[];
  onSaveNew: (
    verseRef: ReturnType<typeof chapterScopeVerseRef>,
    body: NoteBody,
    tags: string[],
  ) => Promise<void>;
  onSaveEdit: (
    noteId: Id<"notes">,
    body: NoteBody,
    tags: string[],
  ) => Promise<void>;
  onDelete: (noteId: Id<"notes">) => Promise<void>;
}

export function useChapterNotesPanel({
  book,
  chapter,
  notes,
  onSaveNew,
  onSaveEdit,
  onDelete,
}: UseChapterNotesPanelOptions) {
  // PassageChapterView remounts per book/chapter, so no cross-chapter reset needed.
  const [open, setOpen] = useState(false);
  const [drafting, setDrafting] = useState(false);
  const [editingId, setEditingId] = useState<Id<"notes"> | null>(null);
  const [dirty, setDirty] = useState(false);

  const chapterRef = chapterScopeVerseRef(book, chapter);
  const overlayOpen = open || drafting;

  const openPanel = useCallback(() => {
    setOpen(true);
  }, []);

  const closePanel = useCallback(() => {
    setOpen(false);
    setDrafting(false);
    setEditingId(null);
    setDirty(false);
  }, []);

  const startDraft = useCallback(() => {
    setOpen(true);
    setDrafting(true);
    setEditingId(null);
  }, []);

  const cancelDraft = useCallback(() => {
    setDrafting(false);
    setDirty(false);
    if (notes.length === 0) setOpen(false);
  }, [notes.length]);

  const saveDraft = useCallback(
    async (body: NoteBody, tags: string[]) => {
      await onSaveNew(
        {
          book,
          chapter,
          startVerse: 1,
          endVerse: 1,
          scope: "chapter",
        },
        body,
        tags,
      );
      setDrafting(false);
      setDirty(false);
      setOpen(true);
    },
    [book, chapter, onSaveNew],
  );

  const startEdit = useCallback((noteId: Id<"notes">) => {
    setOpen(true);
    setEditingId(noteId);
    setDrafting(false);
  }, []);

  const cancelEdit = useCallback(() => {
    setEditingId(null);
    setDirty(false);
  }, []);

  const saveEdit = useCallback(
    async (noteId: Id<"notes">, body: NoteBody, tags: string[]) => {
      await onSaveEdit(noteId, body, tags);
      setEditingId(null);
      setDirty(false);
    },
    [onSaveEdit],
  );

  const deleteNote = useCallback(
    async (noteId: Id<"notes">) => {
      await onDelete(noteId);
      if (editingId === noteId) setEditingId(null);
    },
    [editingId, onDelete],
  );

  /** Row + opens existing notes, or starts a draft when empty. */
  const handleRowAdd = useCallback(() => {
    if (overlayOpen) {
      closePanel();
      return;
    }
    if (notes.length > 0) openPanel();
    else startDraft();
  }, [closePanel, notes.length, openPanel, overlayOpen, startDraft]);

  return {
    chapterRef,
    notes,
    overlayOpen,
    open,
    drafting,
    editingId,
    dirty,
    setDirty,
    openPanel,
    closePanel,
    startDraft,
    cancelDraft,
    saveDraft,
    startEdit,
    cancelEdit,
    saveEdit,
    deleteNote,
    handleRowAdd,
  };
}

export type ChapterNotesPanelState = ReturnType<typeof useChapterNotesPanel>;

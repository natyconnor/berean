import { useCallback, useEffect } from "react";
import type { Id } from "../../../../convex/_generated/dataModel";
import type { NoteBody } from "@/lib/note-inline-content";
import type { VerseRef } from "@/lib/verse-ref-utils";
import type { NoteWithRef } from "@/components/notes/model/note-model";
import { useChapterNotesData } from "./use-chapter-notes-data";
import {
  useChapterNotesPanel,
  type ChapterNotesPanelState,
} from "./use-chapter-notes-panel";
import {
  usePassageNotesUiState,
  type EditorSlot,
  type ExpandedPassageRange,
  type FocusTarget,
} from "./use-passage-notes-ui-state";

const CHAPTER_NOTES_DIRTY_KEY = "chapter-notes";

export interface PassageNotesInteraction {
  selectedVerses: Set<number>;
  passageDraftVerses: Set<number>;
  expandedPassageRanges: ExpandedPassageRange[];
  hasDirtyEditors: boolean;
  notifyEditorDirty: (key: string, isDirty: boolean) => void;
  hoveredVerse: number | null;
  hoveredSingleBubble: number | null;
  hoveredPassageBubble: number | null;
  openVerseKeys: Set<number>;
  openPassageKeys: Set<number>;
  openEditors: Map<string, EditorSlot>;
  currentFocusTarget: FocusTarget | null;
  editingNoteIds: Set<Id<"notes">>;
  newDraftsByAnchor: Map<number, VerseRef[]>;
  isPassageSelection: boolean;

  chapterScopedNotes: NoteWithRef[];
  chapterNotesPanel: ChapterNotesPanelState;
  singleVerseNotes: Map<number, NoteWithRef[]>;
  passageNotesByAnchor: Map<number, NoteWithRef[]>;
  verseToPassageAnchor: Map<number, number>;

  containerRef: React.RefObject<HTMLDivElement | null>;
  isDragging: boolean;
  isInSelection: (verseNumber: number) => boolean;

  handleVerseMouseDown: (verseNumber: number) => void;
  handleMouseEnter: (verseNumber: number) => void;
  handleMouseLeave: () => void;
  handleMouseUp: () => void;
  handleSingleBubbleMouseEnter: (verseNumber: number) => void;
  handleSingleBubbleMouseLeave: () => void;
  handlePassageBubbleMouseEnter: (verseNumber: number) => void;
  handlePassageBubbleMouseLeave: () => void;
  handleAddNote: (verseNumber: number) => void;
  handleSaveNew: (
    verseRef: VerseRef,
    body: NoteBody,
    tags: string[],
  ) => Promise<void>;
  handleSaveEdit: (
    noteId: Id<"notes">,
    body: NoteBody,
    tags: string[],
  ) => Promise<void>;
  handleDelete: (noteId: Id<"notes">) => Promise<void>;
  handleNoteDeleteCleanup: (
    noteId: Id<"notes">,
    verseNumber: number,
    isPassage: boolean,
  ) => void;
  handleClickAway: () => void;
  cancelEditor: (key: string) => void;
  openVerseNotes: (verseNumber: number) => void;
  closeVerseNotes: (verseNumber: number) => void;
  openPassageNotes: (verseNumber: number) => void;
  closePassageNotes: (verseNumber: number) => void;
  startEditingNote: (
    noteId: Id<"notes">,
    verseRef: VerseRef,
    verseNumber: number,
    isPassage: boolean,
  ) => void;
  startCreatingPassageNote: (verseRef: VerseRef) => void;
  handleEditorFocus: (key: string) => void;
  normalizeForFocusMode: () => void;
  showDiscardConfirmation: boolean;
  confirmDiscard: () => void;
  cancelDiscard: () => void;
  setViewModeWithNotesReset: (next: "compose" | "read") => void;
}

export function usePassageNotesInteraction(
  book: string,
  chapter: number,
  options?: {
    viewMode?: "compose" | "read";
    setViewMode?: (next: "compose" | "read") => void;
    isFocusMode?: boolean;
  },
): PassageNotesInteraction {
  const viewMode = options?.viewMode ?? "compose";
  const setViewMode =
    options?.setViewMode ??
    (() => {
      /* no-op when view mode is not wired (tests) */
    });
  const isFocusMode = options?.isFocusMode ?? false;
  const {
    chapterScopedNotes,
    singleVerseNotes,
    passageNotesByAnchor,
    verseToPassageAnchor,
    saveNewNote,
    saveEditedNote,
    deleteNote,
  } = useChapterNotesData(book, chapter);

  const uiState = usePassageNotesUiState({
    book,
    chapter,
    viewMode,
    setViewMode,
    isFocusMode,
    singleVerseNotes,
    passageNotesByAnchor,
    verseToPassageAnchor,
    onSaveNewNote: saveNewNote,
    onSaveEditNote: saveEditedNote,
    onDeleteNote: deleteNote,
  });

  const chapterNotesPanel = useChapterNotesPanel({
    book,
    chapter,
    notes: chapterScopedNotes,
    onSaveNew: saveNewNote,
    onSaveEdit: saveEditedNote,
    onDelete: deleteNote,
  });

  const {
    notifyEditorDirty,
    handleClickAway: baseClickAway,
    confirmDiscard: baseConfirmDiscard,
  } = uiState;
  const {
    dirty: chapterNotesDirty,
    overlayOpen: chapterOverlayOpen,
    drafting: chapterDrafting,
    editingId: chapterEditingId,
    closePanel: closeChapterPanel,
    cancelDraft: cancelChapterDraft,
    cancelEdit: cancelChapterEdit,
  } = chapterNotesPanel;

  // Fold chapter-note editor dirtiness into the shared discard gate.
  useEffect(() => {
    notifyEditorDirty(CHAPTER_NOTES_DIRTY_KEY, chapterNotesDirty);
  }, [chapterNotesDirty, notifyEditorDirty]);

  const handleClickAway = useCallback(() => {
    closeChapterPanel();
    baseClickAway();
  }, [baseClickAway, closeChapterPanel]);

  const confirmDiscard = useCallback(() => {
    closeChapterPanel();
    baseConfirmDiscard();
  }, [baseConfirmDiscard, closeChapterPanel]);

  // Escape closes the chapter overlay when no verse note UI is open.
  useEffect(() => {
    function handleEscapeKey(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      if (!chapterOverlayOpen) return;
      const verseUiOpen =
        uiState.openVerseKeys.size > 0 ||
        uiState.openPassageKeys.size > 0 ||
        uiState.openEditors.size > 0 ||
        uiState.selectedVerses.size > 0;
      if (verseUiOpen) return;
      // Match NoteEditor Cancel: drop in-progress draft/edit first.
      if (chapterDrafting) {
        cancelChapterDraft();
        return;
      }
      if (chapterEditingId) {
        cancelChapterEdit();
        return;
      }
      closeChapterPanel();
    }

    document.addEventListener("keydown", handleEscapeKey);
    return () => document.removeEventListener("keydown", handleEscapeKey);
  }, [
    cancelChapterDraft,
    cancelChapterEdit,
    chapterDrafting,
    chapterEditingId,
    chapterOverlayOpen,
    closeChapterPanel,
    uiState.openEditors.size,
    uiState.openPassageKeys.size,
    uiState.openVerseKeys.size,
    uiState.selectedVerses.size,
  ]);

  return {
    ...uiState,
    hasDirtyEditors: uiState.hasDirtyEditors || chapterNotesDirty,
    handleClickAway,
    confirmDiscard,
    chapterScopedNotes,
    chapterNotesPanel,
    singleVerseNotes,
    passageNotesByAnchor,
    verseToPassageAnchor,
  };
}

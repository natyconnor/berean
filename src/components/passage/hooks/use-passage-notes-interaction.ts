import type { Id } from "../../../../convex/_generated/dataModel";
import type { NoteBody } from "@/lib/note-inline-content";
import type { VerseRef } from "@/lib/verse-ref-utils";
import type { NoteWithRef } from "@/components/notes/model/note-model";
import { useChapterNotesData } from "./use-chapter-notes-data";
import {
  usePassageNotesUiState,
  type EditorSlot,
  type ExpandedPassageRange,
} from "./use-passage-notes-ui-state";

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
  editingNoteIds: Set<Id<"notes">>;
  newDraftsByAnchor: Map<number, VerseRef[]>;
  isPassageSelection: boolean;

  singleVerseNotes: Map<number, NoteWithRef[]>;
  passageNotesByAnchor: Map<number, NoteWithRef[]>;
  verseToPassageAnchor: Map<number, number>;

  containerRef: React.RefObject<HTMLDivElement | null>;
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

  return {
    ...uiState,
    singleVerseNotes,
    passageNotesByAnchor,
    verseToPassageAnchor,
  };
}

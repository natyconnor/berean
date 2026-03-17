import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Id } from "../../../../convex/_generated/dataModel";
import { useVerseSelection } from "@/hooks/use-verse-selection";
import type { NoteBody } from "@/lib/note-inline-content";
import type { VerseRef } from "@/lib/verse-ref-utils";
import type { NoteWithRef } from "@/components/notes/model/note-model";

interface UsePassageNotesUiStateOptions {
  book: string;
  chapter: number;
  singleVerseNotes: Map<number, NoteWithRef[]>;
  passageNotesByAnchor: Map<number, NoteWithRef[]>;
  verseToPassageAnchor: Map<number, number>;
  onSaveNewNote: (
    verseRef: VerseRef,
    body: NoteBody,
    tags: string[],
  ) => Promise<void>;
  onSaveEditNote: (
    noteId: Id<"notes">,
    body: NoteBody,
    tags: string[],
  ) => Promise<void>;
  onDeleteNote: (noteId: Id<"notes">) => Promise<void>;
}

export type EditorSlot =
  | { kind: "new"; verseRef: VerseRef }
  | { kind: "edit"; noteId: Id<"notes">; verseRef: VerseRef };

export interface PassageNotesUiState {
  selectedVerses: Set<number>;
  passageDraftVerses: Set<number>;
  canDismissOnClickAway: boolean;
  notifyEditorDirty: (key: string, isDirty: boolean) => void;
  hoveredVerse: number | null;
  hoveredSingleBubble: number | null;
  hoveredPassageBubble: number | null;
  openVerseKey: number | null;
  openPassageKey: number | null;
  openEditors: Map<string, EditorSlot>;
  editingNoteIds: Set<Id<"notes">>;
  newDraftsByAnchor: Map<number, VerseRef[]>;
  isPassageSelection: boolean;
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
  handleClickAway: () => void;
  cancelEditor: (key: string) => void;
  openVerseNotes: (verseNumber: number) => void;
  closeVerseNotes: () => void;
  openPassageNotes: (verseNumber: number) => void;
  closePassageNotes: () => void;
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
}

export function editorKey(slot: EditorSlot): string {
  return slot.kind === "new"
    ? `new:${slot.verseRef.startVerse}:${slot.verseRef.endVerse}`
    : `edit:${slot.noteId}`;
}

function newEditorKey(ref: VerseRef): string {
  return `new:${ref.startVerse}:${ref.endVerse}`;
}

function editEditorKey(noteId: Id<"notes">): string {
  return `edit:${noteId}`;
}

export function usePassageNotesUiState({
  book,
  chapter,
  singleVerseNotes,
  passageNotesByAnchor,
  verseToPassageAnchor,
  onSaveNewNote,
  onSaveEditNote,
  onDeleteNote,
}: UsePassageNotesUiStateOptions): PassageNotesUiState {
  const [openEditors, setOpenEditors] = useState<Map<string, EditorSlot>>(
    new Map(),
  );
  const [editorHasChanges, setEditorHasChanges] = useState<Set<string>>(
    new Set(),
  );
  const [viewSelectedVerses, setViewSelectedVerses] = useState<Set<number>>(
    new Set(),
  );
  const [hoveredVerse, setHoveredVerse] = useState<number | null>(null);
  const [hoveredSingleBubble, setHoveredSingleBubble] = useState<
    number | null
  >(null);
  const [hoveredPassageBubble, setHoveredPassageBubble] = useState<
    number | null
  >(null);
  const [openVerseKey, setOpenVerseKey] = useState<number | null>(null);
  const [openPassageKey, setOpenPassageKey] = useState<number | null>(null);
  const [isPassageSelection, setIsPassageSelection] = useState(false);
  const [showDiscardConfirmation, setShowDiscardConfirmation] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const suppressNextDocumentClickRef = useRef(false);
  const canDismissOnClickAwayRef = useRef(true);

  // --- Derived values from the unified openEditors map ---

  const editingNoteIds = useMemo(() => {
    const s = new Set<Id<"notes">>();
    for (const slot of openEditors.values()) {
      if (slot.kind === "edit") s.add(slot.noteId);
    }
    return s;
  }, [openEditors]);

  const newDraftsByAnchor = useMemo(() => {
    const m = new Map<number, VerseRef[]>();
    for (const slot of openEditors.values()) {
      if (slot.kind !== "new") continue;
      const anchor = slot.verseRef.startVerse;
      const arr = m.get(anchor);
      if (arr) {
        arr.push(slot.verseRef);
      } else {
        m.set(anchor, [slot.verseRef]);
      }
    }
    return m;
  }, [openEditors]);

  const draftCoveredVerses = useMemo(() => {
    const s = new Set<number>();
    for (const slot of openEditors.values()) {
      if (slot.kind !== "new") continue;
      for (
        let v = slot.verseRef.startVerse;
        v <= slot.verseRef.endVerse;
        v++
      ) {
        s.add(v);
      }
    }
    return s;
  }, [openEditors]);

  const passageDraftVerses = useMemo(() => {
    const s = new Set<number>();
    for (const slot of openEditors.values()) {
      if (slot.kind !== "new") continue;
      if (slot.verseRef.startVerse === slot.verseRef.endVerse) continue;
      for (
        let v = slot.verseRef.startVerse;
        v <= slot.verseRef.endVerse;
        v++
      ) {
        s.add(v);
      }
    }
    return s;
  }, [openEditors]);

  const canDismissOnClickAway =
    openEditors.size <= 1 && editorHasChanges.size === 0;

  useEffect(() => {
    canDismissOnClickAwayRef.current = canDismissOnClickAway;
  }, [canDismissOnClickAway]);

  const selectedVerses = useMemo(() => {
    if (draftCoveredVerses.size === 0) return viewSelectedVerses;
    if (viewSelectedVerses.size === 0) return draftCoveredVerses;
    const s = new Set(viewSelectedVerses);
    for (const v of draftCoveredVerses) s.add(v);
    return s;
  }, [draftCoveredVerses, viewSelectedVerses]);

  // --- Reset on chapter change ---

  useEffect(() => {
    queueMicrotask(() => {
      setViewSelectedVerses(new Set());
      setHoveredVerse(null);
      setHoveredSingleBubble(null);
      setHoveredPassageBubble(null);
      setOpenVerseKey(null);
      setOpenPassageKey(null);
      setOpenEditors(new Map());
      setEditorHasChanges(new Set());
      setIsPassageSelection(false);
    });
  }, [book, chapter]);

  // --- Outside click ---

  useEffect(() => {
    function handleOutsideClick(event: MouseEvent) {
      if (suppressNextDocumentClickRef.current) {
        suppressNextDocumentClickRef.current = false;
        return;
      }

      const textSelection = window.getSelection();
      if (textSelection && !textSelection.isCollapsed) {
        return;
      }

      const path = event.composedPath();
      const hasSelectorInPath = (selector: string) =>
        path.some((node) => node instanceof Element && node.matches(selector));
      const isInteractiveTarget =
        hasSelectorInPath("[data-note-trigger]") ||
        hasSelectorInPath("[data-note-surface]") ||
        hasSelectorInPath("[data-verse-number]");

      if (!isInteractiveTarget) {
        if (canDismissOnClickAwayRef.current) {
          setOpenVerseKey(null);
          setOpenPassageKey(null);
          setOpenEditors(new Map());
          setEditorHasChanges(new Set());
          setViewSelectedVerses(new Set());
          setIsPassageSelection(false);
        }
      }
    }

    document.addEventListener("click", handleOutsideClick);
    return () => document.removeEventListener("click", handleOutsideClick);
  }, []);

  // --- Helpers ---

  const getSelectedVersesForPassageAnchor = useCallback(
    (anchorVerse: number) => {
      const passageNotes = passageNotesByAnchor.get(anchorVerse) ?? [];
      if (passageNotes.length === 0) {
        return new Set([anchorVerse]);
      }

      const verses = new Set<number>();
      for (const note of passageNotes) {
        const { startVerse, endVerse } = note.verseRef;
        for (let verse = startVerse; verse <= endVerse; verse += 1) {
          verses.add(verse);
        }
      }
      return verses;
    },
    [passageNotesByAnchor],
  );

  const addNewDraft = useCallback(
    (ref: VerseRef) => {
      setOpenEditors((prev) => {
        const key = newEditorKey(ref);
        if (prev.has(key)) return prev;
        const next = new Map(prev);
        next.set(key, { kind: "new", verseRef: ref });
        return next;
      });
    },
    [],
  );

  const removeEditor = useCallback((key: string) => {
    setOpenEditors((prev) => {
      if (!prev.has(key)) return prev;
      const next = new Map(prev);
      next.delete(key);
      return next;
    });
    setEditorHasChanges((prev) => {
      if (!prev.has(key)) return prev;
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
  }, []);

  // --- Selection complete ---

  const handleSelectionComplete = useCallback(
    (selection: { startVerse: number; endVerse: number }) => {
      if (selection.startVerse === selection.endVerse) {
        const verseNumber = selection.startVerse;
        const singleNotes = singleVerseNotes.get(verseNumber) ?? [];
        const passageAnchor = verseToPassageAnchor.get(verseNumber);

        setIsPassageSelection(false);

        if (singleNotes.length > 0) {
          setViewSelectedVerses(new Set([verseNumber]));
          setOpenVerseKey(verseNumber);
          setOpenPassageKey(null);
        } else if (passageAnchor === verseNumber) {
          setViewSelectedVerses(
            getSelectedVersesForPassageAnchor(verseNumber),
          );
          setOpenPassageKey(verseNumber);
          setOpenVerseKey(null);
        } else {
          addNewDraft({
            book,
            chapter,
            startVerse: verseNumber,
            endVerse: verseNumber,
          });
        }
        return;
      }

      addNewDraft({
        book,
        chapter,
        startVerse: selection.startVerse,
        endVerse: selection.endVerse,
      });
      setIsPassageSelection(true);
    },
    [
      addNewDraft,
      book,
      chapter,
      getSelectedVersesForPassageAnchor,
      singleVerseNotes,
      verseToPassageAnchor,
    ],
  );

  // --- Mouse/selection ---

  const {
    isInSelection,
    handleMouseDown,
    handleMouseEnter: handleSelectionMouseEnter,
    handleMouseUp: selectionHandleMouseUp,
    clearSelection,
  } = useVerseSelection(handleSelectionComplete);

  const handleVerseMouseDown = useCallback(
    (verseNumber: number) => {
      if (selectedVerses.has(verseNumber)) return;
      handleMouseDown(verseNumber);
    },
    [handleMouseDown, selectedVerses],
  );

  const handleMouseEnter = useCallback(
    (verseNumber: number) => {
      setHoveredVerse(verseNumber);
      handleSelectionMouseEnter(verseNumber);
    },
    [handleSelectionMouseEnter],
  );

  const handleMouseLeave = useCallback(() => {
    setHoveredVerse(null);
  }, []);

  const handleMouseUp = useCallback(() => {
    const didCompleteSelection = selectionHandleMouseUp();
    if (didCompleteSelection) {
      suppressNextDocumentClickRef.current = true;
    }
    setHoveredVerse(null);
  }, [selectionHandleMouseUp]);

  const handleSingleBubbleMouseEnter = useCallback((verseNumber: number) => {
    setHoveredSingleBubble(verseNumber);
  }, []);

  const handleSingleBubbleMouseLeave = useCallback(() => {
    setHoveredSingleBubble(null);
  }, []);

  const handlePassageBubbleMouseEnter = useCallback((verseNumber: number) => {
    setHoveredPassageBubble(verseNumber);
  }, []);

  const handlePassageBubbleMouseLeave = useCallback(() => {
    setHoveredPassageBubble(null);
  }, []);

  // --- Note actions ---

  const handleAddNote = useCallback(
    (verseNumber: number) => {
      addNewDraft({
        book,
        chapter,
        startVerse: verseNumber,
        endVerse: verseNumber,
      });
      setIsPassageSelection(false);
    },
    [addNewDraft, book, chapter],
  );

  const notifyEditorDirty = useCallback(
    (key: string, isDirty: boolean) => {
      setEditorHasChanges((prev) => {
        const alreadyTracked = prev.has(key);
        if (isDirty === alreadyTracked) return prev;
        const next = new Set(prev);
        if (isDirty) {
          next.add(key);
        } else {
          next.delete(key);
        }
        return next;
      });
    },
    [],
  );

  const handleSaveNew = useCallback(
    async (verseRef: VerseRef, body: NoteBody, tags: string[]) => {
      await onSaveNewNote(verseRef, body, tags);
      removeEditor(newEditorKey(verseRef));
      if (verseRef.startVerse !== verseRef.endVerse) {
        setOpenPassageKey(verseRef.startVerse);
        setOpenVerseKey(null);
      } else {
        setOpenVerseKey(verseRef.startVerse);
        setOpenPassageKey(null);
      }
    },
    [onSaveNewNote, removeEditor],
  );

  const handleSaveEdit = useCallback(
    async (noteId: Id<"notes">, body: NoteBody, tags: string[]) => {
      await onSaveEditNote(noteId, body, tags);
      removeEditor(editEditorKey(noteId));
    },
    [onSaveEditNote, removeEditor],
  );

  const handleDelete = useCallback(
    async (noteId: Id<"notes">) => {
      await onDeleteNote(noteId);
    },
    [onDeleteNote],
  );

  const handleClickAway = useCallback(() => {
    setOpenVerseKey(null);
    setOpenPassageKey(null);
    setOpenEditors(new Map());
    setEditorHasChanges(new Set());
    setViewSelectedVerses(new Set());
    setIsPassageSelection(false);
    clearSelection();
  }, [clearSelection]);

  const cancelEditor = useCallback(
    (key: string) => {
      removeEditor(key);
    },
    [removeEditor],
  );

  // --- Escape key ---

  useEffect(() => {
    function handleEscapeKey(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      if (
        openVerseKey === null &&
        openPassageKey === null &&
        openEditors.size === 0 &&
        viewSelectedVerses.size === 0
      ) {
        return;
      }
      if (editorHasChanges.size > 0) {
        setShowDiscardConfirmation(true);
        return;
      }
      handleClickAway();
    }

    document.addEventListener("keydown", handleEscapeKey);
    return () => document.removeEventListener("keydown", handleEscapeKey);
  }, [
    editorHasChanges,
    handleClickAway,
    openPassageKey,
    openVerseKey,
    openEditors,
    viewSelectedVerses,
  ]);

  // --- Open / edit note groups ---

  const openVerseNotes = useCallback((verseNumber: number) => {
    setOpenVerseKey(verseNumber);
    setOpenPassageKey(null);
    setViewSelectedVerses(new Set([verseNumber]));
  }, []);

  const closeVerseNotes = useCallback(() => {
    setOpenVerseKey(null);
  }, []);

  const openPassageNotes = useCallback(
    (verseNumber: number) => {
      setOpenPassageKey(verseNumber);
      setOpenVerseKey(null);
      setViewSelectedVerses(getSelectedVersesForPassageAnchor(verseNumber));
      setIsPassageSelection(true);
    },
    [getSelectedVersesForPassageAnchor],
  );

  const closePassageNotes = useCallback(() => {
    setOpenPassageKey(null);
  }, []);

  const startEditingNote = useCallback(
    (noteId: Id<"notes">, verseRef: VerseRef, verseNumber: number, isPassage: boolean) => {
      setOpenEditors((prev) => {
        const key = editEditorKey(noteId);
        if (prev.has(key)) return prev;
        const next = new Map(prev);
        next.set(key, { kind: "edit", noteId, verseRef });
        return next;
      });
      if (isPassage) {
        setOpenPassageKey(verseNumber);
        setOpenVerseKey(null);
        setViewSelectedVerses(getSelectedVersesForPassageAnchor(verseNumber));
        setIsPassageSelection(true);
      } else {
        setOpenVerseKey(verseNumber);
        setOpenPassageKey(null);
        setViewSelectedVerses(new Set([verseNumber]));
        setIsPassageSelection(false);
      }
    },
    [getSelectedVersesForPassageAnchor],
  );

  const startCreatingPassageNote = useCallback(
    (verseRef: VerseRef) => {
      addNewDraft(verseRef);
      setIsPassageSelection(true);
    },
    [addNewDraft],
  );

  const confirmDiscard = useCallback(() => {
    handleClickAway();
    setShowDiscardConfirmation(false);
  }, [handleClickAway]);

  const cancelDiscard = useCallback(() => {
    setShowDiscardConfirmation(false);
  }, []);

  return {
    selectedVerses,
    passageDraftVerses,
    canDismissOnClickAway,
    notifyEditorDirty,
    hoveredVerse,
    hoveredSingleBubble,
    hoveredPassageBubble,
    openVerseKey,
    openPassageKey,
    openEditors,
    editingNoteIds,
    newDraftsByAnchor,
    isPassageSelection,
    containerRef,
    isInSelection,
    handleVerseMouseDown,
    handleMouseEnter,
    handleMouseLeave,
    handleMouseUp,
    handleSingleBubbleMouseEnter,
    handleSingleBubbleMouseLeave,
    handlePassageBubbleMouseEnter,
    handlePassageBubbleMouseLeave,
    handleAddNote,
    handleSaveNew,
    handleSaveEdit,
    handleDelete,
    handleClickAway,
    cancelEditor,
    openVerseNotes,
    closeVerseNotes,
    openPassageNotes,
    closePassageNotes,
    startEditingNote,
    startCreatingPassageNote,
    showDiscardConfirmation,
    confirmDiscard,
    cancelDiscard,
  };
}

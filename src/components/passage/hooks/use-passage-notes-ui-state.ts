import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { Id } from "../../../../convex/_generated/dataModel";
import { useVerseSelection } from "@/hooks/use-verse-selection";
import { logInteraction } from "@/lib/dev-log";
import type { NoteBody } from "@/lib/note-inline-content";
import type { VerseRef } from "@/lib/verse-ref-utils";
import type { NoteWithRef } from "@/components/notes/model/note-model";

type PassageViewMode = "compose" | "read";

interface UsePassageNotesUiStateOptions {
  book: string;
  chapter: number;
  viewMode: PassageViewMode;
  /** Parent passage view mode setter; used when switching modes clears notes UI state. */
  setViewMode: (next: PassageViewMode) => void;
  isFocusMode: boolean;
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

export interface ExpandedPassageRange {
  anchorVerse: number;
  startVerse: number;
  endVerse: number;
}

export interface PassageNotesUiState {
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
  setViewModeWithNotesReset: (next: PassageViewMode) => void;
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

function getVerseRefLogDetails(verseRef: VerseRef): {
  book: string;
  chapter: number;
  startVerse: number;
  endVerse: number;
  isPassage: boolean;
} {
  return {
    book: verseRef.book,
    chapter: verseRef.chapter,
    startVerse: verseRef.startVerse,
    endVerse: verseRef.endVerse,
    isPassage: verseRef.startVerse !== verseRef.endVerse,
  };
}

export function usePassageNotesUiState({
  book,
  chapter,
  viewMode,
  setViewMode,
  isFocusMode,
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
  const [hoveredSingleBubble, setHoveredSingleBubble] = useState<number | null>(
    null,
  );
  const [hoveredPassageBubble, setHoveredPassageBubble] = useState<
    number | null
  >(null);
  const [openVerseKeys, setOpenVerseKeys] = useState<Set<number>>(new Set());
  const [openPassageKeys, setOpenPassageKeys] = useState<Set<number>>(
    new Set(),
  );
  const [isPassageSelection, setIsPassageSelection] = useState(false);
  const [showDiscardConfirmation, setShowDiscardConfirmation] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const suppressNextDocumentClickRef = useRef(false);
  const editorHasChangesRef = useRef<Set<string>>(new Set());
  /** Anchors the user collapsed in read mode; skip auto-reopen until chapter change. */
  const readPassageAutoOpenSuppressedRef = useRef<Set<number>>(new Set());
  const pendingViewModeAfterDiscardRef = useRef<PassageViewMode | null>(null);
  const pendingReadModeEditorActionRef = useRef<(() => void) | null>(null);
  const openEditorsRef = useRef(openEditors);
  useLayoutEffect(() => {
    openEditorsRef.current = openEditors;
  }, [openEditors]);

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
      for (let v = slot.verseRef.startVerse; v <= slot.verseRef.endVerse; v++) {
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
      for (let v = slot.verseRef.startVerse; v <= slot.verseRef.endVerse; v++) {
        s.add(v);
      }
    }
    return s;
  }, [openEditors]);

  const hasDirtyEditors = editorHasChanges.size > 0;

  const expandedPassageRanges = useMemo(() => {
    const ranges: ExpandedPassageRange[] = [];

    for (const anchor of openPassageKeys) {
      const notes = passageNotesByAnchor.get(anchor);
      if (!notes || notes.length === 0) continue;
      let minVerse = Infinity;
      let maxVerse = -Infinity;
      for (const note of notes) {
        minVerse = Math.min(minVerse, note.verseRef.startVerse);
        maxVerse = Math.max(maxVerse, note.verseRef.endVerse);
      }
      ranges.push({
        anchorVerse: anchor,
        startVerse: minVerse,
        endVerse: maxVerse,
      });
    }

    for (const [, slot] of openEditors) {
      if (
        slot.kind === "new" &&
        slot.verseRef.startVerse !== slot.verseRef.endVerse
      ) {
        const anchor = slot.verseRef.startVerse;
        if (!ranges.some((r) => r.anchorVerse === anchor)) {
          ranges.push({
            anchorVerse: anchor,
            startVerse: slot.verseRef.startVerse,
            endVerse: slot.verseRef.endVerse,
          });
        }
      }
    }

    for (const noteId of editingNoteIds) {
      for (const [anchor, notes] of passageNotesByAnchor) {
        if (notes.some((n) => n.noteId === noteId)) {
          if (!ranges.some((r) => r.anchorVerse === anchor)) {
            let minV = Infinity;
            let maxV = -Infinity;
            for (const note of notes) {
              minV = Math.min(minV, note.verseRef.startVerse);
              maxV = Math.max(maxV, note.verseRef.endVerse);
            }
            ranges.push({
              anchorVerse: anchor,
              startVerse: minV,
              endVerse: maxV,
            });
          }
        }
      }
    }

    return ranges;
  }, [openPassageKeys, passageNotesByAnchor, openEditors, editingNoteIds]);

  useEffect(() => {
    editorHasChangesRef.current = editorHasChanges;
  }, [editorHasChanges]);

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
      readPassageAutoOpenSuppressedRef.current.clear();
      setViewSelectedVerses(new Set());
      setHoveredVerse(null);
      setHoveredSingleBubble(null);
      setHoveredPassageBubble(null);
      setOpenVerseKeys(new Set());
      setOpenPassageKeys(new Set());
      setOpenEditors(new Map());
      setEditorHasChanges(new Set());
      setIsPassageSelection(false);
    });
  }, [book, chapter]);

  // After chapter reset (microtask above), open passage groups in read mode when
  // the passage span has no per-verse notes. Re-run when note data loads.
  useEffect(() => {
    if (viewMode !== "read") return;
    queueMicrotask(() => {
      setOpenPassageKeys((prev) => {
        const next = new Set(prev);
        const suppressed = readPassageAutoOpenSuppressedRef.current;
        for (const [anchor, notes] of passageNotesByAnchor) {
          if (notes.length === 0) continue;
          if (suppressed.has(anchor)) continue;
          let minVerse = Infinity;
          let maxVerse = -Infinity;
          for (const note of notes) {
            minVerse = Math.min(minVerse, note.verseRef.startVerse);
            maxVerse = Math.max(maxVerse, note.verseRef.endVerse);
          }
          let hasVerseNoteInRange = false;
          for (let v = minVerse; v <= maxVerse; v++) {
            if ((singleVerseNotes.get(v)?.length ?? 0) > 0) {
              hasVerseNoteInRange = true;
              break;
            }
          }
          if (!hasVerseNoteInRange) next.add(anchor);
        }
        return next;
      });
    });
  }, [viewMode, passageNotesByAnchor, singleVerseNotes]);

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

      if (isInsideInteractiveSurface(event)) return;
      if (isInsideDismissExemptChrome(event)) return;

      setOpenVerseKeys(new Set());
      if (viewMode !== "read") {
        setOpenPassageKeys(new Set());
      }
      setViewSelectedVerses(new Set());
      setIsPassageSelection(false);

      const dirtyKeys = editorHasChangesRef.current;
      if (dirtyKeys.size === 0) {
        setOpenEditors(new Map());
        setEditorHasChanges(new Set());
      } else {
        setOpenEditors((prev) => {
          const next = new Map<string, EditorSlot>();
          for (const [key, slot] of prev) {
            if (dirtyKeys.has(key)) next.set(key, slot);
          }
          return next;
        });
      }
    }

    document.addEventListener("click", handleOutsideClick);
    return () => document.removeEventListener("click", handleOutsideClick);
  }, [viewMode]);

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

  const addNewDraft = useCallback((ref: VerseRef) => {
    const key = newEditorKey(ref);
    if (openEditorsRef.current.has(key)) return;
    logInteraction("notes", "editor-opened", {
      mode: "create",
      ...getVerseRefLogDetails(ref),
    });
    setOpenEditors((prev) => {
      if (prev.has(key)) return prev;
      const next = new Map(prev);
      next.set(key, { kind: "new", verseRef: ref });
      return next;
    });
  }, []);

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

  /**
   * In read mode, allow only one editor at a time. If another editor is open,
   * either silently close it (clean) or show the discard dialog (dirty).
   * Returns true when the action was executed immediately.
   */
  const gateReadModeEditor = useCallback(
    (action: () => void): boolean => {
      if (viewMode !== "read") {
        action();
        return true;
      }
      const currentEditors = openEditorsRef.current;
      if (currentEditors.size === 0) {
        action();
        return true;
      }
      const dirtyKeys = editorHasChangesRef.current;
      if (dirtyKeys.size > 0) {
        pendingReadModeEditorActionRef.current = action;
        setShowDiscardConfirmation(true);
        return false;
      }
      setOpenEditors(new Map());
      setEditorHasChanges(new Set());
      action();
      return true;
    },
    [viewMode],
  );

  // --- Selection complete ---

  const handleSelectionComplete = useCallback(
    (selection: { startVerse: number; endVerse: number }) => {
      const executeSelection = () => {
        if (selection.startVerse === selection.endVerse) {
          const verseNumber = selection.startVerse;
          const singleNotes = singleVerseNotes.get(verseNumber) ?? [];
          const passageAnchor = verseToPassageAnchor.get(verseNumber);

          setIsPassageSelection(false);

          if (singleNotes.length > 0) {
            if (isFocusMode) {
              setOpenVerseKeys(new Set([verseNumber]));
              setOpenPassageKeys(new Set());
              setViewSelectedVerses(new Set([verseNumber]));
            } else {
              setViewSelectedVerses((prev) => new Set(prev).add(verseNumber));
              setOpenVerseKeys((prev) => new Set(prev).add(verseNumber));
            }
          } else if (passageAnchor === verseNumber) {
            const passageVerses =
              getSelectedVersesForPassageAnchor(verseNumber);
            if (isFocusMode) {
              setOpenPassageKeys(new Set([verseNumber]));
              setOpenVerseKeys(new Set());
              setViewSelectedVerses(new Set(passageVerses));
            } else {
              setViewSelectedVerses((prev) => {
                const next = new Set(prev);
                for (const v of passageVerses) next.add(v);
                return next;
              });
              setOpenPassageKeys((prev) => new Set(prev).add(verseNumber));
            }
          } else {
            if (isFocusMode) {
              setOpenVerseKeys(new Set());
              setOpenPassageKeys(new Set());
            }
            addNewDraft({
              book,
              chapter,
              startVerse: verseNumber,
              endVerse: verseNumber,
            });
            setViewSelectedVerses(
              isFocusMode
                ? new Set([verseNumber])
                : (prev) => new Set(prev).add(verseNumber),
            );
          }
          return;
        }

        if (isFocusMode) {
          setOpenVerseKeys(new Set());
          setOpenPassageKeys(new Set());
        }
        addNewDraft({
          book,
          chapter,
          startVerse: selection.startVerse,
          endVerse: selection.endVerse,
        });
        setIsPassageSelection(true);
      };

      gateReadModeEditor(executeSelection);
    },
    [
      addNewDraft,
      book,
      chapter,
      gateReadModeEditor,
      getSelectedVersesForPassageAnchor,
      isFocusMode,
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

  const fullResetForModeSwitch = useCallback(() => {
    setOpenVerseKeys(new Set());
    setOpenPassageKeys(new Set());
    setOpenEditors(new Map());
    setEditorHasChanges(new Set());
    setViewSelectedVerses(new Set());
    setIsPassageSelection(false);
    clearSelection();
  }, [clearSelection]);

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
      gateReadModeEditor(() => {
        if (isFocusMode) {
          setOpenPassageKeys(new Set());
        }
        addNewDraft({
          book,
          chapter,
          startVerse: verseNumber,
          endVerse: verseNumber,
        });
        const existingNotes = singleVerseNotes.get(verseNumber) ?? [];
        if (existingNotes.length > 0) {
          if (isFocusMode) {
            setOpenVerseKeys(new Set([verseNumber]));
          } else {
            setOpenVerseKeys((prev) => new Set(prev).add(verseNumber));
          }
        } else if (isFocusMode) {
          setOpenVerseKeys(new Set());
        }
        setViewSelectedVerses(
          isFocusMode
            ? new Set([verseNumber])
            : (prev) => new Set(prev).add(verseNumber),
        );
        setIsPassageSelection(false);
      });
    },
    [
      addNewDraft,
      book,
      chapter,
      gateReadModeEditor,
      isFocusMode,
      singleVerseNotes,
    ],
  );

  const notifyEditorDirty = useCallback((key: string, isDirty: boolean) => {
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
  }, []);

  const handleSaveNew = useCallback(
    async (verseRef: VerseRef, body: NoteBody, tags: string[]) => {
      await onSaveNewNote(verseRef, body, tags);
      removeEditor(newEditorKey(verseRef));
      if (verseRef.startVerse !== verseRef.endVerse) {
        if (isFocusMode) {
          setOpenPassageKeys(new Set([verseRef.startVerse]));
          setOpenVerseKeys(new Set());
        } else {
          setOpenPassageKeys((prev) => new Set(prev).add(verseRef.startVerse));
        }
      } else {
        if (isFocusMode) {
          setOpenVerseKeys(new Set([verseRef.startVerse]));
          setOpenPassageKeys(new Set());
        } else {
          setOpenVerseKeys((prev) => new Set(prev).add(verseRef.startVerse));
        }
      }
    },
    [isFocusMode, onSaveNewNote, removeEditor],
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

  const clearCancelledDraftSelection = useCallback(
    (verseRef: VerseRef) => {
      setViewSelectedVerses((prev) => {
        if (prev.size === 0) return prev;

        const next = new Set(prev);
        for (
          let verse = verseRef.startVerse;
          verse <= verseRef.endVerse;
          verse += 1
        ) {
          next.delete(verse);
        }

        if (
          verseRef.startVerse === verseRef.endVerse &&
          openVerseKeys.has(verseRef.startVerse) &&
          (singleVerseNotes.get(verseRef.startVerse)?.length ?? 0) > 0
        ) {
          next.add(verseRef.startVerse);
        }

        for (const anchor of openPassageKeys) {
          const passageVerses = getSelectedVersesForPassageAnchor(anchor);
          const hadExplicitSelection = Array.from(passageVerses).some((verse) =>
            prev.has(verse),
          );
          if (!hadExplicitSelection) continue;
          for (const verse of passageVerses) {
            next.add(verse);
          }
        }

        return next;
      });
    },
    [
      getSelectedVersesForPassageAnchor,
      openPassageKeys,
      openVerseKeys,
      singleVerseNotes,
    ],
  );

  const handleClickAway = useCallback(() => {
    setOpenVerseKeys(new Set());
    if (viewMode !== "read") {
      setOpenPassageKeys(new Set());
    }
    setOpenEditors(new Map());
    setEditorHasChanges(new Set());
    setViewSelectedVerses(new Set());
    setIsPassageSelection(false);
    clearSelection();
  }, [clearSelection, viewMode]);

  const setViewModeWithNotesReset = useCallback(
    (next: PassageViewMode) => {
      if (next === viewMode) return;
      if (editorHasChanges.size > 0) {
        pendingViewModeAfterDiscardRef.current = next;
        setShowDiscardConfirmation(true);
        return;
      }
      fullResetForModeSwitch();
      setViewMode(next);
    },
    [editorHasChanges, fullResetForModeSwitch, setViewMode, viewMode],
  );

  const cancelEditor = useCallback(
    (key: string) => {
      const slot = openEditorsRef.current.get(key);
      if (slot) {
        logInteraction("notes", "editor-cancelled", {
          mode: slot.kind === "new" ? "create" : "edit",
          noteId: slot.kind === "edit" ? slot.noteId : undefined,
          ...getVerseRefLogDetails(slot.verseRef),
        });
      }
      removeEditor(key);
      if (slot?.kind === "new") {
        clearCancelledDraftSelection(slot.verseRef);
      }
    },
    [clearCancelledDraftSelection, removeEditor],
  );

  // --- Escape key ---

  useEffect(() => {
    function handleEscapeKey(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      if (
        openVerseKeys.size === 0 &&
        openPassageKeys.size === 0 &&
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
    openPassageKeys,
    openVerseKeys,
    openEditors,
    viewSelectedVerses,
  ]);

  // --- Open / edit note groups ---

  const openVerseNotes = useCallback(
    (verseNumber: number) => {
      if (isFocusMode) {
        setOpenVerseKeys(new Set([verseNumber]));
        setOpenPassageKeys(new Set());
        setViewSelectedVerses(new Set([verseNumber]));
      } else {
        setOpenVerseKeys((prev) => new Set(prev).add(verseNumber));
        setViewSelectedVerses((prev) => new Set(prev).add(verseNumber));
      }
      setIsPassageSelection(false);
    },
    [isFocusMode],
  );

  const closeVerseNotes = useCallback((verseNumber: number) => {
    setOpenVerseKeys((prev) => {
      const next = new Set(prev);
      next.delete(verseNumber);
      return next;
    });
    setViewSelectedVerses((prev) => {
      const next = new Set(prev);
      next.delete(verseNumber);
      return next;
    });
  }, []);

  const openPassageNotes = useCallback(
    (verseNumber: number) => {
      readPassageAutoOpenSuppressedRef.current.delete(verseNumber);
      const passageVerses = getSelectedVersesForPassageAnchor(verseNumber);
      if (isFocusMode) {
        setOpenPassageKeys(new Set([verseNumber]));
        setOpenVerseKeys(new Set());
        setViewSelectedVerses(new Set(passageVerses));
      } else {
        setOpenPassageKeys((prev) => new Set(prev).add(verseNumber));
        setOpenVerseKeys((prev) => {
          const next = new Set(prev);
          for (const v of passageVerses) {
            next.delete(v);
          }
          return next;
        });
        setViewSelectedVerses((prev) => {
          const next = new Set(prev);
          for (const v of passageVerses) next.add(v);
          return next;
        });
      }
      setIsPassageSelection(true);
    },
    [getSelectedVersesForPassageAnchor, isFocusMode],
  );

  const closePassageNotes = useCallback(
    (verseNumber: number) => {
      if (viewMode === "read") {
        readPassageAutoOpenSuppressedRef.current.add(verseNumber);
      }
      setOpenPassageKeys((prev) => {
        const next = new Set(prev);
        next.delete(verseNumber);
        return next;
      });
      const passageVerses = getSelectedVersesForPassageAnchor(verseNumber);
      setViewSelectedVerses((prev) => {
        const next = new Set(prev);
        for (const v of passageVerses) next.delete(v);
        return next;
      });
    },
    [getSelectedVersesForPassageAnchor, viewMode],
  );

  const startEditingNote = useCallback(
    (
      noteId: Id<"notes">,
      verseRef: VerseRef,
      verseNumber: number,
      isPassage: boolean,
    ) => {
      gateReadModeEditor(() => {
        const key = editEditorKey(noteId);
        if (openEditorsRef.current.has(key)) return;
        logInteraction("notes", "editor-opened", {
          mode: "edit",
          noteId,
          ...getVerseRefLogDetails(verseRef),
          isPassage,
        });
        setOpenEditors((prev) => {
          if (prev.has(key)) return prev;
          const next = new Map(prev);
          next.set(key, { kind: "edit", noteId, verseRef });
          return next;
        });
        if (isPassage) {
          setOpenPassageKeys((prev) => new Set(prev).add(verseNumber));
          const passageVerses = getSelectedVersesForPassageAnchor(verseNumber);
          setViewSelectedVerses((prev) => {
            const next = new Set(prev);
            for (const v of passageVerses) next.add(v);
            return next;
          });
          setIsPassageSelection(true);
        } else {
          setOpenVerseKeys((prev) => new Set(prev).add(verseNumber));
          setViewSelectedVerses((prev) => new Set(prev).add(verseNumber));
          setIsPassageSelection(false);
        }
      });
    },
    [gateReadModeEditor, getSelectedVersesForPassageAnchor],
  );

  const startCreatingPassageNote = useCallback(
    (verseRef: VerseRef) => {
      gateReadModeEditor(() => {
        addNewDraft(verseRef);
        setIsPassageSelection(true);
      });
    },
    [addNewDraft, gateReadModeEditor],
  );

  const confirmDiscard = useCallback(() => {
    const pendingViewMode = pendingViewModeAfterDiscardRef.current;
    const pendingEditorAction = pendingReadModeEditorActionRef.current;
    if (editorHasChangesRef.current.size > 0) {
      logInteraction("notes", "discard-confirmed", {
        dirtyEditorCount: editorHasChangesRef.current.size,
      });
    }
    pendingViewModeAfterDiscardRef.current = null;
    pendingReadModeEditorActionRef.current = null;
    setShowDiscardConfirmation(false);
    if (pendingViewMode !== null) {
      fullResetForModeSwitch();
      setViewMode(pendingViewMode);
    } else if (pendingEditorAction !== null) {
      setOpenEditors(new Map());
      setEditorHasChanges(new Set());
      pendingEditorAction();
    } else {
      handleClickAway();
    }
  }, [fullResetForModeSwitch, handleClickAway, setViewMode]);

  const cancelDiscard = useCallback(() => {
    if (editorHasChangesRef.current.size > 0) {
      logInteraction("notes", "discard-cancelled", {
        dirtyEditorCount: editorHasChangesRef.current.size,
      });
    }
    pendingViewModeAfterDiscardRef.current = null;
    pendingReadModeEditorActionRef.current = null;
    setShowDiscardConfirmation(false);
  }, []);

  return {
    selectedVerses,
    passageDraftVerses,
    expandedPassageRanges,
    hasDirtyEditors,
    notifyEditorDirty,
    hoveredVerse,
    hoveredSingleBubble,
    hoveredPassageBubble,
    openVerseKeys,
    openPassageKeys,
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
    setViewModeWithNotesReset,
  };
}

const INTERACTIVE_SURFACE_SELECTORS = [
  "[data-note-trigger]",
  "[data-note-surface]",
  "[data-verse-number]",
  "[data-highlight-popover]",
  "[data-highlight-toolbar]",
] as const;

const DISMISS_EXEMPT_SELECTOR = "[data-passage-dismiss-exempt]";

function isInsideInteractiveSurface(event: MouseEvent): boolean {
  const path = event.composedPath();
  return path.some(
    (node) =>
      node instanceof Element &&
      INTERACTIVE_SURFACE_SELECTORS.some((sel) => node.matches(sel)),
  );
}

function isInsideDismissExemptChrome(event: MouseEvent): boolean {
  const path = event.composedPath();
  return path.some(
    (node) => node instanceof Element && node.matches(DISMISS_EXEMPT_SELECTOR),
  );
}

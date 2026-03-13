import { useCallback, useEffect, useRef, useState } from "react";
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

export function usePassageNotesUiState({
  book,
  chapter,
  singleVerseNotes,
  passageNotesByAnchor,
  verseToPassageAnchor,
  onSaveNewNote,
  onSaveEditNote,
  onDeleteNote,
}: UsePassageNotesUiStateOptions) {
  const [selectedVerses, setSelectedVerses] = useState<Set<number>>(new Set());
  const [hoveredVerse, setHoveredVerse] = useState<number | null>(null);
  const [hoveredSingleBubble, setHoveredSingleBubble] = useState<number | null>(
    null,
  );
  const [hoveredPassageBubble, setHoveredPassageBubble] = useState<
    number | null
  >(null);
  const [openVerseKey, setOpenVerseKey] = useState<number | null>(null);
  const [openPassageKey, setOpenPassageKey] = useState<number | null>(null);
  const [creatingFor, setCreatingFor] = useState<VerseRef | null>(null);
  const [editingNoteId, setEditingNoteId] = useState<Id<"notes"> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const suppressNextDocumentClickRef = useRef(false);

  useEffect(() => {
    queueMicrotask(() => {
      setSelectedVerses(new Set());
      setHoveredVerse(null);
      setHoveredSingleBubble(null);
      setHoveredPassageBubble(null);
      setOpenVerseKey(null);
      setOpenPassageKey(null);
      setCreatingFor(null);
      setEditingNoteId(null);
    });
  }, [book, chapter]);

  useEffect(() => {
    function handleOutsideClick(event: MouseEvent) {
      if (suppressNextDocumentClickRef.current) {
        suppressNextDocumentClickRef.current = false;
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
        setOpenVerseKey(null);
        setOpenPassageKey(null);
        setCreatingFor(null);
        setEditingNoteId(null);
        setSelectedVerses(new Set());
      }
    }

    document.addEventListener("click", handleOutsideClick);
    return () => document.removeEventListener("click", handleOutsideClick);
  }, []);

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

  const handleSelectionComplete = useCallback(
    (selection: { startVerse: number; endVerse: number }) => {
      if (selection.startVerse === selection.endVerse) {
        const verseNumber = selection.startVerse;
        const singleNotes = singleVerseNotes.get(verseNumber) ?? [];
        const passageAnchor = verseToPassageAnchor.get(verseNumber);

        setEditingNoteId(null);

        if (singleNotes.length > 0) {
          setSelectedVerses(new Set([verseNumber]));
          setOpenVerseKey(verseNumber);
          setOpenPassageKey(null);
          setCreatingFor(null);
        } else if (passageAnchor === verseNumber) {
          setSelectedVerses(getSelectedVersesForPassageAnchor(verseNumber));
          setOpenPassageKey(verseNumber);
          setOpenVerseKey(null);
          setCreatingFor(null);
        } else {
          setSelectedVerses(new Set([verseNumber]));
          setCreatingFor({
            book,
            chapter,
            startVerse: verseNumber,
            endVerse: verseNumber,
          });
          setOpenVerseKey(null);
          setOpenPassageKey(null);
        }
        return;
      }

      const verses = new Set<number>();
      for (
        let verse = selection.startVerse;
        verse <= selection.endVerse;
        verse += 1
      ) {
        verses.add(verse);
      }
      setSelectedVerses(verses);
      setCreatingFor({
        book,
        chapter,
        startVerse: selection.startVerse,
        endVerse: selection.endVerse,
      });
      setOpenVerseKey(null);
      setOpenPassageKey(null);
      setEditingNoteId(null);
    },
    [
      book,
      chapter,
      getSelectedVersesForPassageAnchor,
      singleVerseNotes,
      verseToPassageAnchor,
    ],
  );

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

  const handleAddNote = useCallback(
    (verseNumber: number) => {
      setCreatingFor({
        book,
        chapter,
        startVerse: verseNumber,
        endVerse: verseNumber,
      });
      setSelectedVerses(new Set([verseNumber]));
      setOpenVerseKey(null);
      setOpenPassageKey(null);
      setEditingNoteId(null);
    },
    [book, chapter],
  );

  const handleSaveNew = useCallback(
    async (body: NoteBody, tags: string[]) => {
      if (!creatingFor) return;
      await onSaveNewNote(creatingFor, body, tags);
      setCreatingFor(null);
      setSelectedVerses(new Set());

      if (creatingFor.startVerse !== creatingFor.endVerse) {
        setOpenPassageKey(creatingFor.startVerse);
        setOpenVerseKey(null);
      } else {
        setOpenVerseKey(creatingFor.startVerse);
        setOpenPassageKey(null);
      }
    },
    [creatingFor, onSaveNewNote],
  );

  const handleSaveEdit = useCallback(
    async (body: NoteBody, tags: string[]) => {
      if (!editingNoteId) return;
      await onSaveEditNote(editingNoteId, body, tags);
      setEditingNoteId(null);
    },
    [editingNoteId, onSaveEditNote],
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
    setCreatingFor(null);
    setEditingNoteId(null);
    setSelectedVerses(new Set());
    clearSelection();
  }, [clearSelection]);

  useEffect(() => {
    function handleEscapeKey(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      if (
        openVerseKey === null &&
        openPassageKey === null &&
        creatingFor === null &&
        editingNoteId === null &&
        selectedVerses.size === 0
      ) {
        return;
      }
      handleClickAway();
    }

    document.addEventListener("keydown", handleEscapeKey);
    return () => document.removeEventListener("keydown", handleEscapeKey);
  }, [
    creatingFor,
    editingNoteId,
    handleClickAway,
    openPassageKey,
    openVerseKey,
    selectedVerses,
  ]);

  const openVerseNotes = useCallback((verseNumber: number) => {
    setOpenVerseKey(verseNumber);
    setOpenPassageKey(null);
    setSelectedVerses(new Set([verseNumber]));
    setCreatingFor(null);
    setEditingNoteId(null);
  }, []);

  const openPassageNotes = useCallback(
    (verseNumber: number) => {
      setOpenPassageKey(verseNumber);
      setOpenVerseKey(null);
      setSelectedVerses(getSelectedVersesForPassageAnchor(verseNumber));
      setCreatingFor(null);
      setEditingNoteId(null);
    },
    [getSelectedVersesForPassageAnchor],
  );

  const startEditingNote = useCallback(
    (noteId: Id<"notes">, verseNumber: number, isPassage: boolean) => {
      setEditingNoteId(noteId);
      if (isPassage) {
        setOpenPassageKey(verseNumber);
        setOpenVerseKey(null);
        setSelectedVerses(getSelectedVersesForPassageAnchor(verseNumber));
      } else {
        setOpenVerseKey(verseNumber);
        setOpenPassageKey(null);
        setSelectedVerses(new Set([verseNumber]));
      }
    },
    [getSelectedVersesForPassageAnchor],
  );

  const cancelEditing = useCallback(() => {
    setEditingNoteId(null);
  }, []);

  const startCreatingPassageNote = useCallback((verseRef: VerseRef) => {
    setCreatingFor(verseRef);
  }, []);

  const isPassageSelection = creatingFor
    ? creatingFor.startVerse !== creatingFor.endVerse
    : selectedVerses.size > 1;

  return {
    selectedVerses,
    hoveredVerse,
    hoveredSingleBubble,
    hoveredPassageBubble,
    openVerseKey,
    openPassageKey,
    creatingFor,
    editingNoteId,
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
    openVerseNotes,
    openPassageNotes,
    startEditingNote,
    cancelEditing,
    startCreatingPassageNote,
  };
}

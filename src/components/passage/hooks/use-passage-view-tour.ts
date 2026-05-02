import { useEffect, useRef } from "react";
import { FOCUS_MODE_CENTER_VERSE } from "@/components/tutorial/focus-mode-tour";
import { useTutorial } from "@/components/tutorial/tutorial-context";
import type { NoteWithRef } from "@/components/notes/model/note-model";
import type { EditorSlot } from "./use-passage-notes-ui-state";

type PassageViewMode = "compose" | "read";

interface UsePassageViewTourParams {
  effectiveViewMode: PassageViewMode;
  setViewMode: (mode: PassageViewMode) => void;
  singleVerseNotes: Map<number, NoteWithRef[]>;
  openVerseKeys: Set<number>;
  openEditors: Map<string, EditorSlot>;
  handleClickAway: () => void;
  handleAddNote: (verse: number) => void;
  openVerseNotes: (verseNumber: number) => void;
}

export interface PassageViewTourState {
  forceAddButtonVisible: boolean;
  displaySingleVerseNotes: Map<number, NoteWithRef[]>;
}

/**
 * Drives passage-view side effects required by the trimmed first-run tour
 * (`add-note`, `note-body`) and the focus-mode tour. Reading-mode and
 * verse-link step handling have been removed because those features are now
 * taught contextually via staged onboarding hints.
 */
export function usePassageViewTour({
  effectiveViewMode,
  setViewMode,
  singleVerseNotes,
  openVerseKeys,
  openEditors,
  handleClickAway,
  handleAddNote,
  openVerseNotes,
}: UsePassageViewTourParams): PassageViewTourState {
  const { activeStep, activeTour } = useTutorial();

  const handleClickAwayRef = useRef(handleClickAway);
  const setViewModeRef = useRef(setViewMode);
  const handleAddNoteRef = useRef(handleAddNote);
  const openVerseNotesRef = useRef(openVerseNotes);
  const openVerseKeysRef = useRef(openVerseKeys);

  useEffect(() => {
    handleClickAwayRef.current = handleClickAway;
    setViewModeRef.current = setViewMode;
    handleAddNoteRef.current = handleAddNote;
    openVerseNotesRef.current = openVerseNotes;
    openVerseKeysRef.current = openVerseKeys;
  }, [
    handleClickAway,
    setViewMode,
    handleAddNote,
    openVerseNotes,
    openVerseKeys,
  ]);

  const isAddNoteStep = activeTour === "main" && activeStep?.id === "add-note";
  const isNoteEditorStep =
    activeTour === "main" && activeStep?.id === "note-body";

  useEffect(() => {
    if (activeTour !== "focusMode") return;

    const wasOpen = openVerseKeysRef.current.has(FOCUS_MODE_CENTER_VERSE);
    if (!wasOpen) {
      openVerseNotesRef.current(FOCUS_MODE_CENTER_VERSE);
    }
  }, [activeTour]);

  useEffect(() => {
    if (!(isAddNoteStep || isNoteEditorStep)) return;
    if (effectiveViewMode !== "compose") {
      setViewModeRef.current("compose");
    }
  }, [effectiveViewMode, isAddNoteStep, isNoteEditorStep]);

  useEffect(() => {
    if (!isAddNoteStep) return;
    handleClickAwayRef.current();
  }, [isAddNoteStep]);

  useEffect(() => {
    if (!isNoteEditorStep) return;

    const hasVerseOneEditor = openEditors.has("new:1:1");
    if (!hasVerseOneEditor || openEditors.size === 0) {
      handleAddNoteRef.current(1);
    }
  }, [openEditors, isNoteEditorStep]);

  return {
    forceAddButtonVisible: isAddNoteStep,
    displaySingleVerseNotes: singleVerseNotes,
  };
}

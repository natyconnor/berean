import { useEffect, useMemo, useRef } from "react";
import { FOCUS_MODE_CENTER_VERSE } from "@/components/tutorial/focus-mode-tour";
import { useTutorial } from "@/components/tutorial/tutorial-context";
import {
  buildTutorialReadingNotes,
  TUTORIAL_READING_BOOK,
  TUTORIAL_READING_CHAPTER,
} from "@/components/tutorial/tutorial-reading-notes";
import type { NoteWithRef } from "@/components/notes/model/note-model";
import type { EditorSlot } from "./use-passage-notes-ui-state";

type PassageViewMode = "compose" | "read";

interface UsePassageViewTourParams {
  book: string;
  chapter: number;
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

export function usePassageViewTour({
  book,
  chapter,
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
  const readingTourEnteredRef = useRef(false);

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
    activeTour === "main" &&
    (activeStep?.id === "note-body" ||
      activeStep?.id === "note-tags" ||
      activeStep?.id === "inline-links");
  const isReadingModeStep =
    activeTour === "main" && activeStep?.id === "reading-mode";

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

  // Do not list handleClickAway/setViewMode as deps: handleClickAway always
  // allocates new Sets, which recreates setViewModeWithNotesReset in the parent
  // and would retrigger this effect forever (max update depth on reading-mode).
  useEffect(() => {
    if (!isReadingModeStep) {
      readingTourEnteredRef.current = false;
      return;
    }
    if (!readingTourEnteredRef.current) {
      readingTourEnteredRef.current = true;
      handleClickAwayRef.current();
    }
    if (effectiveViewMode !== "read") {
      setViewModeRef.current("read");
    }
  }, [effectiveViewMode, isReadingModeStep]);

  const tutorialReadingNotes =
    isReadingModeStep &&
    book === TUTORIAL_READING_BOOK &&
    chapter === TUTORIAL_READING_CHAPTER
      ? buildTutorialReadingNotes(book, chapter)
      : null;

  const displaySingleVerseNotes = useMemo(
    () => tutorialReadingNotes ?? singleVerseNotes,
    [tutorialReadingNotes, singleVerseNotes],
  );

  return {
    forceAddButtonVisible: isAddNoteStep,
    displaySingleVerseNotes,
  };
}

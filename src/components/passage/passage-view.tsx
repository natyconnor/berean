import { useCallback, useState } from "react";
import { logInteraction } from "@/lib/dev-log";
import { useFocusMode } from "./hooks/use-focus-mode";
import { usePassageViewMode } from "./hooks/use-passage-view-mode";
import { PassageChapterView } from "./passage-chapter-view";

interface PassageViewProps {
  book: string;
  chapter: number;
  focusRange?: { startVerse: number; endVerse: number } | null;
  forcedViewMode?: PassageViewMode;
  focusSource?: "search";
}

type PassageViewMode = "compose" | "read";
type NoteVisibility = "all" | "noted";

export function PassageView({
  book,
  chapter,
  focusRange = null,
  forcedViewMode,
  focusSource,
}: PassageViewProps) {
  const { effectiveViewMode, isReadMode, setViewMode } = usePassageViewMode({
    focusRange,
    forcedViewMode,
    focusSource,
  });
  const handleSetViewMode = useCallback(
    (next: PassageViewMode) => {
      if (next === effectiveViewMode) return;
      logInteraction("reader", "view-mode-changed", {
        book,
        chapter,
        mode: next,
      });
      setViewMode(next);
    },
    [book, chapter, effectiveViewMode, setViewMode],
  );
  const { isFocusMode, toggleFocusMode } = useFocusMode();
  const [noteVisibility, setNoteVisibility] = useState<NoteVisibility>("all");
  const handleSetNoteVisibility = useCallback(
    (next: NoteVisibility) => {
      if (next === noteVisibility) return;
      logInteraction("reader", "note-visibility-changed", {
        book,
        chapter,
        visibility: next,
      });
      setNoteVisibility(next);
    },
    [book, chapter, noteVisibility],
  );

  return (
    <PassageChapterView
      key={`${book}-${chapter}`}
      book={book}
      chapter={chapter}
      focusRange={focusRange}
      effectiveViewMode={effectiveViewMode}
      isReadMode={isReadMode}
      setViewMode={handleSetViewMode}
      isFocusMode={isFocusMode}
      toggleFocusMode={toggleFocusMode}
      noteVisibility={noteVisibility}
      setNoteVisibility={handleSetNoteVisibility}
    />
  );
}

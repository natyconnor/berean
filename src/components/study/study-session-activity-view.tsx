import { useMemo } from "react";
import { StudyActivityDeck } from "./study-activity-deck";
import { buildStudyCards, type ActivityType } from "./study-card-model";

interface StudySessionActivityViewProps {
  activity: ActivityType;
  savedVerses: ReadonlyArray<{
    _id: string;
    book: string;
    chapter: number;
    startVerse: number;
    endVerse: number;
  }>;
  notes: ReadonlyArray<{
    noteId: string;
    content: string;
    tags: string[];
    refs: ReadonlyArray<{
      book: string;
      chapter: number;
      startVerse: number;
      endVerse: number;
    }>;
  }>;
  scopeLabel: string;
}

export function StudySessionActivityView({
  activity,
  savedVerses,
  notes,
  scopeLabel,
}: StudySessionActivityViewProps) {
  const cards = useMemo(
    () =>
      buildStudyCards(
        savedVerses.map((sv) => ({
          _id: sv._id,
          book: sv.book,
          chapter: sv.chapter,
          startVerse: sv.startVerse,
          endVerse: sv.endVerse,
        })),
        notes.map((n) => ({
          noteId: n.noteId,
          content: n.content,
          tags: n.tags,
          refs: n.refs.map((r) => ({
            book: r.book,
            chapter: r.chapter,
            startVerse: r.startVerse,
            endVerse: r.endVerse,
          })),
        })),
        activity,
      ),
    [activity, savedVerses, notes],
  );

  // Remount the deck when the *set* of cards changes so its internal queue is
  // rebuilt from the new cards. Order changes (shuffle) don't trigger a
  // remount because the sorted, deduped id set is identical.
  const deckKey = useMemo(
    () => [...new Set(cards.map((c) => c.id))].sort().join("\u0000"),
    [cards],
  );

  return (
    <StudyActivityDeck key={deckKey} cards={cards} scopeLabel={scopeLabel} />
  );
}

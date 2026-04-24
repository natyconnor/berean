import { devLog } from "@/lib/dev-log";
import { studyTeachDebugEnabled } from "@/lib/debug-study-teach";
import { formatVerseRef } from "@/lib/verse-ref-utils";
import { verseRefKey } from "../../../shared/verse-ref-key";

export type ActivityType = "verse-memory" | "teach";

export interface CardReference {
  book: string;
  chapter: number;
  startVerse: number;
  endVerse: number;
}

export interface VerseMemoryCard {
  type: "verse-memory";
  id: string;
  reference: CardReference;
}

export interface PassageNote {
  noteId: string;
  content: string;
  tags: string[];
}

export interface TeachCard {
  type: "teach";
  id: string;
  reference: CardReference;
  passageNotes: PassageNote[];
}

export type StudyCard = VerseMemoryCard | TeachCard;

export interface ResolvedSavedVerse {
  _id: string;
  book: string;
  chapter: number;
  startVerse: number;
  endVerse: number;
}

export interface ResolvedNote {
  noteId: string;
  content: string;
  tags: string[];
  refs: CardReference[];
}

function buildVerseMemoryCards(
  savedVerses: ResolvedSavedVerse[],
): VerseMemoryCard[] {
  return savedVerses.map((sv) => ({
    type: "verse-memory" as const,
    id: `vm:${sv._id}`,
    reference: {
      book: sv.book,
      chapter: sv.chapter,
      startVerse: sv.startVerse,
      endVerse: sv.endVerse,
    },
  }));
}

export function refEquals(a: CardReference, b: CardReference): boolean {
  return (
    a.book === b.book &&
    a.chapter === b.chapter &&
    a.startVerse === b.startVerse &&
    a.endVerse === b.endVerse
  );
}

export function collectPassageNotes(
  notes: ResolvedNote[],
  ref: CardReference,
): PassageNote[] {
  const matches: PassageNote[] = [];
  for (const note of notes) {
    if (note.refs.some((r) => refEquals(r, ref))) {
      matches.push({
        noteId: note.noteId,
        content: note.content,
        tags: note.tags,
      });
    }
  }
  matches.sort((a, b) => a.noteId.localeCompare(b.noteId));
  return matches;
}

/** Stable id segment for a passage (matches queue/ref keys in the study deck). */
export function referenceKey(ref: CardReference): string {
  return verseRefKey(ref);
}

/**
 * One Teach card per distinct verse/linked passage. Matches how {@link buildTeachCards} counts cards.
 */
export function countDistinctTeachPassageRefs(
  notes: ReadonlyArray<{
    refs: ReadonlyArray<{
      book: string;
      chapter: number;
      startVerse: number;
      endVerse: number;
    }>;
  }>,
): number {
  const keys = new Set<string>();
  for (const note of notes) {
    for (const r of note.refs) {
      keys.add(referenceKey(r as CardReference));
    }
  }
  return keys.size;
}

/** One teach card per distinct linked passage; notes for the same verse are merged on reveal. */
function buildTeachCards(notes: ResolvedNote[]): TeachCard[] {
  const uniqueRefs = new Map<string, CardReference>();
  for (const note of notes) {
    for (const r of note.refs) {
      const key = referenceKey(r);
      if (!uniqueRefs.has(key)) {
        uniqueRefs.set(key, r);
      }
    }
  }

  const cards: TeachCard[] = [];
  for (const ref of uniqueRefs.values()) {
    const key = referenceKey(ref);
    cards.push({
      type: "teach",
      id: `te:${key}`,
      reference: ref,
      passageNotes: collectPassageNotes(notes, ref),
    });
  }

  if (studyTeachDebugEnabled()) {
    const cardIds = cards.map((c) => c.id);
    const distinctCardIds = new Set(cardIds).size;
    devLog.info("studyTeach", "buildTeachCards", {
      inputNotes: notes.length,
      outputCards: cards.length,
      notesWithNoRefs: notes.filter((n) => n.refs.length === 0).length,
      distinctCardIds,
      duplicateCardIds: cards.length - distinctCardIds,
      distinctRefs: cards.length,
      cards: cards.map((c) => ({
        id: c.id,
        ref: formatVerseRef(c.reference),
        passageNoteIds: c.passageNotes.map((p) => p.noteId),
      })),
    });
  }

  return cards;
}

// Deterministic Fisher-Yates shuffle using a seeded value derived from the
// input ids so the order is stable for a given resolved scope but reshuffles
// when the underlying data changes. This avoids cards jumping around on every
// re-render while still feeling mixed.
function shuffleCards(cards: StudyCard[]): StudyCard[] {
  const seedSource = cards.map((c) => c.id).join("|");
  let seed = 0;
  for (let i = 0; i < seedSource.length; i++) {
    seed = (seed * 31 + seedSource.charCodeAt(i)) >>> 0;
  }

  const result = [...cards];
  for (let i = result.length - 1; i > 0; i--) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const j = seed % (i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function buildStudyCards(
  savedVerses: ResolvedSavedVerse[],
  notes: ResolvedNote[],
  activity: ActivityType,
): StudyCard[] {
  switch (activity) {
    case "verse-memory":
      return buildVerseMemoryCards(savedVerses);
    case "teach":
      // Shuffle so order is not dominated by Convex link iteration (e.g. all
      // of one chapter before another).
      return shuffleCards(buildTeachCards(notes));
  }
}

export function activityLabel(activity: ActivityType): string {
  switch (activity) {
    case "verse-memory":
      return "Verse Memory";
    case "teach":
      return "Teach";
  }
}

export type CardKind = "verse" | "note";

export function getCardKind(card: StudyCard): CardKind {
  return card.type === "verse-memory" ? "verse" : "note";
}

export function activityDescription(activity: ActivityType): string {
  switch (activity) {
    case "verse-memory":
      return "Recall hearted verses from memory";
    case "teach":
      return "Teach a point on the passage, then reveal your notes";
  }
}

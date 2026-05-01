export interface VerseRefKeyInput {
  book: string;
  chapter: number;
  startVerse: number;
  endVerse: number;
}

/**
 * Stable string key for a verse reference. Shared between Convex (distinct
 * passage counting) and client code (study deck card identity) so the two
 * formats never drift.
 */
export function verseRefKey(ref: VerseRefKeyInput): string {
  return `${ref.book}|${ref.chapter}|${ref.startVerse}|${ref.endVerse}`;
}

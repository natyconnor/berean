import type { EsvVerse } from "../../shared/esv-api";
import {
  overlappingSpans,
  spanCoversVerse,
  type VerseSpan,
} from "@/lib/hearted-verse-coverage";
import { SHORT_VERSE_WORDS } from "@/lib/memory-scheduler";
import { countVerseWords } from "@/lib/verse-hint";

export const MAX_GROUP_VERSES = 4;
export const MAX_GROUP_WORDS = 60;

export type ProposedHeartGroup = {
  book: string;
  chapter: number;
  startVerse: number;
  endVerse: number;
  wordCount: number;
  kind: "proposed" | "kept";
};

const TRAILING_QUOTES_BRACKETS = /["'“”‘’)\]]+$/u;
const SENTENCE_END = /[.!?]["'”’)]*$/u;

/** Trim; strip trailing quotes/brackets; then test a sentence terminator. */
export function verseEndsSentence(text: string): boolean {
  const stripped = text.trim().replace(TRAILING_QUOTES_BRACKETS, "");
  return SENTENCE_END.test(stripped);
}

function hasHeading(verse: EsvVerse): boolean {
  return Boolean(verse.heading) || Boolean(verse.subheading);
}

function hasParagraphBreak(text: string): boolean {
  return text.includes("\n\n");
}

function verseByNumber(
  verses: readonly EsvVerse[],
): ReadonlyMap<number, EsvVerse> {
  return new Map(verses.map((verse) => [verse.number, verse]));
}

function wordCountForSpan(
  byNumber: ReadonlyMap<number, EsvVerse>,
  startVerse: number,
  endVerse: number,
): number {
  let words = 0;
  for (let number = startVerse; number <= endVerse; number += 1) {
    const verse = byNumber.get(number);
    if (verse) words += countVerseWords(verse.text);
  }
  return words;
}

function sameChapterHearts(
  book: string,
  chapter: number,
  existingHearts: readonly VerseSpan[],
): VerseSpan[] {
  return existingHearts
    .filter((span) => span.book === book && span.chapter === chapter)
    .slice()
    .sort((a, b) => a.startVerse - b.startVerse || a.endVerse - b.endVerse);
}

function isOccupied(
  verse: number,
  chapterHearts: readonly VerseSpan[],
): boolean {
  return chapterHearts.some((span) => spanCoversVerse(span, verse));
}

/**
 * Kept existing hearts in this chapter plus proposed groups over uncovered
 * verses only. Never overlaps a kept span. Output is verse-ordered so a
 * preview can render one timeline of kept chips among proposed gaps.
 */
export function groupChapterForHearting(
  book: string,
  chapter: number,
  verses: readonly EsvVerse[],
  existingHearts: readonly VerseSpan[],
): ProposedHeartGroup[] {
  const sortedVerses = verses.slice().sort((a, b) => a.number - b.number);
  const byNumber = verseByNumber(sortedVerses);
  const chapterHearts = sameChapterHearts(book, chapter, existingHearts);

  const kept: ProposedHeartGroup[] = chapterHearts.map((span) => ({
    book,
    chapter,
    startVerse: span.startVerse,
    endVerse: span.endVerse,
    wordCount: wordCountForSpan(byNumber, span.startVerse, span.endVerse),
    kind: "kept",
  }));

  const proposed: ProposedHeartGroup[] = [];
  let groupStart: number | null = null;
  let groupEnd: number | null = null;
  let groupWords = 0;
  let lastVerseText = "";

  const flush = () => {
    if (groupStart === null || groupEnd === null) return;
    const span: VerseSpan = {
      book,
      chapter,
      startVerse: groupStart,
      endVerse: groupEnd,
    };
    if (overlappingSpans(span, chapterHearts).length > 0) {
      groupStart = null;
      groupEnd = null;
      groupWords = 0;
      lastVerseText = "";
      return;
    }
    proposed.push({
      book,
      chapter,
      startVerse: groupStart,
      endVerse: groupEnd,
      wordCount: groupWords,
      kind: "proposed",
    });
    groupStart = null;
    groupEnd = null;
    groupWords = 0;
    lastVerseText = "";
  };

  const startGroup = (verse: EsvVerse) => {
    groupStart = verse.number;
    groupEnd = verse.number;
    groupWords = countVerseWords(verse.text);
    lastVerseText = verse.text;
  };

  const uncovered = sortedVerses.filter(
    (verse) => !isOccupied(verse.number, chapterHearts),
  );

  for (const verse of uncovered) {
    if (groupStart === null || groupEnd === null) {
      startGroup(verse);
      continue;
    }

    const occupiedHole = verse.number !== groupEnd + 1;
    const nextStartsSection = hasHeading(verse);
    const paragraphBreak = hasParagraphBreak(lastVerseText);
    const nextWords = countVerseWords(verse.text);
    const verseCount = groupEnd - groupStart + 1;
    const exceedsCaps =
      verseCount + 1 > MAX_GROUP_VERSES ||
      groupWords + nextWords > MAX_GROUP_WORDS;
    const canMerge =
      !verseEndsSentence(lastVerseText) ||
      (groupWords <= SHORT_VERSE_WORDS && nextWords <= SHORT_VERSE_WORDS);

    if (
      occupiedHole ||
      nextStartsSection ||
      paragraphBreak ||
      exceedsCaps ||
      !canMerge
    ) {
      flush();
      startGroup(verse);
      continue;
    }

    groupEnd = verse.number;
    groupWords += nextWords;
    lastVerseText = verse.text;
  }

  flush();

  return [...kept, ...proposed].sort(
    (a, b) =>
      a.startVerse - b.startVerse ||
      a.endVerse - b.endVerse ||
      (a.kind === b.kind ? 0 : a.kind === "kept" ? -1 : 1),
  );
}

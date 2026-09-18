import { formatBookChapter, formatVerseRef } from "./verse-ref-utils";

type SectionablePiece = {
  book: string;
  chapter: number;
  startVerse: number;
  endVerse: number;
  sectionIndex: number;
  sectionLabel?: string;
};

/** Shortest recitation chunk we aim for. Shorter only when a chapter is small. */
export const MIN_SECTION_VERSES = 5;
/** Longest recitation chunk. Slightly longer beats a stub leftover. */
export const MAX_SECTION_VERSES = 8;

const SHORT_SECTION_WEIGHT = 3;
const UNPACKABLE = 1_000_000;

export function pieceVerseCount(
  piece: Pick<SectionablePiece, "startVerse" | "endVerse">,
): number {
  return piece.endVerse - piece.startVerse + 1;
}

export function sectionVerseCount(
  pieces: readonly Pick<SectionablePiece, "startVerse" | "endVerse">[],
): number {
  return pieces.reduce((sum, piece) => sum + pieceVerseCount(piece), 0);
}

/**
 * Split ordered piece verse-counts into learning sections. Cost is 0 inside
 * {@link MIN_SECTION_VERSES}–{@link MAX_SECTION_VERSES}; short leftovers cost
 * more than going one or two verses over the max, so 9 stays one section
 * instead of 5+4, while 11 splits 5+6.
 */
export function packLearningSectionGroups(
  verseCounts: readonly number[],
): number[][] {
  const n = verseCounts.length;
  if (n === 0) return [];

  const prefix = new Array<number>(n + 1);
  prefix[0] = 0;
  for (let index = 0; index < n; index += 1) {
    prefix[index + 1] = (prefix[index] ?? 0) + (verseCounts[index] ?? 0);
  }
  const versesBetween = (from: number, to: number): number =>
    (prefix[to] ?? 0) - (prefix[from] ?? 0);

  const cost = (verses: number): number => {
    if (verses <= 0) return UNPACKABLE;
    if (verses >= MIN_SECTION_VERSES && verses <= MAX_SECTION_VERSES) return 0;
    if (verses < MIN_SECTION_VERSES) {
      return (MIN_SECTION_VERSES - verses) * SHORT_SECTION_WEIGHT;
    }
    return (verses - MAX_SECTION_VERSES) * 2;
  };

  const dp = Array.from({ length: n + 1 }, () => UNPACKABLE);
  const prev = Array.from({ length: n + 1 }, () => -1);
  dp[0] = 0;
  for (let end = 1; end <= n; end += 1) {
    for (let start = 0; start < end; start += 1) {
      const next = (dp[start] ?? UNPACKABLE) + cost(versesBetween(start, end));
      if (next < (dp[end] ?? UNPACKABLE)) {
        dp[end] = next;
        prev[end] = start;
      }
    }
  }

  const groups: number[][] = [];
  let end = n;
  while (end > 0) {
    const start = prev[end] ?? -1;
    if (start < 0) break;
    const group: number[] = [];
    for (let index = start; index < end; index += 1) group.push(index);
    groups.push(group);
    end = start;
  }
  groups.reverse();
  return groups;
}

function sectionLabel(
  section: readonly SectionablePiece[],
  chapterPieces: readonly SectionablePiece[],
): string {
  const first = section[0];
  const last = section[section.length - 1];
  if (!first || !last) return "";
  if (section.length === chapterPieces.length) {
    return formatBookChapter(first.book, first.chapter);
  }
  return formatVerseRef({
    book: first.book,
    chapter: first.chapter,
    startVerse: first.startVerse,
    endVerse: last.endVerse,
  });
}

/**
 * Assign `sectionIndex` / `sectionLabel` from verse-count packing. Chapters
 * never merge. ESV headings are ignored — they are editorial, not a learning
 * boundary.
 */
export function applyLearningSections<T extends SectionablePiece>(
  pieces: readonly T[],
): T[] {
  if (pieces.length === 0) return [];

  const next = pieces.map((piece) => {
    const copy = { ...piece };
    delete copy.sectionLabel;
    return copy;
  });

  let sectionIndex = 0;
  let cursor = 0;
  while (cursor < next.length) {
    const head = next[cursor];
    if (!head) break;
    let end = cursor + 1;
    while (end < next.length) {
      const piece = next[end];
      if (
        !piece ||
        piece.book !== head.book ||
        piece.chapter !== head.chapter
      ) {
        break;
      }
      end += 1;
    }

    const chapter = next.slice(cursor, end);
    const groups = packLearningSectionGroups(chapter.map(pieceVerseCount));
    for (const group of groups) {
      const section = group
        .map((local) => chapter[local])
        .filter((piece): piece is T => Boolean(piece));
      const label = sectionLabel(section, chapter);
      for (let offset = 0; offset < section.length; offset += 1) {
        const piece = section[offset];
        if (!piece) continue;
        piece.sectionIndex = sectionIndex;
        if (offset === 0 && label) piece.sectionLabel = label;
        else delete piece.sectionLabel;
      }
      sectionIndex += 1;
    }
    cursor = end;
  }

  return next;
}

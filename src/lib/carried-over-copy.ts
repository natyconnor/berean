import type { VerseSpan } from "./hearted-verse-coverage";
import type { CarriedOverVerse } from "./memorize-status";
import { formatSpanTitle } from "./memorize-target";
import { listLabels } from "./memory-verses-drawer";
import type { PassagePiece } from "./passage-pieces";

/**
 * Copy for verses a new passage keeps from memorizing them on their own:
 * the Memorize sheet's line before it starts, and the session's one-time
 * notice once it has (see `PassagePiece.carriedOver`).
 */

const EN_DASH = "\u2013";

function verseRange(span: Pick<VerseSpan, "startVerse" | "endVerse">): string {
  return span.startVerse === span.endVerse
    ? String(span.startVerse)
    : `${span.startVerse}${EN_DASH}${span.endVerse}`;
}

/** "Psalm 1:3", then "1:5" for the rest (a passage stays in one book). */
function sheetLabels(verses: readonly VerseSpan[]): string[] {
  return verses.map((verse, index) =>
    index === 0
      ? formatSpanTitle(verse)
      : `${verse.chapter}:${verseRange(verse)}`,
  );
}

/**
 * "You've already memorized Psalm 1:3. It counts as learned." when every
 * verse is memorized; "You've already started Psalm 1:3 and 1:5. That
 * progress carries over." when any is still being learned. `null` for none.
 */
export function carriedOverSheetLine(
  verses: readonly CarriedOverVerse[] | undefined,
): string | null {
  if (!verses || verses.length === 0) return null;
  const list = listLabels(sheetLabels(verses));
  if (verses.every((verse) => verse.memorized)) {
    const counts = verses.length === 1 ? "It counts" : "They count";
    return `You've already memorized ${list}. ${counts} as learned.`;
  }
  return `You've already started ${list}. That progress carries over.`;
}

type VerseRun = { chapter: number; startVerse: number; endVerse: number };

/** Adjacent pieces in one chapter read as one range ("3–4"). */
function verseRuns(pieces: readonly PassagePiece[]): VerseRun[] {
  const runs: VerseRun[] = [];
  for (const piece of pieces) {
    const last = runs[runs.length - 1];
    if (
      last &&
      last.chapter === piece.chapter &&
      piece.startVerse === last.endVerse + 1
    ) {
      last.endVerse = piece.endVerse;
    } else {
      runs.push({
        chapter: piece.chapter,
        startVerse: piece.startVerse,
        endVerse: piece.endVerse,
      });
    }
  }
  return runs;
}

/** "Verse 3", "Verses 3 and 5", "Verses 1:3–4 and 2:1" across chapters. */
function versesPhrase(
  pieces: readonly PassagePiece[],
  multiChapter: boolean,
): { phrase: string; plural: boolean } {
  const runs = verseRuns(pieces);
  const labels = runs.map((run) =>
    multiChapter ? `${run.chapter}:${verseRange(run)}` : verseRange(run),
  );
  const verseCount = runs.reduce(
    (sum, run) => sum + run.endVerse - run.startVerse + 1,
    0,
  );
  const plural = verseCount > 1;
  return {
    phrase: `${plural ? "Verses" : "Verse"} ${listLabels(labels)}`,
    plural,
  };
}

/**
 * The passage session's notice about carried-over pieces: memorized ones are
 * skipped ("Verse 3 is already memorized, so we'll skip ahead."); otherwise
 * started ones resume where they were. `null` when nothing carried over.
 */
export function carriedOverSessionNotice(
  pieces: readonly PassagePiece[],
): string | null {
  const carried = pieces.filter((piece) => piece.carriedOver === true);
  if (carried.length === 0) return null;
  const multiChapter = pieces.some(
    (piece) => piece.chapter !== pieces[0]?.chapter,
  );

  const memorized = carried.filter((piece) => piece.attachment === "solid");
  if (memorized.length > 0) {
    const { phrase, plural } = versesPhrase(memorized, multiChapter);
    return `${phrase} ${plural ? "are" : "is"} already memorized, so we'll skip ahead.`;
  }

  const started = carried.filter(
    (piece) =>
      piece.attachment === "learning" || piece.attachment === "attached",
  );
  if (started.length === 0) return null;
  const { phrase, plural } = versesPhrase(started, multiChapter);
  return `You'd already started ${phrase.toLowerCase()}, so ${
    plural ? "they pick" : "it picks"
  } up where you left off.`;
}

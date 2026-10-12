import { getChapterVerseCount } from "./bible-verse-counts";
import { estimateMemorizeDays, formatLearnDuration } from "./memorize-plan";
import {
  resolveMemorizeTarget,
  type MemorizeTargetDeps,
} from "./memorize-target";
import { memorizeTitleLabel } from "./memory-copy";
import type { PassageHeartInfo } from "./passage-heart-info";

/**
 * What the chapter header's Memorize button shows. `memorize` opens the sheet
 * for the chapter; every other state opens the passage's pack in Memory.
 */
export type ChapterMemorizeState =
  | { kind: "memorize"; title: string; verseCount: number; learnDays: number }
  | {
      kind: "memorizing";
      title: string;
      packId: string;
      learnedVerses: number;
      totalVerses: number;
    }
  | { kind: "memorized"; title: string; packId: string }
  | {
      kind: "partOf";
      title: string;
      packId: string;
      memorized: boolean;
      learnedVerses: number;
      totalVerses: number;
    };

type PassageSummary = Pick<
  PassageHeartInfo,
  | "packId"
  | "title"
  | "status"
  | "learnedVerses"
  | "totalVerses"
  | "chapterCount"
  | "startVerse"
  | "endVerse"
>;

const DEFAULT_DEPS: MemorizeTargetDeps = {
  chapterVerseCount: getChapterVerseCount,
};

/**
 * The header state for `book` `chapter` from its `listForChapter` hearts, or
 * `null` while they load or when the chapter cannot be memorized. A passage
 * that is exactly this chapter is "memorizing" / "memorized"; a passage that
 * spans more chapters or only part of this one is "part of" it.
 */
export function chapterMemorizeState(
  book: string,
  chapter: number,
  hearts: ReadonlyArray<{ passage?: PassageSummary }> | undefined,
  deps: MemorizeTargetDeps = DEFAULT_DEPS,
): ChapterMemorizeState | null {
  if (!hearts) return null;

  const passages = hearts.flatMap(({ passage }) => (passage ? [passage] : []));
  const verses = deps.chapterVerseCount(book, chapter);
  const whole = passages.find(
    (passage) =>
      passage.chapterCount === 1 &&
      passage.startVerse === 1 &&
      passage.endVerse === verses,
  );
  if (whole) {
    return whole.status === "building"
      ? {
          kind: "memorizing",
          title: whole.title,
          packId: whole.packId,
          learnedVerses: whole.learnedVerses,
          totalVerses: whole.totalVerses,
        }
      : { kind: "memorized", title: whole.title, packId: whole.packId };
  }

  const containing = passages[0];
  if (containing) {
    return {
      kind: "partOf",
      title: containing.title,
      packId: containing.packId,
      memorized: containing.status !== "building",
      learnedVerses: containing.learnedVerses,
      totalVerses: containing.totalVerses,
    };
  }

  const resolved = resolveMemorizeTarget(
    { kind: "chapters", book, startChapter: chapter, endChapter: chapter },
    deps,
  );
  if (resolved.mode === "invalid") return null;
  return {
    kind: "memorize",
    title: resolved.title,
    verseCount: resolved.verseCount,
    learnDays: estimateMemorizeDays({
      mode: resolved.mode,
      verseCount: resolved.verseCount,
    }),
  };
}

export type ChapterMemorizeCopy = {
  /** First line: "Memorize Psalm 1". */
  title: string;
  /** Second line: "6 verses · learn in about 4 days". */
  detail: string;
  /** The one word left on tight headers. */
  short: string;
  /** Accessible name; starts with or contains the visible words. */
  label: string;
};

function learnedLine(learned: number, total: number): string {
  return `${learned} of ${total} learned`;
}

/** Button copy for a header state. */
export function chapterMemorizeCopy(
  state: ChapterMemorizeState,
): ChapterMemorizeCopy {
  switch (state.kind) {
    case "memorize": {
      const title = memorizeTitleLabel(state.title);
      const verses =
        state.verseCount === 1 ? "1 verse" : `${state.verseCount} verses`;
      const learn = `learn in ${formatLearnDuration(state.learnDays, { short: true })}`;
      return {
        title,
        detail: `${verses} · ${learn}`,
        short: "Memorize",
        label: `${title}, ${verses}, ${learn}`,
      };
    }
    case "memorizing": {
      const title = `Memorizing ${state.title}`;
      const detail = learnedLine(state.learnedVerses, state.totalVerses);
      return {
        title,
        detail,
        short: "Memorizing",
        label: `${title}, ${detail}`,
      };
    }
    case "memorized":
      return {
        title: "Memorized ✓",
        detail: state.title,
        short: "Memorized",
        label: `Memorized ${state.title}`,
      };
    case "partOf": {
      const title = `Part of ${state.title}`;
      const detail = state.memorized
        ? "Memorized ✓"
        : `Memorizing · ${learnedLine(state.learnedVerses, state.totalVerses)}`;
      return {
        title,
        detail,
        short: state.memorized ? "Memorized" : "Memorizing",
        label: state.memorized
          ? `${title}, memorized`
          : `${title}, memorizing, ${learnedLine(state.learnedVerses, state.totalVerses)}`,
      };
    }
  }
}

import { getChapterVerseCount } from "./bible-verse-counts";
import {
  resolveMemorizeTarget,
  type MemorizeTargetDeps,
} from "./memorize-target";
import { memorizeTitleLabel } from "./memory-copy";
import type { PassageHeartInfo } from "./passage-heart-info";

/**
 * `memorize` opens the sheet for the chapter; every other state opens the
 * passage's pack in Memory.
 */
export type ChapterMemorizeState =
  | { kind: "memorize"; title: string }
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
  return { kind: "memorize", title: resolved.title };
}

export type ChapterMemorizeCopy = {
  label: string;
  tooltip: string;
};

function countLine(learned: number, total: number): string {
  return `${learned} of ${total}`;
}

/** Button copy for a header state. */
export function chapterMemorizeCopy(
  state: ChapterMemorizeState,
): ChapterMemorizeCopy {
  switch (state.kind) {
    case "memorize": {
      const title = memorizeTitleLabel(state.title);
      return { label: title, tooltip: title };
    }
    case "memorizing": {
      const count = countLine(state.learnedVerses, state.totalVerses);
      return {
        label: `Memorizing, ${count} learned, ${state.title}`,
        tooltip: `Memorizing ${state.title} · ${count} learned · Open pack`,
      };
    }
    case "memorized":
      return {
        label: `Memorized, ${state.title}`,
        tooltip: `Memorized ${state.title} · Open pack`,
      };
    case "partOf": {
      const title = `Part of ${state.title}`;
      const count = countLine(state.learnedVerses, state.totalVerses);
      return {
        label: state.memorized
          ? `${title}, memorized`
          : `${title}, memorizing, ${count} learned`,
        tooltip: state.memorized
          ? `${title} · Memorized · Open pack`
          : `${title} · ${count} learned · Open pack`,
      };
    }
  }
}

/**
 * What the bare icon wears so its state still shows without words: a ring
 * filled to the share of verses learned, or a check once memorized.
 */
export type ChapterMemorizeMark =
  { kind: "none" } | { kind: "progress"; fraction: number } | { kind: "done" };

function learnedFraction(learned: number, total: number): number {
  if (total <= 0) return 0;
  return Math.min(1, Math.max(0, learned / total));
}

/** The icon-only mark for a header state. */
export function chapterMemorizeMark(
  state: ChapterMemorizeState,
): ChapterMemorizeMark {
  switch (state.kind) {
    case "memorize":
      return { kind: "none" };
    case "memorizing":
      return {
        kind: "progress",
        fraction: learnedFraction(state.learnedVerses, state.totalVerses),
      };
    case "memorized":
      return { kind: "done" };
    case "partOf":
      return state.memorized
        ? { kind: "done" }
        : {
            kind: "progress",
            fraction: learnedFraction(state.learnedVerses, state.totalVerses),
          };
  }
}

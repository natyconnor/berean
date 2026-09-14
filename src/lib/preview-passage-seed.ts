import { EASE_START, type MemorySchedule } from "./memory-scheduler";
import { PASSAGE_MAX_ADDS_PER_DAY, localDayIndex } from "./passage-frontier";
import type { PassagePiece } from "./passage-pieces";
import type { PassageRowStatus } from "./passage-start";
import type { VerseScope } from "./verse-scope-match";

export type PreviewPassageSeedRole =
  | "readyToStart"
  | "buildingDue"
  | "budgetExhausted"
  | "maintenanceDue"
  | "collectionOnly";

/** Pack scope as stored on `packs.scope` (tags are unused for verse matching). */
export type PreviewPassagePackScope = VerseScope & {
  tags: string[];
  tagMatchMode: "any" | "all";
};

export type PreviewPassageSeedPack = {
  id: string;
  role: PreviewPassageSeedRole;
  name: string;
  description: string;
  howToTry: string;
  scope: PreviewPassagePackScope;
  /** Absent for readyToStart / collectionOnly — user opts in from the pack. */
  passage?: {
    status: PassageRowStatus;
    pieces: PassagePiece[];
    addsOnDay: number;
    addDayKey?: number;
    schedule: MemorySchedule;
  };
};

export type PreviewPassageSeedPlan = {
  packs: PreviewPassageSeedPack[];
};

function withPackMeta(scope: VerseScope): PreviewPassagePackScope {
  return { ...scope, tags: [], tagMatchMode: "any" };
}

function scopeChapter(
  book: string,
  startChapter: number,
  endChapter: number = startChapter,
): PreviewPassagePackScope {
  return withPackMeta({
    books: [book],
    chapterRanges: [{ book, startChapter, endChapter }],
  });
}

function multiBookScope(): PreviewPassagePackScope {
  return withPackMeta({
    books: ["Genesis", "John"],
    chapterRanges: [
      { book: "Genesis", startChapter: 1, endChapter: 1 },
      { book: "John", startChapter: 1, endChapter: 1 },
    ],
  });
}

function piece(
  index: number,
  book: string,
  chapter: number,
  startVerse: number,
  endVerse: number,
  attachment: PassagePiece["attachment"],
  extra?: Partial<Pick<PassagePiece, "learnStage" | "stageReps" | "dueAt">>,
): PassagePiece {
  const next: PassagePiece = {
    index,
    book,
    chapter,
    startVerse,
    endVerse,
    sectionIndex: 0,
    attachment,
    learnStage: extra?.learnStage ?? (attachment === "unreached" ? 0 : 2),
    stageReps: extra?.stageReps ?? 0,
  };
  if (index === 0) next.sectionLabel = `Chapter ${chapter}`;
  if (extra?.dueAt !== undefined) next.dueAt = extra.dueAt;
  return next;
}

/** Short Jude pieces so ESV loads stay snappy in preview/dev. */
function judePieces(
  now: number,
  pattern: ReadonlyArray<{
    start: number;
    end: number;
    attachment: PassagePiece["attachment"];
    learnStage?: number;
    stageReps?: number;
    dueAt?: number;
  }>,
): PassagePiece[] {
  return pattern.map((entry, index) =>
    piece(index, "Jude", 1, entry.start, entry.end, entry.attachment, {
      learnStage: entry.learnStage,
      stageReps: entry.stageReps,
      dueAt: entry.dueAt ?? (entry.attachment === "learning" ? now : undefined),
    }),
  );
}

function buildingSchedule(now: number): MemorySchedule {
  return {
    status: "new",
    learnStage: 0,
    stageReps: 0,
    ease: EASE_START,
    intervalDays: 0,
    dueAt: now,
    consecutiveCorrect: 0,
    lapses: 0,
    earlyReviewApplied: false,
  };
}

function reviewingDueSchedule(now: number): MemorySchedule {
  return {
    status: "reviewing",
    learnStage: 3,
    stageReps: 0,
    ease: EASE_START,
    intervalDays: 1,
    dueAt: now,
    consecutiveCorrect: 2,
    lapses: 0,
    earlyReviewApplied: false,
  };
}

/**
 * Deterministic passage packs for preview/dev manual testing. Kept separate
 * from hearted-verse samples so Memory home can list how-to-try steps for each.
 */
export function buildPreviewPassageSeed(
  now: number,
  tzOffsetMinutes: number,
): PreviewPassageSeedPlan {
  const todayKey = localDayIndex(now, tzOffsetMinutes);

  return {
    packs: [
      {
        id: "passage-ready-psalm-1",
        role: "readyToStart",
        name: "Sample · Psalm 1 (start passage)",
        description:
          "Eligible scope pack with no passage row yet — use Learn as a passage.",
        howToTry:
          "Open this pack → Learn as a passage. Confirm start works and pieces freeze.",
        scope: scopeChapter("Psalms", 1),
      },
      {
        id: "passage-building-jude",
        role: "buildingDue",
        name: "Sample · Jude (building)",
        description:
          "Mid-build passage with a due frontier and introduces left today.",
        howToTry:
          "Open Learn or the pack → continue Jude. Solidify the frontier, then introduce the next piece.",
        scope: scopeChapter("Jude", 1),
        passage: {
          status: "building",
          addsOnDay: 2,
          addDayKey: todayKey,
          schedule: buildingSchedule(now),
          pieces: judePieces(now, [
            { start: 1, end: 3, attachment: "solid", learnStage: 3 },
            { start: 4, end: 6, attachment: "solid", learnStage: 3 },
            { start: 7, end: 9, attachment: "attached", learnStage: 2 },
            {
              start: 10,
              end: 12,
              attachment: "learning",
              learnStage: 1,
              stageReps: 1,
              dueAt: now,
            },
            { start: 13, end: 16, attachment: "unreached" },
            { start: 17, end: 20, attachment: "unreached" },
            { start: 21, end: 25, attachment: "unreached" },
          ]),
        },
      },
      {
        id: "passage-budget-jude",
        role: "budgetExhausted",
        name: "Sample · Jude (budget used)",
        description:
          "Building passage with today's introduce budget already spent.",
        howToTry:
          "Open the pack/Learn. You should see the budget-exhausted copy, not frontier-locked copy. Practice rope is still allowed.",
        scope: scopeChapter("Jude", 1),
        passage: {
          status: "building",
          addsOnDay: PASSAGE_MAX_ADDS_PER_DAY,
          addDayKey: todayKey,
          schedule: buildingSchedule(now),
          pieces: judePieces(now, [
            { start: 1, end: 4, attachment: "solid", learnStage: 3 },
            { start: 5, end: 8, attachment: "solid", learnStage: 3 },
            { start: 9, end: 12, attachment: "attached", learnStage: 2 },
            {
              start: 13,
              end: 16,
              attachment: "learning",
              learnStage: 2,
              stageReps: 0,
              // Soft-locked until tomorrow so introduce budget is the blocker.
              dueAt: now + 24 * 60 * 60 * 1000,
            },
            { start: 17, end: 25, attachment: "unreached" },
          ]),
        },
      },
      {
        id: "passage-review-psalm-23",
        role: "maintenanceDue",
        name: "Sample · Psalm 23 (maintenance due)",
        description:
          "Fully solid passage in reviewing status, due now for maintenance.",
        howToTry:
          "Open Review or the pack. Pass once, then fail once — due date/ease should move both times (not only on ≥85%).",
        scope: scopeChapter("Psalms", 23),
        passage: {
          status: "reviewing",
          addsOnDay: 0,
          schedule: reviewingDueSchedule(now),
          pieces: [
            piece(0, "Psalms", 23, 1, 3, "solid", { learnStage: 3 }),
            piece(1, "Psalms", 23, 4, 4, "solid", { learnStage: 3 }),
            piece(2, "Psalms", 23, 5, 6, "solid", { learnStage: 3 }),
          ],
        },
      },
      {
        id: "passage-collection-multi",
        role: "collectionOnly",
        name: "Sample · Multi-book (collection only)",
        description: "Multi-book scope — passage mode must stay unavailable.",
        howToTry:
          "Open the pack. Learn as a passage should be hidden; collection/heart behavior only.",
        scope: multiBookScope(),
      },
    ],
  };
}

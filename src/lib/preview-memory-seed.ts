import {
  DAY_MS,
  EASE_START,
  MASTERED_INTERVAL_DAYS,
  MAX_LEARN_STAGE,
  MIN_LEARNING_LOCK_MS,
  initialSchedule,
  type MemorySchedule,
  type MemoryStatus,
} from "./memory-scheduler";

export type PreviewMemoryRole =
  | "new"
  | "learningRead"
  | "learningGuided"
  | "learningChallenge"
  | "learningMemory"
  | "learningLocked"
  | "reviewDue"
  | "reviewOverdue"
  | "reviewLater"
  | "masteredDue"
  | "masteredLater";

export interface PreviewMemoryReference {
  book: string;
  chapter: number;
  startVerse: number;
  endVerse: number;
}

export interface PreviewMemorySeedVerse {
  id: string;
  role: PreviewMemoryRole;
  /** Short status label for the seed summary. */
  label: string;
  /** What to click to try this verse. */
  howToTry: string;
  reference: PreviewMemoryReference;
  schedule: MemorySchedule;
  lastReviewedAt?: number;
}

export interface PreviewMemorySeedPack {
  name: string;
  description: string;
  verseIds: string[];
}

export interface PreviewMemorySeedReview {
  verseId: string;
  quality: "exact" | "close" | "off";
  accuracy: number;
  stage: number;
  mode: "learn" | "review" | "practice";
  createdAt: number;
}

export interface PreviewMemorySeedPlan {
  verses: PreviewMemorySeedVerse[];
  packs: PreviewMemorySeedPack[];
  reviews: PreviewMemorySeedReview[];
}

interface VerseSpec {
  id: string;
  role: PreviewMemoryRole;
  label: string;
  howToTry: string;
  reference: PreviewMemoryReference;
  /** Days from `now` until `dueAt`. Negative = overdue. */
  dueOffsetDays?: number;
}

/**
 * Famous, mostly-short verses so typing a recall during preview testing is
 * quick. Canonical book names match `BIBLE_BOOKS` (`Psalms`, not `Psalm`).
 */
const VERSE_SPECS: readonly VerseSpec[] = [
  {
    id: "john-3-16",
    role: "new",
    label: "New — not started",
    howToTry: "Learn this verse from the library to start at Read.",
    reference: { book: "John", chapter: 3, startVerse: 16, endVerse: 16 },
  },
  {
    id: "genesis-1-1",
    role: "learningRead",
    label: "Learning · Read",
    howToTry: "Open Learn — Read prime, then Continue.",
    reference: { book: "Genesis", chapter: 1, startVerse: 1, endVerse: 1 },
  },
  {
    id: "psalm-23-1",
    role: "learningGuided",
    label: "Learning · Guided (in progress)",
    howToTry: "Open Learn — Guided with a couple of reps already banked.",
    reference: { book: "Psalms", chapter: 23, startVerse: 1, endVerse: 1 },
  },
  {
    id: "romans-8-28",
    role: "learningChallenge",
    label: "Learning · Challenge (in progress)",
    howToTry: "Open Learn — Challenge band, mid-session.",
    reference: { book: "Romans", chapter: 8, startVerse: 28, endVerse: 28 },
  },
  {
    id: "philippians-4-13",
    role: "learningMemory",
    label: "Learning · From Memory (1 of 2)",
    howToTry: "Open Learn — one exact recall away from graduating.",
    reference: {
      book: "Philippians",
      chapter: 4,
      startVerse: 13,
      endVerse: 13,
    },
  },
  {
    id: "proverbs-3-5-6",
    role: "learningLocked",
    label: "Learning · locked until tomorrow",
    howToTry: "Should not appear in today's Learn queue.",
    reference: { book: "Proverbs", chapter: 3, startVerse: 5, endVerse: 6 },
  },
  {
    id: "john-11-35",
    role: "reviewDue",
    label: "Reviewing · due today",
    howToTry: "Open Review — first card in the due queue.",
    reference: { book: "John", chapter: 11, startVerse: 35, endVerse: 35 },
  },
  {
    id: "psalm-119-105",
    role: "reviewDue",
    label: "Reviewing · due today",
    howToTry: "Open Review — second due verse so the queue has a Continue.",
    reference: { book: "Psalms", chapter: 119, startVerse: 105, endVerse: 105 },
  },
  {
    id: "matthew-6-33",
    role: "reviewDue",
    label: "Reviewing · due today",
    howToTry: "Open Review — third due verse.",
    reference: { book: "Matthew", chapter: 6, startVerse: 33, endVerse: 33 },
  },
  {
    id: "1-thess-5-16-18",
    role: "reviewOverdue",
    label: "Reviewing · overdue",
    howToTry: "Open Review — overdue item mixed into today's queue.",
    reference: {
      book: "1 Thessalonians",
      chapter: 5,
      startVerse: 16,
      endVerse: 18,
    },
  },
  {
    id: "isaiah-41-10",
    role: "reviewLater",
    label: "Reviewing · in 2 days",
    howToTry: "Should not be in Review. Practice it, or wait.",
    reference: { book: "Isaiah", chapter: 41, startVerse: 10, endVerse: 10 },
  },
  {
    id: "joshua-1-9",
    role: "reviewLater",
    label: "Reviewing · in a week",
    howToTry: "Should not be in Review. Use Practice All.",
    dueOffsetDays: 7,
    reference: { book: "Joshua", chapter: 1, startVerse: 9, endVerse: 9 },
  },
  {
    id: "john-1-1",
    role: "masteredDue",
    label: "Mastered · due today",
    howToTry: "Open Review — mastered verse still in the due queue.",
    reference: { book: "John", chapter: 1, startVerse: 1, endVerse: 1 },
  },
  {
    id: "psalm-46-10",
    role: "masteredLater",
    label: "Mastered · later",
    howToTry: "Should not be in Review. Practice to feel mastered chrome.",
    reference: { book: "Psalms", chapter: 46, startVerse: 10, endVerse: 10 },
  },
  {
    id: "romans-12-2",
    role: "masteredLater",
    label: "Mastered · later",
    howToTry: "Library / Practice — long-interval mastered verse.",
    reference: { book: "Romans", chapter: 12, startVerse: 2, endVerse: 2 },
  },
];

const PACKS: readonly PreviewMemorySeedPack[] = [
  {
    name: "Sample · Review queue",
    description:
      "Due and overdue review-phase verses — the Continue/summary path.",
    verseIds: [
      "john-11-35",
      "psalm-119-105",
      "matthew-6-33",
      "1-thess-5-16-18",
      "john-1-1",
    ],
  },
  {
    name: "Sample · Learning",
    description:
      "New through From Memory, plus one verse locked until tomorrow.",
    verseIds: [
      "john-3-16",
      "genesis-1-1",
      "psalm-23-1",
      "romans-8-28",
      "philippians-4-13",
      "proverbs-3-5-6",
    ],
  },
  {
    name: "Sample · Mix",
    description:
      "One due review, one in-progress learn, one mastered, one new.",
    verseIds: ["john-11-35", "psalm-23-1", "john-1-1", "john-3-16"],
  },
];

function reviewingSchedule(
  dueAt: number,
  intervalDays: number,
  status: Extract<MemoryStatus, "reviewing" | "mastered">,
): MemorySchedule {
  return {
    status,
    learnStage: MAX_LEARN_STAGE,
    stageReps: 0,
    ease: EASE_START,
    intervalDays,
    dueAt,
    consecutiveCorrect: status === "mastered" ? 8 : 3,
    lapses: 0,
    earlyReviewApplied: false,
  };
}

function learningSchedule(
  now: number,
  learnStage: number,
  stageReps: number,
  dueAt: number,
  status: Extract<MemoryStatus, "new" | "learning">,
): MemorySchedule {
  const base = initialSchedule(now);
  return {
    ...base,
    status,
    learnStage,
    stageReps,
    dueAt,
    consecutiveCorrect: stageReps,
  };
}

function scheduleForRole(
  spec: Pick<VerseSpec, "role" | "dueOffsetDays">,
  now: number,
): Pick<PreviewMemorySeedVerse, "schedule" | "lastReviewedAt"> {
  const role = spec.role;
  const dueOffsetDays = spec.dueOffsetDays;
  switch (role) {
    case "new":
      return { schedule: learningSchedule(now, 0, 0, now, "new") };
    case "learningRead":
      return {
        schedule: learningSchedule(now, 0, 0, now, "learning"),
        lastReviewedAt: now,
      };
    case "learningGuided":
      return {
        schedule: learningSchedule(now, 1, 1, now, "learning"),
        lastReviewedAt: now,
      };
    case "learningChallenge":
      return {
        schedule: learningSchedule(now, 2, 2, now, "learning"),
        lastReviewedAt: now,
      };
    case "learningMemory":
      return {
        schedule: learningSchedule(now, MAX_LEARN_STAGE, 1, now, "learning"),
        lastReviewedAt: now,
      };
    case "learningLocked":
      return {
        schedule: learningSchedule(now, 1, 0, now + DAY_MS, "learning"),
        lastReviewedAt: now,
      };
    case "reviewDue":
      return {
        schedule: reviewingSchedule(now, 1, "reviewing"),
        lastReviewedAt: now - DAY_MS,
      };
    case "reviewOverdue":
      return {
        schedule: reviewingSchedule(now - 4 * DAY_MS, 3, "reviewing"),
        lastReviewedAt: now - 7 * DAY_MS,
      };
    case "reviewLater":
      return {
        schedule: reviewingSchedule(
          now + (dueOffsetDays ?? 2) * DAY_MS,
          dueOffsetDays ?? 4,
          "reviewing",
        ),
        lastReviewedAt: now - 2 * DAY_MS,
      };
    case "masteredDue":
      return {
        schedule: reviewingSchedule(now, MASTERED_INTERVAL_DAYS, "mastered"),
        lastReviewedAt: now - MASTERED_INTERVAL_DAYS * DAY_MS,
      };
    case "masteredLater":
      return {
        schedule: reviewingSchedule(
          now + 21 * DAY_MS,
          MASTERED_INTERVAL_DAYS + 10,
          "mastered",
        ),
        lastReviewedAt: now - 9 * DAY_MS,
      };
  }
}

function historyForVerse(
  verse: PreviewMemorySeedVerse,
  now: number,
): PreviewMemorySeedReview[] {
  if (verse.role === "new") return [];

  const reviews: PreviewMemorySeedReview[] = [];
  const isReviewPhase =
    verse.schedule.status === "reviewing" ||
    verse.schedule.status === "mastered";

  if (isReviewPhase) {
    const daysBack = verse.role.startsWith("mastered") ? 40 : 18;
    for (let day = daysBack; day >= 2; day -= 3) {
      const exact = day % 2 === 0;
      reviews.push({
        verseId: verse.id,
        quality: exact ? "exact" : "close",
        accuracy: exact ? 100 : 92,
        stage: MAX_LEARN_STAGE,
        mode: "review",
        createdAt: now - day * DAY_MS,
      });
    }
    return reviews;
  }

  reviews.push({
    verseId: verse.id,
    quality: "exact",
    accuracy: 100,
    stage: Math.max(0, verse.schedule.learnStage - 1),
    mode: "learn",
    createdAt:
      now - (verse.role === "learningLocked" ? DAY_MS : 2 * 60 * 60 * 1000),
  });
  return reviews;
}

/**
 * Build a deterministic Memory sample set relative to `now`.
 *
 * `now` should be the same session clock the UI passes to Convex (`useLiveNow`)
 * so due/locked verses line up with the frozen client clock.
 */
export function buildPreviewMemorySeed(now: number): PreviewMemorySeedPlan {
  const verses = VERSE_SPECS.map((spec) => {
    const { schedule, lastReviewedAt } = scheduleForRole(spec, now);
    return {
      id: spec.id,
      role: spec.role,
      label: spec.label,
      howToTry: spec.howToTry,
      reference: spec.reference,
      schedule,
      lastReviewedAt,
    };
  });

  return {
    verses,
    packs: PACKS.map((pack) => ({ ...pack, verseIds: [...pack.verseIds] })),
    reviews: verses.flatMap((verse) => historyForVerse(verse, now)),
  };
}

export function countPreviewMemoryRoles(
  verses: ReadonlyArray<Pick<PreviewMemorySeedVerse, "role">>,
): Record<PreviewMemoryRole, number> {
  const counts: Record<PreviewMemoryRole, number> = {
    new: 0,
    learningRead: 0,
    learningGuided: 0,
    learningChallenge: 0,
    learningMemory: 0,
    learningLocked: 0,
    reviewDue: 0,
    reviewOverdue: 0,
    reviewLater: 0,
    masteredDue: 0,
    masteredLater: 0,
  };
  for (const verse of verses) {
    counts[verse.role] += 1;
  }
  return counts;
}

/** Locked learning needs a real next-session gap, not an in-progress stamp. */
export function assertLearningLockGap(verse: PreviewMemorySeedVerse): boolean {
  if (verse.role !== "learningLocked" || verse.lastReviewedAt === undefined) {
    return false;
  }
  return verse.schedule.dueAt - verse.lastReviewedAt >= MIN_LEARNING_LOCK_MS;
}

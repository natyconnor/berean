import { packAllowsUnifiedRecitation } from "./contiguous-spans";
import {
  PRACTICE_ANYTIME_LABEL,
  EXTRA_PRACTICE_TOOLTIP,
  UP_NEXT_TOMORROW_LABEL,
  statusLabel,
  stepAction,
} from "./memory-copy";
import {
  buildGoalCards,
  passageTodayPieceIndex,
  type PackGoalCard,
  type PassageGoalCard,
} from "./memory-goals";
import { memoryProgressFraction } from "./mastery-ring";
import { formatNextReviewDay } from "./memory-today";
import {
  isDueForReview,
  isLearningLocked,
  isReviewPhase,
  type MemoryStatus,
} from "./memory-scheduler";
import type { MemorySessionKind } from "./memory-session-path";
import {
  calendarDaysBetween,
  estimateReviewDaysToMastery,
  estimateSessionMinutes,
  formatDueDay,
  formatMasteryDuration,
  formatMonthOrDate,
  formatShortDate,
  projectedFinishDate,
  projectedMasteryDate,
} from "./memorize-plan";
import { packUpNextVerseRefIds } from "./pack-pacing";
import type { PassageDueStatus } from "./passage-due";
import {
  packAllowsPassageMode,
  rangeAllowsPassageMode,
} from "./passage-eligibility";
import {
  coerceUnstartedLearningPieces,
  isPassagePieceLocked,
} from "./passage-frontier";
import type { PassagePiece } from "./passage-pieces";
import type { PassageRange } from "./passage-range";
import type { VerseScope } from "./verse-scope-match";

/**
 * What the pack and passage detail shows: its subtitle, the one main action,
 * the progress bars, and each row's status. Pure; `now` is passed in.
 *
 * A passage is a pack with a started passage. Every other pack, custom or a
 * legacy chapter pack, is shown as a pack.
 */

export interface PackDetailPack {
  packId: string;
  name: string;
  kind: "custom" | "scope";
  scope?: VerseScope;
  passageRange?: PassageRange;
  createdAt: number;
  unifiedReviewEnabled?: boolean;
}

/** A pack member in pack order (`packs.resolveMembers`). */
export interface PackDetailMember {
  verseRefId: string;
  book: string;
  chapter: number;
  startVerse: number;
  endVerse: number;
  status: MemoryStatus;
  learnStage: number;
  intervalDays: number;
  stageReps: number;
  ease: number;
  dueAt: number;
  lastReviewedAt?: number;
}

/** A started passage (`passageMemory.getForPack`). */
export interface PackDetailPassage {
  status: PassageDueStatus;
  pieces: readonly PassagePiece[];
  addsOnDay: number;
  addDayKey?: number;
  intervalDays: number;
  stageReps: number;
  ease: number;
  dueAt: number;
  lastSessionAt?: number;
  createdAt: number;
}

export interface PackDetailInput {
  pack: PackDetailPack;
  members: readonly PackDetailMember[];
  passage: PackDetailPassage | null;
  now: number;
  tzOffsetMinutes: number;
}

export type PackDetailGoal = PassageGoalCard | PackGoalCard;

function reviewTogetherDueAt(
  members: readonly PackDetailMember[],
  now: number,
): number | null {
  if (!members.every((member) => isReviewPhase(member.status))) return null;
  let due: number | null = null;
  for (const member of members) {
    if (!isDueForReview(member, now)) continue;
    if (due === null || member.dueAt < due) due = member.dueAt;
  }
  return due;
}

/**
 * The same goal card Today shows for this pack or passage, so counts and
 * "work today" match. `null` for a pack with no verses in Memory.
 */
export function packDetailGoal({
  pack,
  members,
  passage,
  now,
  tzOffsetMinutes,
}: PackDetailInput): PackDetailGoal | null {
  const reviewTogether =
    pack.unifiedReviewEnabled === true &&
    passage === null &&
    members.length > 0;
  const goals = buildGoalCards({
    now,
    tzOffsetMinutes,
    verses: members.map((member) => ({ ...member, createdAt: pack.createdAt })),
    packs: [
      {
        packId: pack.packId,
        name: pack.name,
        kind: pack.kind,
        verseRefIds: members.map((member) => member.verseRefId),
        createdAt: pack.createdAt,
      },
    ],
    passages: passage
      ? [{ ...passage, packId: pack.packId, title: pack.name }]
      : [],
    upNextByPackId: new Map([[pack.packId, packUpNextVerseRefIds(members)]]),
    reviewTogether: new Map<string, number | null>(
      reviewTogether ? [[pack.packId, reviewTogetherDueAt(members, now)]] : [],
    ),
    reviewTogetherVerseRefIds: new Set<string>(
      reviewTogether
        ? members
            .filter((member) => isReviewPhase(member.status))
            .map((member) => member.verseRefId)
        : [],
    ),
  });
  const goal = goals.find(
    (card): card is PackDetailGoal =>
      card.kind !== "verse" && card.packId === pack.packId,
  );
  return goal ?? null;
}

function verseCountLabel(count: number): string {
  return `${count} ${count === 1 ? "verse" : "verses"}`;
}

function addedDayLabel(createdAt: number, now: number, timeZone?: string) {
  const daysAgo = calendarDaysBetween(createdAt, now, timeZone);
  if (daysAgo <= 0) return "today";
  if (daysAgo === 1) return "yesterday";
  return formatShortDate(new Date(createdAt), timeZone);
}

export interface PackDetailSubtitle {
  /** "Pack · 9 verses · added Sep 12" / "Passage · 11 verses" */
  text: string;
  /** Passages add "♥ hearted as one passage". */
  heartedAsOnePassage: boolean;
}

export function packDetailSubtitle({
  isPassage,
  verseCount,
  createdAt,
  now,
  timeZone,
}: {
  isPassage: boolean;
  verseCount: number;
  createdAt: number;
  now: number;
  timeZone?: string;
}): PackDetailSubtitle {
  if (isPassage) {
    return {
      text: `Passage · ${verseCountLabel(verseCount)}`,
      heartedAsOnePassage: true,
    };
  }
  return {
    text: `Pack · ${verseCountLabel(verseCount)} · added ${addedDayLabel(
      createdAt,
      now,
      timeZone,
    )}`,
    heartedAsOnePassage: false,
  };
}

/** A pack session, or `today`: the pack's learning and then its reviews in one run. */
export type PackDetailSession = MemorySessionKind | "today";

export type PackDetailMainAction =
  | {
      kind: "session";
      emphasis: "primary" | "secondary";
      label: string;
      session: PackDetailSession;
      tooltip?: string;
    }
  /** Disabled "Up next tomorrow"; the detail adds the passage's locked copy. */
  | { kind: "waiting"; label: string };

export interface PackDetailActions {
  main: PackDetailMainAction | null;
  /** A ghost "Practice anytime" beside the main action. */
  practice: boolean;
  /** A muted line beside the actions, e.g. "Memorized · next review Thu". */
  note: string | null;
}

const PRACTICE_ACTION: PackDetailMainAction = {
  kind: "session",
  emphasis: "secondary",
  label: PRACTICE_ANYTIME_LABEL,
  session: "practice",
  tooltip: EXTRA_PRACTICE_TOOLTIP,
};

const NO_ACTIONS: PackDetailActions = {
  main: null,
  practice: false,
  note: null,
};

/** The one main action for a passage, by where it is in learning. */
export function passageDetailActions(
  goal: PassageGoalCard,
  now: number,
  timeZone?: string,
): PackDetailActions {
  if (goal.status === "building") {
    if (!goal.hasWorkToday) {
      return {
        main: { kind: "waiting", label: UP_NEXT_TOMORROW_LABEL },
        practice: false,
        note: null,
      };
    }
    const minutes = estimateSessionMinutes({
      learningVerses: 0,
      reviewVerses: 0,
      passageSessions: 1,
    });
    return {
      main: {
        kind: "session",
        emphasis: "primary",
        label: `Continue · about ${minutes} min`,
        session: "learn",
      },
      practice: false,
      note: null,
    };
  }

  if (goal.hasWorkToday) {
    return {
      main: {
        kind: "session",
        emphasis: "primary",
        label: `Review ${goal.title}`,
        session: "review",
      },
      practice: false,
      note: null,
    };
  }

  const status = goal.status === "mastered" ? "mastered" : "reviewing";
  return {
    main: PRACTICE_ACTION,
    practice: false,
    note:
      goal.nextDueAt === null
        ? null
        : `${statusLabel(status)} · next review ${formatDueDay(
            goal.nextDueAt,
            now,
            timeZone,
          )}`,
  };
}

function packTodaySession(goal: PackGoalCard): PackDetailSession {
  const reviews = goal.reviewsDue.length;
  if (goal.learningToday > 0) return reviews > 0 ? "today" : "learn";
  return "review";
}

/**
 * The one main action for a pack: today's verses, else practice. "Continue"
 * counts learning and reviews, so with both it opens the pack's blended
 * session, which runs exactly those verses.
 */
export function packDetailActions(
  goal: PackGoalCard | null,
  now: number,
  timeZone?: string,
): PackDetailActions {
  if (goal === null || goal.verseCount === 0) return NO_ACTIONS;

  if (goal.hasWorkToday) {
    const count = goal.learningToday + goal.reviewsDue.length;
    return {
      main: {
        kind: "session",
        emphasis: "primary",
        label: `Continue · ${verseCountLabel(count)} today`,
        session: packTodaySession(goal),
      },
      practice: goal.learned > 0,
      note: null,
    };
  }

  const when = formatNextReviewDay(goal.nextDueAt, now, timeZone);
  return {
    main: goal.learned > 0 ? PRACTICE_ACTION : null,
    practice: false,
    note: when ? `Next up ${when}.` : null,
  };
}

export interface ProgressBar {
  label: string;
  fraction: number;
  detail: string | null;
}

export interface PackDetailProgress {
  learned: ProgressBar | null;
  mastery: ProgressBar | null;
  /** While a passage is building: when mastery starts. */
  masteryNote: string | null;
}

function percent(fraction: number): number {
  return Math.round(Math.min(Math.max(fraction, 0), 1) * 100);
}

function masteredWhen(date: Date, now: number, timeZone?: string): string {
  const when = formatMonthOrDate(date, now, timeZone);
  return when.startsWith("around") ? when : `by ${when}`;
}

/** Learned and Mastery bars for a pack; Mastery only once a verse is learned. */
export function packDetailProgress(
  goal: PackGoalCard,
  now: number,
  timeZone?: string,
): PackDetailProgress & { learned: ProgressBar } {
  const pending = [
    goal.learning > 0 ? `${goal.learning} learning` : null,
    goal.upNext > 0 ? `${goal.upNext} up next` : null,
  ].filter((part): part is string => part !== null);

  const learned: ProgressBar = {
    label: `${goal.learned} of ${verseCountLabel(goal.verseCount)} learned`,
    fraction: goal.verseCount === 0 ? 0 : goal.learned / goal.verseCount,
    detail: pending.length > 0 ? pending.join(" · ") : null,
  };
  if (goal.learned === 0) {
    return { learned, mastery: null, masteryNote: null };
  }

  const firstMastered = projectedMasteryDate(
    { mode: "verse", verseCount: 1, learnedCount: 1 },
    now,
  );
  return {
    learned,
    mastery: {
      label: `Mastery ${percent(goal.masteryFraction)}%`,
      fraction: goal.masteryFraction,
      detail:
        goal.mastered > 0
          ? `${goal.mastered} mastered`
          : `first ones mastered ${masteredWhen(firstMastered, now, timeZone)}`,
    },
    masteryNote: null,
  };
}

/** A passage shows Learned while building, then Mastery. */
export function passageDetailProgress(
  goal: PassageGoalCard,
  now: number,
  timeZone?: string,
): PackDetailProgress {
  if (goal.status === "building") {
    const remaining = goal.verseCount - goal.learnedVerses;
    const finish = projectedFinishDate(
      {
        mode: "passage",
        verseCount: goal.verseCount,
        learnedCount: goal.learnedVerses,
      },
      now,
    );
    return {
      learned: {
        label: `${goal.learnedVerses} of ${verseCountLabel(goal.verseCount)} learned`,
        fraction:
          goal.verseCount === 0 ? 0 : goal.learnedVerses / goal.verseCount,
        detail:
          remaining > 0
            ? `on track for ${formatShortDate(finish, timeZone)}`
            : null,
      },
      mastery: null,
      masteryNote: `Mastery starts once all ${goal.verseCount} are learned, ${formatMasteryDuration(
        estimateReviewDaysToMastery(),
        { short: true },
      )} of short reviews after that.`,
    };
  }

  if (goal.status === "mastered") {
    return {
      learned: null,
      mastery: { label: "Mastered", fraction: 1, detail: null },
      masteryNote: null,
    };
  }

  const mastered = projectedMasteryDate(
    {
      mode: "passage",
      verseCount: goal.verseCount,
      learnedCount: goal.verseCount,
    },
    now,
  );
  return {
    learned: null,
    mastery: {
      label: `Mastery ${percent(goal.masteryFraction)}%`,
      fraction: goal.masteryFraction,
      detail: `mastered ${masteredWhen(mastered, now, timeZone)}`,
    },
    masteryNote: null,
  };
}

export type PackRowAction = "learn" | "review" | "practice";

export interface PackMemberRow {
  status: MemoryStatus;
  /** "Up next · starts when you're ready", "Memorized · review due today · mastery N%" */
  line: string;
  actions: PackRowAction[];
}

/** One pack verse: its status line and the sessions it offers. */
export function packMemberRow(
  member: PackDetailMember,
  {
    now,
    timeZone,
    reviewTogether = false,
  }: { now: number; timeZone?: string; reviewTogether?: boolean },
): PackMemberRow {
  const { status } = member;
  if (status === "new") {
    return {
      status,
      line: "Up next · starts when you're ready",
      actions: ["learn"],
    };
  }

  if (status === "learning") {
    const locked = isLearningLocked(member, now);
    return {
      status,
      line: `Learning · ${locked ? "tomorrow" : "today"}: ${stepAction(
        member.learnStage,
      )}`,
      actions: locked ? [] : ["learn"],
    };
  }

  const due = isDueForReview(member, now);
  const parts: string[] = [
    statusLabel(status),
    due
      ? "review due today"
      : `next review ${formatDueDay(member.dueAt, now, timeZone)}`,
  ];
  if (status === "reviewing") {
    parts.push(
      `mastery ${percent(
        memoryProgressFraction(
          "reviewing",
          0,
          member.stageReps,
          member.intervalDays,
          undefined,
          member.ease,
        ),
      )}%`,
    );
  }
  return {
    status,
    line: parts.join(" · "),
    actions: due && !reviewTogether ? ["review", "practice"] : ["practice"],
  };
}

export type PassageVerseChipKind =
  "memorized" | "today" | "tomorrow" | "upNext";

export interface PassageVerseRow {
  book: string;
  chapter: number;
  verse: number;
  chip: {
    kind: PassageVerseChipKind;
    label: string;
    /** Memorized on its own before the passage started ("· from before"). */
    fromBefore?: true;
  };
}

function learningChip(when: "today" | "tomorrow"): PassageVerseRow["chip"] {
  return when === "today"
    ? { kind: "today", label: `${statusLabel("learning")} today` }
    : { kind: "tomorrow", label: statusLabel("learning") };
}

/**
 * One row per verse of a passage: Memorized, Learning today (today's piece,
 * or any piece open today), Learning (its next step is tomorrow), or Up next.
 * A memorized piece the passage kept from before it started says so.
 */
export function passageVerseRows(
  passage: Pick<PackDetailPassage, "pieces" | "addsOnDay" | "addDayKey">,
  now: number,
  tzOffsetMinutes: number,
): PassageVerseRow[] {
  const pieces = coerceUnstartedLearningPieces(passage.pieces);
  const todayIndex = passageTodayPieceIndex(
    passage,
    pieces,
    now,
    tzOffsetMinutes,
  );

  return pieces.flatMap((piece, index) => {
    let chip: PassageVerseRow["chip"];
    if (index === todayIndex) {
      chip = learningChip("today");
    } else if (
      piece.attachment === "solid" ||
      piece.attachment === "attached"
    ) {
      chip = { kind: "memorized", label: statusLabel("reviewing") };
      if (piece.carriedOver) chip.fromBefore = true;
    } else if (piece.attachment === "learning") {
      chip = learningChip(
        isPassagePieceLocked(piece, now) ? "tomorrow" : "today",
      );
    } else {
      chip = { kind: "upNext", label: "Up next" };
    }
    const rows: PassageVerseRow[] = [];
    for (let verse = piece.startVerse; verse <= piece.endVerse; verse += 1) {
      rows.push({ book: piece.book, chapter: piece.chapter, verse, chip });
    }
    return rows;
  });
}

/** A legacy chapter pack not yet learned as a passage that could be. */
export function offersLearnAsPassage(
  pack: PackDetailPack,
  passage: PackDetailPassage | null,
): boolean {
  return (
    passage === null &&
    pack.kind === "scope" &&
    pack.scope !== undefined &&
    packAllowsPassageMode(pack.scope) &&
    (pack.passageRange === undefined ||
      rangeAllowsPassageMode(pack.passageRange))
  );
}

export interface ReviewTogetherOption {
  checked: boolean;
  /** Turning it on needs every verse memorized; turning it off always works. */
  disabled: boolean;
}

/**
 * The ⋯ "Review together as one recitation" checkbox: legacy chapter packs
 * whose verses form one block. `null` when it does not apply.
 */
export function reviewTogetherOption(
  pack: PackDetailPack,
  passage: PackDetailPassage | null,
  members: readonly PackDetailMember[],
): ReviewTogetherOption | null {
  if (passage !== null || pack.kind !== "scope" || !pack.scope) return null;
  const checked = pack.unifiedReviewEnabled === true;
  if (checked) return { checked, disabled: false };
  if (members.length < 2 || !packAllowsUnifiedRecitation(members, pack.scope)) {
    return null;
  }
  return {
    checked,
    disabled: !members.every((member) => isReviewPhase(member.status)),
  };
}

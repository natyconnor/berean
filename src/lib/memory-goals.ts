import {
  passageStepLine,
  stepLadderDay,
  type StepLadderDay,
} from "./memory-copy";
import { memoryProgressFraction } from "./mastery-ring";
import {
  calendarDaysBetween,
  estimateMemorizeDays,
  formatLearnDuration,
  formatShortDate,
} from "./memorize-plan";
import {
  DAY_MS,
  isDueForLearning,
  isDueForReview,
  isLearningPhase,
  isReviewPhase,
  type MemoryStatus,
} from "./memory-scheduler";
import {
  isPassageDueForLearning,
  isPassageDueForReview,
  passageLearningDueAt,
  type PassageDueStatus,
} from "./passage-due";
import {
  coerceUnstartedLearningPieces,
  dueFrontierIndex,
  localDayIndex,
  remainingIntroduces,
} from "./passage-frontier";
import type { PassagePiece, PieceAttachment } from "./passage-pieces";
import { formatVerseRefTitle } from "./verse-ref-utils";

/**
 * Goal cards for Today: one per thing the user is working toward. That is
 * every passage, every pack with verses in Memory, and every verse memorized
 * on its own that is still being learned or has a review due.
 *
 * Pure: `memoryHome.today` loads the rows and passes them in with `now`. Ids
 * are generic so tests can use plain strings.
 */

/** An in-Memory verse joined to its reference. */
export interface GoalVerseInput<V extends string = string> {
  verseRefId: V;
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
  createdAt: number;
}

/**
 * One of the user's packs. Members follow `loadPackMembers`: the in-Memory
 * verses of `verseRefIds` in saved order.
 */
export interface GoalPackInput<
  P extends string = string,
  V extends string = string,
> {
  packId: P;
  name: string;
  kind: "custom" | "scope";
  /** `packVerses` rows in saved order, in Memory or not. */
  verseRefIds: readonly V[];
  createdAt: number;
}

/** A started passage and its pack's name. */
export interface GoalPassageInput<P extends string = string> {
  packId: P;
  title: string;
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

export interface GoalsInput<
  P extends string = string,
  V extends string = string,
> {
  now: number;
  /** Client `getTimezoneOffset()`; passage day keys use it. */
  tzOffsetMinutes: number;
  verses: readonly GoalVerseInput<V>[];
  /** Every pack, passage packs included (membership needs them). */
  packs: readonly GoalPackInput<P, V>[];
  passages: readonly GoalPassageInput<P>[];
  /** Each pack's Up-next verses joining learning today (before dedupe). */
  upNextByPackId: ReadonlyMap<P, readonly V[]>;
  /**
   * Packs reviewed together as one recitation, mapped to when that recitation
   * is due (`null` when it is not due).
   */
  reviewTogether: ReadonlyMap<P, number | null>;
  /** Review-phase members of those packs; they are never reviewed alone. */
  reviewTogetherVerseRefIds: ReadonlySet<string>;
}

export interface PassageTodayStep {
  /** "Read verses 5–6, then type them with first letters" */
  label: string;
  /** Which learning session today's step is; never shown as a day count. */
  ladderDay: StepLadderDay;
}

export type PassagePieceState = "learned" | "learning" | "upNext";

/** One piece of a passage, in order, for Today's verse ruler. */
export interface PassageGoalPiece {
  /** Verses in the piece; the ruler draws one tick per verse. */
  verses: number;
  state: PassagePieceState;
  /** Today's session starts on this piece. */
  today: boolean;
}

export interface PassageGoalCard<P extends string = string> {
  kind: "passage";
  packId: P;
  title: string;
  verseCount: number;
  /** Verses joined into the passage (attached or solid). */
  learnedVerses: number;
  pieceStates: PassageGoalPiece[];
  status: PassageDueStatus;
  hasWorkToday: boolean;
  /** While building with a session today: the verses that session starts on. */
  todayStep: PassageTodayStep | null;
  masteryFraction: number;
  /** Next learning session while building, else the next recite. */
  nextDueAt: number | null;
  createdAt: number;
  lastActivityAt: number;
  lastPracticedAt: number | null;
}

export interface PackGoalReview<V extends string = string> {
  verseRefId: V;
  label: string;
}

export interface PackGoalCard<
  P extends string = string,
  V extends string = string,
> {
  kind: "pack";
  packId: P;
  title: string;
  /** In-Memory members. */
  verseCount: number;
  /** Members past the learning steps (memorized or mastered). */
  learned: number;
  learning: number;
  upNext: number;
  mastered: number;
  /** Mean member mastery; members still learning count as 0. */
  masteryFraction: number;
  reviewsDue: PackGoalReview<V>[];
  /** Learning members open today plus Up-next members joining today. */
  learningToday: number;
  /** Reviewed as one recitation instead of verse by verse. */
  reviewTogether: boolean;
  hasWorkToday: boolean;
  /** Soonest due time among members that have started. */
  nextDueAt: number | null;
  createdAt: number;
  lastActivityAt: number;
  lastPracticedAt: number | null;
  /** Member references in pack order, for search. */
  memberLabels: string[];
}

export interface VerseGoalCard<V extends string = string> {
  kind: "verse";
  verseRefId: V;
  title: string;
  book: string;
  chapter: number;
  startVerse: number;
  endVerse: number;
  status: MemoryStatus;
  learnStage: number;
  intervalDays: number;
  masteryFraction: number;
  hasWorkToday: boolean;
  /** `null` while Up next. */
  nextDueAt: number | null;
  createdAt: number;
  lastActivityAt: number;
  lastPracticedAt: number | null;
}

export type GoalCard<P extends string = string, V extends string = string> =
  PassageGoalCard<P> | PackGoalCard<P, V> | VerseGoalCard<V>;

/** Local midnight that starts `now`'s day (the day `localDayIndex` names). */
export function localDayStart(now: number, tzOffsetMinutes: number): number {
  return (
    localDayIndex(now, tzOffsetMinutes) * DAY_MS + tzOffsetMinutes * 60_000
  );
}

function masteryFor(row: {
  status: MemoryStatus | PassageDueStatus;
  intervalDays: number;
  stageReps: number;
  ease: number;
}): number {
  if (row.status === "mastered") return 1;
  if (row.status === "reviewing") {
    return memoryProgressFraction(
      "reviewing",
      0,
      row.stageReps,
      row.intervalDays,
      undefined,
      row.ease,
    );
  }
  return 0;
}

function maxOrNull(
  current: number | null,
  value: number | undefined,
): number | null {
  if (value === undefined) return current;
  return current === null ? value : Math.max(current, value);
}

function minOrNull(
  current: number | null,
  value: number | undefined,
): number | null {
  if (value === undefined) return current;
  return current === null ? value : Math.min(current, value);
}

function packMembers<V extends string>(
  pack: GoalPackInput<string, V>,
  verseByRef: ReadonlyMap<V, GoalVerseInput<V>>,
): GoalVerseInput<V>[] {
  return pack.verseRefIds.flatMap((verseRefId) => {
    const verse = verseByRef.get(verseRefId);
    return verse ? [verse] : [];
  });
}

/** Per book and chapter, the verse range each passage covers. */
function passageRanges(
  passages: readonly GoalPassageInput[],
): Map<string, Array<{ start: number; end: number }>> {
  const ranges = new Map<string, Array<{ start: number; end: number }>>();
  for (const passage of passages) {
    const byChapter = new Map<string, { start: number; end: number }>();
    for (const piece of passage.pieces) {
      const key = `${piece.book}|${piece.chapter}`;
      const range = byChapter.get(key);
      byChapter.set(key, {
        start: Math.min(range?.start ?? piece.startVerse, piece.startVerse),
        end: Math.max(range?.end ?? piece.endVerse, piece.endVerse),
      });
    }
    for (const [key, range] of byChapter) {
      ranges.set(key, [...(ranges.get(key) ?? []), range]);
    }
  }
  return ranges;
}

function insidePassage(
  verse: GoalVerseInput<string>,
  ranges: ReadonlyMap<string, Array<{ start: number; end: number }>>,
): boolean {
  return (ranges.get(`${verse.book}|${verse.chapter}`) ?? []).some(
    (range) => verse.startVerse >= range.start && verse.endVerse <= range.end,
  );
}

function stepVersesLabel(piece: PassagePiece, multiChapter: boolean): string {
  const plural = piece.endVerse > piece.startVerse;
  const range = plural
    ? `${piece.startVerse}–${piece.endVerse}`
    : `${piece.startVerse}`;
  const where = multiChapter ? `${piece.chapter}:${range}` : range;
  return `${plural ? "verses" : "verse"} ${where}`;
}

/**
 * Index of the piece today's passage session starts on: the first open
 * learning piece, else the next new piece while today's new-verse budget
 * lasts. `null` when there is nothing to do today.
 */
export function passageTodayPieceIndex(
  passage: Pick<GoalPassageInput, "addsOnDay" | "addDayKey">,
  pieces: readonly PassagePiece[],
  now: number,
  tzOffsetMinutes: number,
): number | null {
  const openIndex = dueFrontierIndex(pieces, now);
  if (openIndex !== null) return openIndex;
  const remaining = remainingIntroduces({
    addsOnDay: passage.addsOnDay,
    addDayKey: passage.addDayKey,
    todayKey: localDayIndex(now, tzOffsetMinutes),
  });
  if (remaining <= 0) return null;
  const nextIndex = pieces.findIndex(
    (candidate) => candidate.attachment === "unreached",
  );
  return nextIndex === -1 ? null : nextIndex;
}

/** The verses today's passage session starts on: `pieces[index]`. */
function passageTodayStep(
  pieces: readonly PassagePiece[],
  index: number,
): PassageTodayStep | null {
  const piece = pieces[index];
  if (!piece) return null;

  const learnStage = piece.attachment === "unreached" ? 0 : piece.learnStage;
  const chapters = new Set(pieces.map((p) => `${p.book}|${p.chapter}`));
  return {
    label: passageStepLine(
      learnStage,
      stepVersesLabel(piece, chapters.size > 1),
      piece.endVerse > piece.startVerse,
    ),
    ladderDay: stepLadderDay(learnStage),
  };
}

/** When a building passage with nothing open today next has a session. */
function nextBuildingSessionAt(
  pieces: readonly PassagePiece[],
  now: number,
  tomorrowStart: number,
): number | null {
  let next: number | null = null;
  for (const piece of pieces) {
    if (piece.attachment === "unreached") {
      next = minOrNull(next, tomorrowStart);
    } else if (
      piece.attachment !== "solid" &&
      piece.dueAt !== undefined &&
      piece.dueAt > now
    ) {
      next = minOrNull(next, piece.dueAt);
    }
  }
  return next;
}

const PIECE_STATE: Record<PieceAttachment, PassagePieceState> = {
  unreached: "upNext",
  learning: "learning",
  attached: "learned",
  solid: "learned",
};

export function passageGoal<P extends string>(
  passage: GoalPassageInput<P>,
  now: number,
  tzOffsetMinutes: number,
): PassageGoalCard<P> {
  const pieces = coerceUnstartedLearningPieces(passage.pieces);
  let verseCount = 0;
  let learnedVerses = 0;
  for (const piece of pieces) {
    const verses = piece.endVerse - piece.startVerse + 1;
    verseCount += verses;
    if (piece.attachment === "attached" || piece.attachment === "solid") {
      learnedVerses += verses;
    }
  }

  const building = passage.status === "building";
  const hasWorkToday = building
    ? isPassageDueForLearning({ ...passage, pieces }, now, tzOffsetMinutes)
    : isPassageDueForReview(passage, now);
  const tomorrowStart = localDayStart(now, tzOffsetMinutes) + DAY_MS;
  const todayIndex =
    building && hasWorkToday
      ? passageTodayPieceIndex(passage, pieces, now, tzOffsetMinutes)
      : null;

  return {
    kind: "passage",
    packId: passage.packId,
    title: passage.title,
    verseCount,
    learnedVerses,
    pieceStates: pieces.map((piece, index) => ({
      verses: piece.endVerse - piece.startVerse + 1,
      state: PIECE_STATE[piece.attachment],
      today: index === todayIndex,
    })),
    status: passage.status,
    hasWorkToday,
    todayStep:
      todayIndex === null ? null : passageTodayStep(pieces, todayIndex),
    masteryFraction: masteryFor(passage),
    nextDueAt: !building
      ? passage.dueAt
      : hasWorkToday
        ? passageLearningDueAt(pieces, now)
        : nextBuildingSessionAt(pieces, now, tomorrowStart),
    createdAt: passage.createdAt,
    lastActivityAt: Math.max(
      passage.createdAt,
      passage.lastSessionAt ?? passage.createdAt,
    ),
    lastPracticedAt: passage.lastSessionAt ?? null,
  };
}

function packGoal<P extends string, V extends string>(
  pack: GoalPackInput<P, V>,
  members: readonly GoalVerseInput<V>[],
  input: GoalsInput<P, V>,
): PackGoalCard<P, V> {
  const { now } = input;
  const reviewTogether = input.reviewTogether.has(pack.packId);
  const togetherDue = input.reviewTogether.get(pack.packId) ?? null;

  let learned = 0;
  let learning = 0;
  let upNext = 0;
  let mastered = 0;
  let masterySum = 0;
  let learningOpen = 0;
  let nextDueAt: number | null = null;
  let lastPracticedAt: number | null = null;
  const reviewsDue: PackGoalReview<V>[] = [];

  for (const member of members) {
    if (isReviewPhase(member.status)) learned += 1;
    if (member.status === "mastered") mastered += 1;
    if (member.status === "learning") learning += 1;
    if (member.status === "new") upNext += 1;
    masterySum += masteryFor(member);
    if (isDueForLearning(member, now)) learningOpen += 1;
    if (member.status !== "new") nextDueAt = minOrNull(nextDueAt, member.dueAt);
    lastPracticedAt = maxOrNull(lastPracticedAt, member.lastReviewedAt);

    const reviewDue = reviewTogether
      ? togetherDue !== null && isDueForReview(member, now)
      : isDueForReview(member, now) &&
        !input.reviewTogetherVerseRefIds.has(member.verseRefId);
    if (reviewDue) {
      reviewsDue.push({
        verseRefId: member.verseRefId,
        label: formatVerseRefTitle(member),
      });
    }
  }

  const learningToday =
    learningOpen + (input.upNextByPackId.get(pack.packId)?.length ?? 0);

  return {
    kind: "pack",
    packId: pack.packId,
    title: pack.name,
    verseCount: members.length,
    learned,
    learning,
    upNext,
    mastered,
    masteryFraction: members.length === 0 ? 0 : masterySum / members.length,
    reviewsDue,
    learningToday,
    reviewTogether,
    hasWorkToday: learningToday > 0 || reviewsDue.length > 0,
    nextDueAt,
    createdAt: pack.createdAt,
    lastActivityAt: Math.max(pack.createdAt, lastPracticedAt ?? 0),
    lastPracticedAt,
    memberLabels: members.map((member) => formatVerseRefTitle(member)),
  };
}

function verseGoal<V extends string>(
  verse: GoalVerseInput<V>,
  now: number,
): VerseGoalCard<V> {
  return {
    kind: "verse",
    verseRefId: verse.verseRefId,
    title: formatVerseRefTitle(verse),
    book: verse.book,
    chapter: verse.chapter,
    startVerse: verse.startVerse,
    endVerse: verse.endVerse,
    status: verse.status,
    learnStage: verse.learnStage,
    intervalDays: verse.intervalDays,
    masteryFraction: masteryFor(verse),
    hasWorkToday: isDueForLearning(verse, now) || isDueForReview(verse, now),
    nextDueAt: verse.status === "new" ? null : verse.dueAt,
    createdAt: verse.createdAt,
    lastActivityAt: Math.max(
      verse.createdAt,
      verse.lastReviewedAt ?? verse.createdAt,
    ),
    lastPracticedAt: verse.lastReviewedAt ?? null,
  };
}

const VERSE_LEARN_DAYS = estimateMemorizeDays({ mode: "verse", verseCount: 1 });

/**
 * Days of learning left with a session every day; 0 once everything is past
 * the learning steps. Feeds "on track for {date}" and the goal sort.
 */
export function goalLearnDaysLeft(goal: GoalCard): number {
  switch (goal.kind) {
    case "passage":
      return estimateMemorizeDays({
        mode: "passage",
        verseCount: goal.verseCount - goal.learnedVerses,
      });
    case "pack":
      return estimateMemorizeDays({
        mode: "pack",
        verseCount: goal.verseCount - goal.learned,
      });
    case "verse":
      if (isReviewPhase(goal.status)) return 0;
      if (goal.status === "new") return VERSE_LEARN_DAYS;
      return VERSE_LEARN_DAYS - stepLadderDay(goal.learnStage) + 1;
  }
}

/** "On track for {date}" assumes a daily session; after this many idle days it reads "to go". */
const ON_TRACK_IDLE_DAYS = 2;

/** True when a session is open now, or a lock still opens later today. */
function learnsToday(goal: GoalCard, now: number, timeZone?: string): boolean {
  if (goal.kind === "pack" ? goal.learningToday > 0 : goal.hasWorkToday) {
    return true;
  }
  return (
    goal.nextDueAt !== null &&
    goal.nextDueAt > now &&
    calendarDaysBetween(now, goal.nextDueAt, timeZone) <= 0
  );
}

/**
 * How learning is pacing: "learn it in about 4 days" before the first
 * session, "about 4 days to go" once practice has paused for 2 or more days,
 * else "on track for Oct 15". `null` once everything is learned.
 */
export function goalLearnPace(
  goal: GoalCard,
  now: number,
  timeZone?: string,
): string | null {
  const days = goalLearnDaysLeft(goal);
  if (days <= 0) return null;
  if (goal.lastPracticedAt === null) {
    return formatLearnDuration(days).toLowerCase();
  }
  if (
    calendarDaysBetween(goal.lastPracticedAt, now, timeZone) >=
    ON_TRACK_IDLE_DAYS
  ) {
    return `${formatLearnDuration(days, { short: true })} to go`;
  }
  const finish = new Date(now);
  finish.setDate(
    finish.getDate() + days - (learnsToday(goal, now, timeZone) ? 1 : 0),
  );
  return `on track for ${formatShortDate(finish, timeZone)}`;
}

/** Work today first, then the soonest projected learn date. */
function compareGoals(a: GoalCard, b: GoalCard): number {
  if (a.hasWorkToday !== b.hasWorkToday) return a.hasWorkToday ? -1 : 1;
  const byLearn = goalLearnDaysLeft(a) - goalLearnDaysLeft(b);
  if (byLearn !== 0) return byLearn;
  const aDue = a.nextDueAt ?? Number.POSITIVE_INFINITY;
  const bDue = b.nextDueAt ?? Number.POSITIVE_INFINITY;
  if (aDue !== bDue) return aDue < bDue ? -1 : 1;
  if (a.lastActivityAt !== b.lastActivityAt) {
    return b.lastActivityAt - a.lastActivityAt;
  }
  return a.title.localeCompare(b.title);
}

/** Every goal, sorted for Today. */
export function buildGoalCards<P extends string, V extends string>(
  input: GoalsInput<P, V>,
): GoalCard<P, V>[] {
  const { now, tzOffsetMinutes } = input;
  const verseByRef = new Map(
    input.verses.map((verse) => [verse.verseRefId, verse]),
  );
  const passagePackIds = new Set(input.passages.map((p) => p.packId));
  const ranges = passageRanges(input.passages);

  const goals: GoalCard<P, V>[] = input.passages.map((passage) =>
    passageGoal(passage, now, tzOffsetMinutes),
  );

  const inPack = new Set<V>();
  for (const pack of input.packs) {
    const isPassage = passagePackIds.has(pack.packId);
    // A passage's own scope does not make its verses pack members.
    if (isPassage && pack.kind === "scope") continue;
    const members = packMembers(pack, verseByRef);
    for (const member of members) inPack.add(member.verseRefId);
    if (!isPassage && members.length > 0) {
      goals.push(packGoal(pack, members, input));
    }
  }

  for (const verse of input.verses) {
    if (inPack.has(verse.verseRefId) || insidePassage(verse, ranges)) continue;
    if (!isLearningPhase(verse.status) && !isDueForReview(verse, now)) {
      continue;
    }
    goals.push(verseGoal(verse, now));
  }

  return goals.sort(compareGoals);
}

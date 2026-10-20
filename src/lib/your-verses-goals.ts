import type { GoalCard, PackGoalCard, PassageGoalCard } from "./memory-goals";
import { isLearningPhase, type MemoryStatus } from "./memory-scheduler";
import {
  packDetailActions,
  passageDetailActions,
  type PackDetailSession,
} from "./pack-detail-model";

/**
 * Your verses' Passages and packs: each one's row (its status mix and one
 * session, due or not), filtered by kind and stage, then sorted. Pure; the
 * goals come from `memoryHome.today` in Today's order.
 */

export type GoalRowGoal = PassageGoalCard | PackGoalCard;

export interface GoalStatusSegment {
  status: MemoryStatus;
  count: number;
}

export interface GoalRowAction {
  label: "Start" | "Continue" | "Review" | "Practice";
  session: PackDetailSession;
  /** Today's work, rather than practice that can wait. */
  dueToday: boolean;
}

/**
 * Verses by status, most learned first. A passage's learned verses read as
 * memorized while it is still being built.
 */
export function goalStatusSegments(goal: GoalRowGoal): GoalStatusSegment[] {
  const segments: GoalStatusSegment[] =
    goal.kind === "pack"
      ? [
          { status: "mastered", count: goal.mastered },
          { status: "reviewing", count: goal.learned - goal.mastered },
          { status: "learning", count: goal.learning },
          { status: "new", count: goal.upNext },
        ]
      : goal.status !== "building"
        ? [
            {
              status: goal.status === "mastered" ? "mastered" : "reviewing",
              count: goal.verseCount,
            },
          ]
        : (["learned", "learning", "upNext"] as const).map((state) => ({
            status:
              state === "learned"
                ? "reviewing"
                : state === "learning"
                  ? "learning"
                  : "new",
            count: goal.pieceStates
              .filter((piece) => piece.state === state)
              .reduce((sum, piece) => sum + piece.verses, 0),
          }));
  return segments.filter((segment) => segment.count > 0);
}

function started(goal: GoalRowGoal): boolean {
  if (goal.lastPracticedAt !== null) return true;
  return goal.kind === "pack"
    ? goal.learned + goal.learning > 0
    : goal.learnedVerses > 0;
}

/** Today's session when there is one, else Practice; `null` while a building passage waits. */
export function goalRowAction(
  goal: GoalRowGoal,
  now: number,
  timeZone?: string,
): GoalRowAction | null {
  const { main } =
    goal.kind === "pack"
      ? packDetailActions(goal, now, timeZone)
      : passageDetailActions(goal, now, timeZone);
  if (main?.kind !== "session") return null;
  const label =
    main.session === "practice"
      ? "Practice"
      : main.session === "review"
        ? "Review"
        : started(goal)
          ? "Continue"
          : "Start";
  return { label, session: main.session, dueToday: goal.hasWorkToday };
}

export type GoalKindFilter = "all" | "passage" | "pack";
export type GoalStage = "learning" | "memorized" | "mastered";
export type GoalStageFilter = "due" | GoalStage;
export type GoalSort = "today" | "newest" | "leastLearned" | "name";

export const GOAL_KIND_FILTERS: { key: GoalKindFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "passage", label: "Passages" },
  { key: "pack", label: "Packs" },
];

export const GOAL_STAGE_FILTERS: { key: GoalStageFilter; label: string }[] = [
  { key: "due", label: "Due today" },
  { key: "learning", label: "Learning" },
  { key: "memorized", label: "Memorized" },
  { key: "mastered", label: "Mastered" },
];

export const GOAL_SORTS: { key: GoalSort; label: string }[] = [
  { key: "today", label: "Today's order" },
  { key: "newest", label: "Newest first" },
  { key: "leastLearned", label: "Least learned first" },
  { key: "name", label: "Name A–Z" },
];

/**
 * Where a goal is as a whole: still learning until every verse is learned,
 * mastered once every verse is.
 */
export function goalStage(goal: GoalCard): GoalStage {
  switch (goal.kind) {
    case "passage":
      return goal.status === "building"
        ? "learning"
        : goal.status === "mastered"
          ? "mastered"
          : "memorized";
    case "pack":
      if (goal.learned < goal.verseCount) return "learning";
      return goal.mastered === goal.verseCount ? "mastered" : "memorized";
    case "verse":
      if (isLearningPhase(goal.status)) return "learning";
      return goal.status === "mastered" ? "mastered" : "memorized";
  }
}

function learnedFraction(goal: GoalCard): number {
  switch (goal.kind) {
    case "passage":
      return goal.verseCount === 0 ? 0 : goal.learnedVerses / goal.verseCount;
    case "pack":
      return goal.verseCount === 0 ? 0 : goal.learned / goal.verseCount;
    case "verse":
      return isLearningPhase(goal.status) ? 0 : 1;
  }
}

export function filterGoals<G extends GoalCard>(
  goals: readonly G[],
  kind: GoalKindFilter,
  stage: GoalStageFilter | null,
): G[] {
  return goals.filter(
    (goal) =>
      (kind === "all" || goal.kind === kind) &&
      (stage === null ||
        (stage === "due" ? goal.hasWorkToday : goalStage(goal) === stage)),
  );
}

const byName = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: "base",
});

/** A stable sort; ties keep Today's order. */
export function sortGoals<G extends GoalCard>(
  goals: readonly G[],
  sort: GoalSort,
): G[] {
  const compare = (a: G, b: G): number => {
    switch (sort) {
      case "today":
        return 0;
      case "newest":
        return b.createdAt - a.createdAt;
      case "leastLearned":
        return learnedFraction(a) - learnedFraction(b);
      case "name":
        return byName.compare(a.title, b.title);
    }
  };
  return goals
    .map((goal, index) => ({ goal, index }))
    .sort((a, b) => compare(a.goal, b.goal) || a.index - b.index)
    .map(({ goal }) => goal);
}

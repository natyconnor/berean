import { statusLabel, stepDayLine } from "./memory-copy";
import type { GoalCard } from "./memory-goals";
import type { MemoryPanel } from "./memory-panel";
import {
  memoryPackSessionHref,
  memoryTodaySessionHref,
  memoryVerseSessionHref,
} from "./memory-session-path";
import { calendarDaysBetween, nextStepCopy } from "./memorize-plan";
import { DAY_MS, isReviewPhase, type MemoryStatus } from "./memory-scheduler";

/**
 * The compact Your verses drawer: what is due today grouped by goal, what was
 * active lately, and a search over goal titles and pack members. Pure; the
 * goals come from `memoryHome.today`.
 */

export type DueGoalAction = "learn" | "review";

export interface DueGoalRow<G extends GoalCard = GoalCard> {
  goal: G;
  title: string;
  detail: string;
  action: DueGoalAction;
  /** Status colour for the row's dot. */
  tone: MemoryStatus;
}

export const RECENT_GOAL_LIMIT = 6;
const RECENT_WINDOW_DAYS = 7;
const LISTED_REVIEW_LABELS = 3;

function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

/** "Luke 9:23–24, Matthew 6:33, Deuteronomy 6:4–5 and 2 more" */
export function listLabels(labels: readonly string[]): string {
  if (labels.length <= 1) return labels[0] ?? "";
  if (labels.length <= LISTED_REVIEW_LABELS) {
    return `${labels.slice(0, -1).join(", ")} and ${labels[labels.length - 1]}`;
  }
  const shown = labels.slice(0, LISTED_REVIEW_LABELS).join(", ");
  return `${shown} and ${labels.length - LISTED_REVIEW_LABELS} more`;
}

export function goalKey(goal: GoalCard): string {
  return goal.kind === "verse"
    ? `verse:${goal.verseRefId}`
    : `${goal.kind}:${goal.packId}`;
}

/** The detail drawer or page for a goal. Passages are packs underneath. */
export function goalPanel(goal: GoalCard): MemoryPanel {
  return goal.kind === "verse"
    ? { kind: "verse", verseRefId: goal.verseRefId }
    : { kind: "pack", packId: goal.packId };
}

/** A pack with learning and reviews today runs both in one session. */
function runsPackToday(goal: GoalCard): boolean {
  return (
    goal.kind === "pack" && goal.learningToday > 0 && goal.reviewsDue.length > 0
  );
}

export function goalSessionHref(goal: GoalCard, action: DueGoalAction): string {
  if (goal.kind === "verse") return memoryVerseSessionHref(action, goal);
  if (runsPackToday(goal)) {
    return memoryTodaySessionHref({ packId: goal.packId });
  }
  return memoryPackSessionHref(action, goal.packId);
}

/** The due row's button: "Continue" when it runs a pack's learning and reviews together. */
export function dueGoalButtonLabel(
  row: DueGoalRow,
): "Learn" | "Review" | "Continue" {
  if (runsPackToday(row.goal)) return "Continue";
  return row.action === "learn" ? "Learn" : "Review";
}

function dueRow<G extends GoalCard>(goal: G): DueGoalRow<G> | null {
  if (!goal.hasWorkToday) return null;
  switch (goal.kind) {
    case "passage":
      if (goal.status === "building") {
        return {
          goal,
          title: goal.title,
          detail: goal.todayStep?.label ?? "New verses today",
          action: "learn",
          tone: goal.todayStep?.ladderDay === 1 ? "new" : "learning",
        };
      }
      return {
        goal,
        title: goal.title,
        detail: "Recite it today",
        action: "review",
        tone: goal.status === "mastered" ? "mastered" : "reviewing",
      };
    case "pack": {
      const reviews = goal.reviewsDue.length;
      const labels = listLabels(goal.reviewsDue.map((review) => review.label));
      if (goal.learningToday > 0) {
        const parts = [
          `${goal.learningToday} to learn`,
          reviews > 0 ? plural(reviews, "review") : null,
        ].filter((part): part is string => part !== null);
        return {
          goal,
          title: `${goal.title} · ${parts.join(" · ")}`,
          detail:
            reviews > 0
              ? labels
              : `${plural(goal.learningToday, "verse")} to learn today`,
          action: "learn",
          tone: "learning",
        };
      }
      return {
        goal,
        title: `${goal.title} · ${plural(reviews, "review")}`,
        detail: labels,
        action: "review",
        tone: "reviewing",
      };
    }
    case "verse":
      if (isReviewPhase(goal.status)) {
        return {
          goal,
          title: goal.title,
          detail: `${statusLabel(goal.status)} · review due today`,
          action: "review",
          tone: goal.status,
        };
      }
      return {
        goal,
        title: goal.title,
        detail: `${statusLabel(goal.status)} · ${stepDayLine(goal.learnStage)}`,
        action: "learn",
        tone: goal.status,
      };
  }
}

/** One row per goal with work today, in Today's goal order. */
export function dueGoalRows<G extends GoalCard>(
  goals: readonly G[],
): DueGoalRow<G>[] {
  return goals.flatMap((goal) => {
    const row = dueRow(goal);
    return row ? [row] : [];
  });
}

/**
 * The most recently active goals. `lastWeek` says every one of them was active
 * in the last 7 days, so the section can say so.
 */
export function recentGoals<G extends GoalCard>(
  goals: readonly G[],
  now: number,
  limit = RECENT_GOAL_LIMIT,
): { goals: G[]; lastWeek: boolean } {
  const recent = [...goals]
    .sort((a, b) => b.lastActivityAt - a.lastActivityAt)
    .slice(0, limit);
  const weekAgo = now - RECENT_WINDOW_DAYS * DAY_MS;
  return {
    goals: recent,
    lastWeek:
      recent.length > 0 &&
      recent.every((goal) => goal.lastActivityAt >= weekAgo),
  };
}

function activityLine(
  goal: GoalCard,
  now: number,
  timeZone: string | undefined,
): string | null {
  const [verb, at] =
    goal.lastPracticedAt !== null
      ? (["practiced", goal.lastPracticedAt] as const)
      : (["added", goal.createdAt] as const);
  const days = calendarDaysBetween(at, now, timeZone);
  if (days <= 0) return `${verb} today`;
  if (days === 1) return `${verb} yesterday`;
  return days < RECENT_WINDOW_DAYS ? `${verb} ${days} days ago` : null;
}

/** "Passage · 4 of 11 learned · practiced today", "Pack · 5 of 9 learned · mastery 22%". */
export function goalStatusLine(
  goal: GoalCard,
  now: number,
  timeZone?: string,
): string {
  switch (goal.kind) {
    case "passage": {
      const activity = activityLine(goal, now, timeZone);
      const parts = [
        "Passage",
        `${goal.learnedVerses} of ${goal.verseCount} learned`,
        activity,
      ];
      return parts.filter((part) => part !== null).join(" · ");
    }
    case "pack": {
      const parts = [
        "Pack",
        `${goal.learned} of ${goal.verseCount} learned`,
        goal.learned > 0
          ? `mastery ${Math.round(goal.masteryFraction * 100)}%`
          : null,
      ];
      return parts.filter((part) => part !== null).join(" · ");
    }
    case "verse":
      return [
        "Verse",
        statusLabel(goal.status),
        nextStepCopy(
          {
            status: goal.status,
            learnStage: goal.learnStage,
            dueAt: goal.nextDueAt ?? now,
          },
          now,
          timeZone,
        ),
      ].join(" · ");
  }
}

export interface GoalSearchHit<G extends GoalCard = GoalCard> {
  goal: G;
  /** The pack member that matched when the pack title did not. */
  matchedMember: string | null;
}

function normalize(text: string): string {
  return text.toLowerCase().replace(/[–—]/g, "-").replace(/\s+/g, " ").trim();
}

/** Goals whose title, or one of whose pack members, contains `query`. */
export function searchGoals<G extends GoalCard>(
  goals: readonly G[],
  query: string,
): GoalSearchHit<G>[] {
  const needle = normalize(query);
  if (needle.length === 0) return [];
  return goals.flatMap((goal): GoalSearchHit<G>[] => {
    if (normalize(goal.title).includes(needle)) {
      return [{ goal, matchedMember: null }];
    }
    if (goal.kind !== "pack") return [];
    const member = goal.memberLabels.find((label) =>
      normalize(label).includes(needle),
    );
    return member === undefined ? [] : [{ goal, matchedMember: member }];
  });
}

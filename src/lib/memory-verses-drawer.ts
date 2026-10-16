import { statusLabel } from "./memory-copy";
import type { GoalCard } from "./memory-goals";
import type { MemoryPanel } from "./memory-panel";
import { calendarDaysBetween, nextStepCopy } from "./memorize-plan";

/**
 * Your verses rows: each goal's key, detail panel, and one status line, and
 * a search over goal titles and pack members. Pure; the goals come from
 * `memoryHome.today`.
 */

const RECENT_WINDOW_DAYS = 7;
const LISTED_REVIEW_LABELS = 3;

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

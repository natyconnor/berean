import {
  isDueForReview,
  isReviewPhase,
  type MemoryAvailability,
} from "./memory-scheduler";
import type { PassageGoalCard } from "./memory-goals";
import { packLearningToday } from "./pack-pacing";
import type { PassageDueStatus } from "./passage-due";

/**
 * What a row in "Passages and packs" says about its passage or pack.
 * `packs.listMine` builds these; Convex imports this module, so it must only
 * use relative imports.
 */
export type PackListSummary =
  | {
      kind: "passage";
      status: PassageDueStatus;
      verseCount: number;
      /** Verses joined into the passage, as on its detail. */
      learnedVerses: number;
      hasWorkToday: boolean;
      /** Next session while building, else the next recite. */
      nextDueAt: number | null;
      masteryFraction: number;
    }
  | {
      kind: "pack";
      /** In-Memory members. */
      verseCount: number;
      /** Members past the learning steps (memorized or mastered). */
      learned: number;
      mastered: number;
      /** Verses with a step or review today. */
      today: number;
    };

export function passageListSummary(
  goal: PassageGoalCard<string>,
): PackListSummary {
  return {
    kind: "passage",
    status: goal.status,
    verseCount: goal.verseCount,
    learnedVerses: goal.learnedVerses,
    hasWorkToday: goal.hasWorkToday,
    nextDueAt: goal.nextDueAt,
    masteryFraction: goal.masteryFraction,
  };
}

/** `members` in pack order, so Up-next pacing matches the pack's Today count. */
export function packListSummary(
  members: readonly (MemoryAvailability & { verseRefId: string })[],
  now: number,
): PackListSummary {
  const learningToday = packLearningToday(members, now).length;
  let learned = 0;
  let mastered = 0;
  let reviews = 0;
  for (const member of members) {
    if (isReviewPhase(member.status)) learned += 1;
    if (member.status === "mastered") mastered += 1;
    if (isDueForReview(member, now)) reviews += 1;
  }
  return {
    kind: "pack",
    verseCount: members.length,
    learned,
    mastered,
    today: learningToday + reviews,
  };
}

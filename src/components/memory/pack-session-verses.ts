import type { FunctionReturnType } from "convex/server";

import type { PracticeVerse } from "@/components/memory/practice/practice-board";
import { toPracticeVerse } from "@/components/memory/to-practice-verse";
import type { CardReference } from "@/components/study/study-card-model";
import { isReviewPhase, type MemorySchedule } from "@/lib/memory-scheduler";
import { sortSessionVerses } from "@/lib/memory-session-order";
import { packLearningToday } from "@/lib/pack-pacing";
import { canonicalUnifiedSchedule } from "@/lib/unified-review-schedule";

import type { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

export type PackSessionMember = FunctionReturnType<
  typeof api.packs.resolveMembers
>[number];

function memberReference(member: PackSessionMember): CardReference {
  return {
    book: member.book,
    chapter: member.chapter,
    startVerse: member.startVerse,
    endVerse: member.endVerse,
  };
}

function memberSchedule(member: PackSessionMember): MemorySchedule {
  return {
    status: member.status,
    learnStage: member.learnStage,
    stageReps: member.stageReps,
    ease: member.ease,
    intervalDays: member.intervalDays,
    dueAt: member.dueAt,
    consecutiveCorrect: member.consecutiveCorrect,
    lapses: member.lapses,
    earlyReviewApplied: member.earlyReviewApplied ?? false,
  };
}

/**
 * A pack's learning session: started verses open today plus only its paced
 * Up-next verses (`members` in pack order, as `packs.resolveMembers` returns).
 */
export function packLearningSessionVerses(
  members: readonly PackSessionMember[],
  now: number,
): PracticeVerse[] {
  return sortSessionVerses(
    packLearningToday(members, now).map((member) => toPracticeVerse(member)),
  );
}

export interface PackReviewSession {
  verses: PracticeVerse[];
  /** Due items right now: one recitation, or each due verse. */
  dueCount: number;
  /** Review together is on but not every verse is memorized yet. */
  unifiedBlocked: boolean;
}

/**
 * A pack's review session. With Review together on, the whole pack recites as
 * one card once every verse is memorized, and nothing reviews before that.
 */
export function packReviewSession({
  packId,
  packName,
  unifiedReviewEnabled,
  members,
  now,
}: {
  packId: Id<"packs">;
  packName: string;
  unifiedReviewEnabled: boolean;
  members: readonly PackSessionMember[];
  now: number;
}): PackReviewSession {
  const dueMembers = members.filter((member) => member.isDue);

  if (!unifiedReviewEnabled) {
    return {
      verses: sortSessionVerses(
        dueMembers.map((member) => toPracticeVerse(member)),
      ),
      dueCount: dueMembers.length,
      unifiedBlocked: false,
    };
  }

  // A flagged pack can still pick up an ungraduated member — a new heart inside
  // the scope, or a lapse back into learning. The recitation needs every member
  // in review phase, and grading the spans one at a time is not a fallback: it
  // would write per-verse schedules the pack UI still presents as one item.
  const allMemorized =
    members.length > 0 &&
    members.every((member) => isReviewPhase(member.status));
  const lead = members[0];
  if (!allMemorized || !lead || dueMembers.length === 0) {
    return { verses: [], dueCount: 0, unifiedBlocked: !allMemorized };
  }

  // Enabling already pulled every member to today and synced their schedules,
  // so the whole pack recites together — the conservative canonical schedule
  // (same helper the mutation uses) drives the card's "next review" preview.
  const canonical = canonicalUnifiedSchedule(members.map(memberSchedule), now);
  return {
    verses: [
      {
        reference: memberReference(lead),
        learnStage: canonical.learnStage,
        stageReps: canonical.stageReps,
        status: canonical.status,
        dueAt: canonical.dueAt,
        ease: canonical.ease,
        intervalDays: canonical.intervalDays,
        consecutiveCorrect: canonical.consecutiveCorrect,
        lapses: canonical.lapses,
        earlyReviewApplied: canonical.earlyReviewApplied,
        composite: {
          packId,
          packName,
          members: members.map(memberReference),
        },
      },
    ],
    dueCount: 1,
    unifiedBlocked: false,
  };
}

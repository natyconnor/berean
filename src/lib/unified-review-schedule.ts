import {
  isLearningPhase,
  scheduleNext,
  type MemorySchedule,
  type ReviewInput,
} from "./memory-scheduler";

/**
 * Conservative lead among review-phase members: smallest interval, then lowest
 * ease, then highest lapses. The result is due now so enabling unified review
 * does not hide work that was already due on a tighter schedule.
 */
export function canonicalUnifiedSchedule(
  members: readonly MemorySchedule[],
  now: number,
): MemorySchedule {
  if (members.length === 0) {
    throw new Error("Unified review requires at least one member");
  }
  for (const member of members) {
    if (isLearningPhase(member.status)) {
      throw new Error(
        "Unified review requires every member to be in review phase",
      );
    }
  }

  const lead = pickLead(members);
  return {
    status: lead.status,
    learnStage: lead.learnStage,
    stageReps: lead.stageReps,
    ease: lead.ease,
    intervalDays: lead.intervalDays,
    consecutiveCorrect: lead.consecutiveCorrect,
    lapses: lead.lapses,
    dueAt: now,
    earlyReviewApplied: false,
  };
}

/**
 * Apply one recitation grade to the canonical schedule. Callers copy the
 * returned schedule onto every pack member.
 */
export function applyUnifiedGrade(
  canonical: MemorySchedule,
  input: ReviewInput,
): MemorySchedule {
  return scheduleNext(canonical, input);
}

function pickLead(members: readonly MemorySchedule[]): MemorySchedule {
  const first = members[0];
  if (!first) {
    throw new Error("Unified review requires at least one member");
  }
  let lead = first;
  for (let i = 1; i < members.length; i++) {
    const member = members[i];
    if (member.intervalDays < lead.intervalDays) {
      lead = member;
      continue;
    }
    if (member.intervalDays > lead.intervalDays) continue;
    if (member.ease < lead.ease) {
      lead = member;
      continue;
    }
    if (member.ease > lead.ease) continue;
    if (member.lapses > lead.lapses) {
      lead = member;
    }
  }
  return lead;
}

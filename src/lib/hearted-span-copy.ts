import { isLearningLocked, type MemoryStatus } from "./memory-scheduler";
import { reviewPhaseListAction } from "./memory-session";

export type HeartedSpanMemory = {
  status: MemoryStatus;
  dueAt?: number;
  lastReviewedAt?: number;
};

/**
 * Lead-in for a hearted span the current Browse selection overlaps or matches.
 *
 * Status maps to what Learn/Add will actually do:
 * - new / unknown → saved, not started
 * - learning → already in the Learn flow
 * - reviewing / mastered, due → Learn confirm opens Review
 * - reviewing / mastered, not due → Learn confirm opens Practice
 */
export function alreadyHeartedLeadIn(status?: MemoryStatus): string {
  switch (status) {
    case "learning":
      return "You've already started learning";
    case "reviewing":
      return "You're already reviewing";
    case "mastered":
      return "You've already memorized";
    case "new":
    default:
      return "You've already hearted";
  }
}

/**
 * Footer / row CTA for an exact hearted span in the Learn picker.
 * Pack Add keeps its own confirm label.
 */
export function heartedSpanConfirmAction(
  confirmLabel: string,
  memory?: HeartedSpanMemory,
  now?: number,
): { label: string; disabled: boolean } {
  if (confirmLabel !== "Learn") {
    return { label: confirmLabel, disabled: false };
  }
  if (!memory || memory.status === "new") {
    return { label: "Learn", disabled: false };
  }
  if (memory.status === "learning") {
    const locked =
      memory.dueAt !== undefined &&
      now !== undefined &&
      isLearningLocked(
        {
          status: memory.status,
          dueAt: memory.dueAt,
          lastReviewedAt: memory.lastReviewedAt,
        },
        now,
      );
    return locked
      ? { label: "Tomorrow", disabled: true }
      : { label: "Continue Learning", disabled: false };
  }
  if (memory.status === "reviewing" || memory.status === "mastered") {
    const label =
      now !== undefined &&
      reviewPhaseListAction(
        { status: memory.status, dueAt: memory.dueAt },
        now,
      ) === "review"
        ? "Review"
        : "Practice";
    return { label, disabled: false };
  }
  return { label: "Learn", disabled: false };
}

type PassageStatus = "building" | "reviewing" | "mastered";

type CelebrationFields = {
  celebratedAt?: number;
  celebrationPendingAt?: number;
};

/**
 * When a passage first leaves building, the "by heart" moment is owed until
 * it is shown. Returns the patch for that, or an empty patch when nothing is
 * newly owed (already celebrated, already pending, or no transition).
 */
export function celebrationPendingPatch(
  row: CelebrationFields & { status: PassageStatus },
  nextStatus: PassageStatus,
  now: number,
): { celebrationPendingAt?: number } {
  if (row.status !== "building" || nextStatus === "building") return {};
  if (row.celebratedAt !== undefined) return {};
  if (row.celebrationPendingAt !== undefined) return {};
  return { celebrationPendingAt: now };
}

/** The moment is owed and has not been shown yet. */
export function needsCelebration(row: CelebrationFields): boolean {
  return (
    row.celebrationPendingAt !== undefined && row.celebratedAt === undefined
  );
}

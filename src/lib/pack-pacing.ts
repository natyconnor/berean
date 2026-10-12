import type { MemoryStatus } from "./memory-scheduler";

/**
 * Most verses one pack keeps on the learning ladder at once. Without a cap, a
 * large pack would make every member due on the day it was started.
 */
export const PACK_ACTIVE_LEARNING_CAP = 3;

/**
 * Up-next members that should start learning now: the first
 * `cap − (members already learning)` members with status `new`, in pack
 * order. Reviewing and mastered members do not count toward the cap. Returns
 * `[]` once `cap` or more members are learning.
 */
export function packUpNextVerseRefIds<
  T extends { verseRefId: string; status: MemoryStatus },
>(
  orderedMembers: readonly T[],
  cap: number = PACK_ACTIVE_LEARNING_CAP,
): T["verseRefId"][] {
  const learning = orderedMembers.filter(
    (member) => member.status === "learning",
  ).length;
  const open = cap - learning;
  if (open <= 0) return [];

  const upNext: T["verseRefId"][] = [];
  for (const member of orderedMembers) {
    if (upNext.length >= open) break;
    if (member.status === "new") upNext.push(member.verseRefId);
  }
  return upNext;
}

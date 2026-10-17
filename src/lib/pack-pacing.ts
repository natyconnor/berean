import { sortByVerseRef } from "../../shared/compare-verse-refs";
import type { VerseRefKeyInput } from "../../shared/verse-ref-key";

import {
  isDueForLearning,
  type MemoryAvailability,
  type MemoryStatus,
} from "./memory-scheduler";

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

/**
 * One pack's learning for today, in pack order: started verses whose step is
 * open now plus its paced Up-next verses. Other Up-next verses wait their
 * turn. Matches the pack's `learningToday` count on Today.
 */
export function packLearningToday<
  T extends MemoryAvailability & { verseRefId: string },
>(
  orderedMembers: readonly T[],
  now: number,
  cap: number = PACK_ACTIVE_LEARNING_CAP,
): T[] {
  const upNext = new Set<string>(packUpNextVerseRefIds(orderedMembers, cap));
  return orderedMembers.filter(
    (member) => upNext.has(member.verseRefId) || isDueForLearning(member, now),
  );
}

/** A pack member as pacing sees it: its verse and its place on the ladder. */
export type PacingMember = VerseRefKeyInput & {
  verseRefId: string;
  status: MemoryStatus;
};

/**
 * One pack's in-Memory members. Custom packs pace in their saved order. Scope
 * packs have no saved order, so they pace in Bible order.
 */
export interface PacingPack<PackId, T extends PacingMember> {
  packId: PackId;
  kind: "custom" | "scope";
  members: readonly T[];
}

export interface PackUpNext<PackId, T extends PacingMember> {
  /** Up-next members that join today's learning, each verse once. */
  members: T[];
  /** Each pack's own Up-next verse ids, before cross-pack dedupe. */
  byPackId: Map<PackId, T["verseRefId"][]>;
}

/**
 * Up-next verses across every paced pack: {@link packUpNextVerseRefIds} per
 * pack, then deduped so a verse listed in two packs joins learning once.
 * `members` keeps pack order, earlier packs first.
 */
export function packUpNextAcrossPacks<PackId, T extends PacingMember>(
  packs: readonly PacingPack<PackId, T>[],
  cap: number = PACK_ACTIVE_LEARNING_CAP,
): PackUpNext<PackId, T> {
  const members: T[] = [];
  const seen = new Set<T["verseRefId"]>();
  const byPackId = new Map<PackId, T["verseRefId"][]>();

  for (const pack of packs) {
    const ordered =
      pack.kind === "scope" ? sortByVerseRef(pack.members) : pack.members;
    const upNext = new Set(packUpNextVerseRefIds(ordered, cap));
    byPackId.set(pack.packId, [...upNext]);
    for (const member of ordered) {
      if (!upNext.has(member.verseRefId) || seen.has(member.verseRefId)) {
        continue;
      }
      seen.add(member.verseRefId);
      members.push(member);
    }
  }

  return { members, byPackId };
}

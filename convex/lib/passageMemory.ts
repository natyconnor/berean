import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import {
  frontierIndex,
  localDayIndex,
  rehearsalStartIndex,
  remainingIntroduces,
  ropePieceIndexes,
  type HeartedMemorySpan,
} from "../../src/lib/passage-frontier";
import type { PlanStartResult } from "../../src/lib/passage-start";
import {
  MAX_LEARN_STAGE,
  type MemorySchedule,
  type MemoryStatus,
} from "../../src/lib/memory-scheduler";
import { passageLearningDueAt } from "../../src/lib/passage-due";
import {
  loadOwnedPack,
  passagePiecesAsMembers,
  type PackMember,
} from "./packs";
import type { PassageView } from "./passageValues";

/** Pack card for global Learn / Review. Members are frozen pieces, not hearts. */
export type DueQueuePassagePackItem = {
  kind: "pack";
  packId: Id<"packs">;
  packName: string;
  dueAt: number;
  status: MemoryStatus;
  learnStage: number;
  stageReps: number;
  ease: number;
  intervalDays: number;
  consecutiveCorrect: number;
  lapses: number;
  earlyReviewApplied?: boolean;
  lastReviewedAt?: number;
  members: Array<{
    book: string;
    chapter: number;
    startVerse: number;
    endVerse: number;
  }>;
  passageStatus: Doc<"passageMemory">["status"];
};

export function toDueQueuePassagePackItem(
  pack: Doc<"packs">,
  row: Doc<"passageMemory">,
  args: {
    dueAt: number;
    status: MemoryStatus;
    learnStage: number;
  },
): DueQueuePassagePackItem | null {
  const members = passagePiecesAsMembers(row.pieces);
  if (members.length === 0) return null;
  return {
    kind: "pack",
    packId: pack._id,
    packName: pack.name,
    dueAt: args.dueAt,
    status: args.status,
    learnStage: args.learnStage,
    stageReps: row.stageReps,
    ease: row.ease,
    intervalDays: row.intervalDays,
    consecutiveCorrect: row.consecutiveCorrect,
    lapses: row.lapses,
    earlyReviewApplied: row.earlyReviewApplied,
    lastReviewedAt: row.lastSessionAt,
    members,
    passageStatus: row.status,
  };
}

export function toReviewingPassagePackItem(
  pack: Doc<"packs">,
  row: Doc<"passageMemory">,
): DueQueuePassagePackItem | null {
  return toDueQueuePassagePackItem(pack, row, {
    dueAt: row.dueAt,
    status: row.status === "mastered" ? "mastered" : "reviewing",
    learnStage: MAX_LEARN_STAGE,
  });
}

export function toBuildingPassagePackItem(
  pack: Doc<"packs">,
  row: Doc<"passageMemory">,
  now: number,
): DueQueuePassagePackItem | null {
  const frontier = row.pieces[frontierIndex(row.pieces)];
  return toDueQueuePassagePackItem(pack, row, {
    dueAt: passageLearningDueAt(row.pieces, now),
    status: "learning",
    learnStage: frontier?.learnStage ?? 0,
  });
}

/**
 * Owned `passageMemory` row for a pack, or `null` when the pack is missing,
 * not owned by `userId`, or has no passage row.
 */
export async function loadPassageForPack(
  ctx: QueryCtx | MutationCtx,
  packId: Id<"packs">,
  userId: Id<"users">,
): Promise<Doc<"passageMemory"> | null> {
  const pack = await loadOwnedPack(ctx, packId, userId);
  if (!pack) return null;

  const row = await findPassageByPackId(ctx, packId);
  if (!row || row.userId !== userId) return null;
  return row;
}

export async function findPassageByPackId(
  ctx: QueryCtx | MutationCtx,
  packId: Id<"packs">,
): Promise<Doc<"passageMemory"> | null> {
  return await ctx.db
    .query("passageMemory")
    .withIndex("by_packId", (q) => q.eq("packId", packId))
    .unique();
}

export async function requireOwnedPack(
  ctx: QueryCtx | MutationCtx,
  packId: Id<"packs">,
  userId: Id<"users">,
): Promise<Doc<"packs">> {
  const pack = await loadOwnedPack(ctx, packId, userId);
  if (!pack) throw new Error("Pack not found");
  return pack;
}

export async function requirePassageForPack(
  ctx: QueryCtx | MutationCtx,
  packId: Id<"packs">,
  userId: Id<"users">,
): Promise<Doc<"passageMemory">> {
  const pack = await requireOwnedPack(ctx, packId, userId);
  const row = await findPassageByPackId(ctx, pack._id);
  if (!row || row.userId !== userId) {
    throw new Error("Passage mode is not active");
  }
  return row;
}

export function memberToHeart(member: PackMember): HeartedMemorySpan {
  return {
    book: member.book,
    chapter: member.chapter,
    startVerse: member.startVerse,
    endVerse: member.endVerse,
    status: member.status,
    learnStage: member.learnStage,
    stageReps: member.stageReps,
  };
}

export function memberToSchedule(member: PackMember): MemorySchedule {
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

export function toPassageSchedule(row: Doc<"passageMemory">): MemorySchedule {
  return {
    status: row.status === "mastered" ? "mastered" : "reviewing",
    learnStage: MAX_LEARN_STAGE,
    stageReps: row.stageReps,
    ease: row.ease,
    intervalDays: row.intervalDays,
    dueAt: row.dueAt,
    consecutiveCorrect: row.consecutiveCorrect,
    lapses: row.lapses,
    earlyReviewApplied: row.earlyReviewApplied ?? false,
  };
}

export async function insertPassageMemory(
  ctx: MutationCtx,
  args: {
    userId: Id<"users">;
    packId: Id<"packs">;
    plan: PlanStartResult;
    now: number;
  },
): Promise<Doc<"passageMemory">> {
  const id = await ctx.db.insert("passageMemory", {
    userId: args.userId,
    packId: args.packId,
    status: args.plan.status,
    pieces: args.plan.pieces,
    addsOnDay: 0,
    ease: args.plan.schedule.ease,
    intervalDays: args.plan.schedule.intervalDays,
    dueAt: args.plan.schedule.dueAt,
    consecutiveCorrect: args.plan.schedule.consecutiveCorrect,
    lapses: args.plan.schedule.lapses,
    stageReps: args.plan.schedule.stageReps,
    earlyReviewApplied: args.plan.schedule.earlyReviewApplied,
    migratedAt: args.now,
    unheartedCount: args.plan.unheartedCount,
    keptHeartCount: args.plan.keptHeartCount,
    createdAt: args.now,
    updatedAt: args.now,
  });
  const row = await ctx.db.get(id);
  if (!row) throw new Error("Failed to create passage memory");
  return row;
}

export async function patchPassageMemory(
  ctx: MutationCtx,
  id: Id<"passageMemory">,
  patch: Partial<
    Omit<Doc<"passageMemory">, "_id" | "_creationTime" | "userId" | "packId">
  >,
): Promise<Doc<"passageMemory">> {
  await ctx.db.patch(id, patch);
  const row = await ctx.db.get(id);
  if (!row) throw new Error("Failed to update passage memory");
  return row;
}

export async function deletePassageAndReviews(
  ctx: MutationCtx,
  row: Doc<"passageMemory">,
): Promise<void> {
  const reviews = await ctx.db
    .query("passageReviews")
    .withIndex("by_packId", (q) => q.eq("packId", row.packId))
    .collect();
  for (const review of reviews) {
    await ctx.db.delete(review._id);
  }
  await ctx.db.delete(row._id);
}

export async function insertPassageReview(
  ctx: MutationCtx,
  args: {
    userId: Id<"users">;
    packId: Id<"packs">;
    passageMemoryId: Id<"passageMemory">;
    kind: Doc<"passageReviews">["kind"];
    quality: Doc<"passageReviews">["quality"];
    accuracy: number;
    now: number;
    durationMs?: number;
    pieceIndex?: number;
  },
): Promise<void> {
  await ctx.db.insert("passageReviews", {
    userId: args.userId,
    packId: args.packId,
    passageMemoryId: args.passageMemoryId,
    kind: args.kind,
    quality: args.quality,
    accuracy: args.accuracy,
    createdAt: args.now,
    ...(args.durationMs !== undefined ? { durationMs: args.durationMs } : {}),
    ...(args.pieceIndex !== undefined ? { pieceIndex: args.pieceIndex } : {}),
  });
}

/**
 * Client view of a passage row. Introduce budget, frontier, and the default
 * rope window are computed from pieces + `now` / `tzOffsetMinutes`.
 * Word-count rehearsal trim needs verse texts and is applied on the client.
 */
export function toPassageView(
  row: Doc<"passageMemory">,
  now: number,
  tzOffsetMinutes: number,
): PassageView {
  const pieces = row.pieces;
  return {
    _id: row._id,
    packId: row.packId,
    status: row.status,
    pieces,
    addDayKey: row.addDayKey,
    addsOnDay: row.addsOnDay,
    ease: row.ease,
    intervalDays: row.intervalDays,
    dueAt: row.dueAt,
    consecutiveCorrect: row.consecutiveCorrect,
    lapses: row.lapses,
    stageReps: row.stageReps,
    earlyReviewApplied: row.earlyReviewApplied,
    lastSessionAt: row.lastSessionAt,
    migratedAt: row.migratedAt,
    unheartedCount: row.unheartedCount,
    keptHeartCount: row.keptHeartCount,
    migrationBannerDismissed: row.migrationBannerDismissed,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    remainingIntroduces: remainingIntroduces({
      addsOnDay: row.addsOnDay,
      addDayKey: row.addDayKey,
      todayKey: localDayIndex(now, tzOffsetMinutes),
    }),
    frontierIndex: frontierIndex(pieces),
    rehearsalStartIndex: rehearsalStartIndex(pieces),
    ropePieceIndexes: ropePieceIndexes(pieces),
  };
}

import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import {
  frontierIndex,
  localDayIndex,
  rehearsalStartIndex,
  remainingIntroduces,
  ropePieceIndexes,
} from "../../src/lib/passage-frontier";
import { loadOwnedPack } from "./packs";
import type { PassageView } from "./passageValues";

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

  const row = await ctx.db
    .query("passageMemory")
    .withIndex("by_packId", (q) => q.eq("packId", packId))
    .unique();
  if (!row || row.userId !== userId) return null;
  return row;
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

import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import {
  projectPassageDue,
  type PassageDueProjection,
} from "../../src/lib/passage-due";
import { coerceUnstartedLearningPieces } from "../../src/lib/passage-frontier";

export type PassageDueRecord = PassageDueProjection & {
  passageMemoryId: Id<"passageMemory">;
  packId: Id<"packs">;
};

function toDueFields(
  row: Doc<"passageMemory">,
  now: number,
): PassageDueProjection {
  return projectPassageDue(
    {
      status: row.status,
      dueAt: row.dueAt,
      addsOnDay: row.addsOnDay,
      addDayKey: row.addDayKey,
      pieces: coerceUnstartedLearningPieces(row.pieces),
    },
    now,
  );
}

function fromSkinnyDoc(row: Doc<"passageMemoryDue">): PassageDueRecord {
  return {
    passageMemoryId: row.passageMemoryId,
    packId: row.packId,
    status: row.status,
    dueAt: row.dueAt,
    learningDueAt: row.learningDueAt,
    addsOnDay: row.addsOnDay,
    addDayKey: row.addDayKey,
    hasUnreached: row.hasUnreached,
    hasIntroduced: row.hasIntroduced,
    minIntroducedDueAt: row.minIntroducedDueAt,
    solidCount: row.solidCount,
    attachedCount: row.attachedCount,
    pieceCount: row.pieceCount,
  };
}

async function loadFatPassageMemoryByUser(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">,
): Promise<Doc<"passageMemory">[]> {
  return await ctx.db
    .query("passageMemory")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .collect();
}

async function findPassageDueState(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">,
): Promise<Doc<"userPassageDueState"> | null> {
  return await ctx.db
    .query("userPassageDueState")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .unique();
}

export async function isPassageDueBackfilled(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">,
): Promise<boolean> {
  const state = await findPassageDueState(ctx, userId);
  return state?.backfilled === true;
}

/** Upsert the skinny due row for one fat `passageMemory` document. */
export async function upsertPassageMemoryDue(
  ctx: MutationCtx,
  row: Doc<"passageMemory">,
  now: number,
): Promise<void> {
  const fields = toDueFields(row, now);
  const existing = await ctx.db
    .query("passageMemoryDue")
    .withIndex("by_passageMemoryId", (q) => q.eq("passageMemoryId", row._id))
    .unique();
  const patch = {
    userId: row.userId,
    packId: row.packId,
    passageMemoryId: row._id,
    ...fields,
  };
  if (existing) {
    await ctx.db.patch(existing._id, patch);
    return;
  }
  await ctx.db.insert("passageMemoryDue", patch);
}

export async function deletePassageMemoryDue(
  ctx: MutationCtx,
  passageMemoryId: Id<"passageMemory">,
): Promise<void> {
  const existing = await ctx.db
    .query("passageMemoryDue")
    .withIndex("by_passageMemoryId", (q) =>
      q.eq("passageMemoryId", passageMemoryId),
    )
    .unique();
  if (existing) await ctx.db.delete(existing._id);
}

/**
 * Write skinny rows for every fat passage the user has, then mark backfilled.
 * Idempotent. Call from passage writes so later due queries skip fat collects.
 */
export async function ensurePassageDueBackfill(
  ctx: MutationCtx,
  userId: Id<"users">,
  now: number,
): Promise<void> {
  if (await isPassageDueBackfilled(ctx, userId)) return;

  const fat = await loadFatPassageMemoryByUser(ctx, userId);
  const seen = new Set<Id<"passageMemory">>();
  for (const row of fat) {
    await upsertPassageMemoryDue(ctx, row, now);
    seen.add(row._id);
  }

  const skinny = await ctx.db
    .query("passageMemoryDue")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .collect();
  for (const row of skinny) {
    if (!seen.has(row.passageMemoryId)) await ctx.db.delete(row._id);
  }

  const state = await findPassageDueState(ctx, userId);
  if (state) {
    await ctx.db.patch(state._id, { backfilled: true, updatedAt: now });
    return;
  }
  await ctx.db.insert("userPassageDueState", {
    userId,
    backfilled: true,
    updatedAt: now,
  });
}

/**
 * Due facts for every started passage. After backfill this is skinny rows only
 * (no `pieces`). Pre-backfill falls back to projecting fat documents in memory
 * so counts stay correct until the first passage write or migration.
 */
export async function loadPassageDueRecords(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">,
  now: number,
): Promise<PassageDueRecord[]> {
  if (await isPassageDueBackfilled(ctx, userId)) {
    const rows = await ctx.db
      .query("passageMemoryDue")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .collect();
    return rows.map(fromSkinnyDoc);
  }

  const fat = await loadFatPassageMemoryByUser(ctx, userId);
  return fat.map((row) => ({
    passageMemoryId: row._id,
    packId: row.packId,
    ...toDueFields(row, now),
  }));
}

export async function loadPassagePackIds(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">,
): Promise<Set<Id<"packs">>> {
  const rows = await loadPassageDueRecords(ctx, userId, 0);
  return new Set(rows.map((row) => row.packId));
}

export function passageDueByPackId(
  rows: readonly PassageDueRecord[],
): Map<Id<"packs">, PassageDueRecord> {
  return new Map(rows.map((row) => [row.packId, row]));
}

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

/** Convex `.unique()` throws if a race inserted two rows with the same key. */
const DUPLICATE_TAKE = 8;

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

async function loadPassageDueStateRows(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">,
): Promise<Doc<"userPassageDueState">[]> {
  return await ctx.db
    .query("userPassageDueState")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .take(DUPLICATE_TAKE);
}

async function findPassageDueState(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">,
): Promise<Doc<"userPassageDueState"> | null> {
  const rows = await loadPassageDueStateRows(ctx, userId);
  return rows[0] ?? null;
}

async function getOrCreatePassageDueState(
  ctx: MutationCtx,
  userId: Id<"users">,
  now: number,
): Promise<Doc<"userPassageDueState">> {
  const rows = await loadPassageDueStateRows(ctx, userId);
  const first = rows[0];
  if (first) {
    for (const extra of rows.slice(1)) {
      await ctx.db.delete(extra._id);
    }
    return first;
  }
  const id = await ctx.db.insert("userPassageDueState", {
    userId,
    backfilled: false,
    updatedAt: now,
  });
  const created = await ctx.db.get(id);
  if (!created) throw new Error("Failed to create passage due state");
  return created;
}

export async function isPassageDueBackfilled(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">,
): Promise<boolean> {
  const state = await findPassageDueState(ctx, userId);
  return state?.backfilled === true;
}

async function loadSkinnyRowsForPassage(
  ctx: QueryCtx | MutationCtx,
  passageMemoryId: Id<"passageMemory">,
): Promise<Doc<"passageMemoryDue">[]> {
  return await ctx.db
    .query("passageMemoryDue")
    .withIndex("by_passageMemoryId", (q) =>
      q.eq("passageMemoryId", passageMemoryId),
    )
    .take(DUPLICATE_TAKE);
}

/** Upsert the skinny due row for one fat `passageMemory` document. */
export async function upsertPassageMemoryDue(
  ctx: MutationCtx,
  row: Doc<"passageMemory">,
  now: number,
): Promise<void> {
  const fields = toDueFields(row, now);
  const existingRows = await loadSkinnyRowsForPassage(ctx, row._id);
  const patch = {
    userId: row.userId,
    packId: row.packId,
    passageMemoryId: row._id,
    ...fields,
  };
  const existing = existingRows[0];
  if (existing) {
    await ctx.db.patch(existing._id, patch);
    for (const extra of existingRows.slice(1)) {
      await ctx.db.delete(extra._id);
    }
    return;
  }
  await ctx.db.insert("passageMemoryDue", patch);
}

export async function deletePassageMemoryDue(
  ctx: MutationCtx,
  passageMemoryId: Id<"passageMemory">,
): Promise<void> {
  const existingRows = await loadSkinnyRowsForPassage(ctx, passageMemoryId);
  for (const existing of existingRows) {
    await ctx.db.delete(existing._id);
  }
}

/**
 * Write skinny rows for every fat passage the user has, then mark backfilled.
 * Idempotent. Call from Memory home / the dashboard migration — not from
 * `recordAttempt` / `patchPassageMemory`, which would make Saving wait on
 * every fat `pieces` array.
 */
export async function ensurePassageDueBackfill(
  ctx: MutationCtx,
  userId: Id<"users">,
  now: number,
): Promise<void> {
  const state = await getOrCreatePassageDueState(ctx, userId, now);
  if (state.backfilled) return;

  // Touch the state row first so a concurrent ensure / first write OCC-retries
  // instead of inserting a second state document.
  await ctx.db.patch(state._id, { updatedAt: now });

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

  await ctx.db.patch(state._id, { backfilled: true, updatedAt: now });
}

function uniqueByPassageMemoryId(
  rows: readonly PassageDueRecord[],
): PassageDueRecord[] {
  const byId = new Map<Id<"passageMemory">, PassageDueRecord>();
  for (const row of rows) {
    byId.set(row.passageMemoryId, row);
  }
  return [...byId.values()];
}

/**
 * Due facts for every started passage. After backfill this is skinny rows only
 * (no `pieces`). Pre-backfill falls back to projecting fat documents in memory
 * so counts stay correct until Memory home or the optional migration runs.
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
    return uniqueByPassageMemoryId(rows.map(fromSkinnyDoc));
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

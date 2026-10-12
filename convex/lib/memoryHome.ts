import type { QueryCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { loadInMemoryVerseMemoryByRef } from "./verseMemory";
import {
  dueUnifiedPackDueAt,
  loadPassageMemoryByUser,
  loadUnifiedReviewPacks,
  unifiedReviewPhaseVerseRefIds,
} from "./packs";
import { loadPackUpNext } from "./packUpNext";
import {
  localDayStart,
  type GoalPassageInput,
  type GoalVerseInput,
} from "../../src/lib/memory-goals";
import { buildTodayModel, type TodayModel } from "../../src/lib/memory-today";

export type TodayModelValue = TodayModel<Id<"packs">, Id<"verseRefs">>;

/** Bound on each of today's log reads; a pack recitation logs one row per verse. */
const MAX_TODAY_LOGS = 2000;

/** Every in-Memory verse joined to its reference. */
async function loadGoalVerses(
  ctx: QueryCtx,
  userId: Id<"users">,
): Promise<GoalVerseInput<Id<"verseRefs">>[]> {
  const memoryByRef = await loadInMemoryVerseMemoryByRef(ctx, userId);
  const verses = await Promise.all(
    [...memoryByRef.values()].map(
      async (memory): Promise<GoalVerseInput<Id<"verseRefs">> | null> => {
        const ref = await ctx.db.get(memory.verseRefId);
        if (!ref || ref.userId !== userId) return null;
        return {
          verseRefId: memory.verseRefId,
          book: ref.book,
          chapter: ref.chapter,
          startVerse: ref.startVerse,
          endVerse: ref.endVerse,
          status: memory.status,
          learnStage: memory.learnStage,
          intervalDays: memory.intervalDays,
          dueAt: memory.dueAt,
          lastReviewedAt: memory.lastReviewedAt,
          createdAt: memory.createdAt,
        };
      },
    ),
  );
  return verses.filter(
    (verse): verse is GoalVerseInput<Id<"verseRefs">> => verse !== null,
  );
}

function verseRefIdsByPack(
  rows: readonly Doc<"packVerses">[],
): Map<Id<"packs">, Id<"verseRefs">[]> {
  const byPack = new Map<Id<"packs">, Id<"verseRefs">[]>();
  for (const row of [...rows].sort((a, b) => a.order - b.order)) {
    const ids = byPack.get(row.packId) ?? [];
    ids.push(row.verseRefId);
    byPack.set(row.packId, ids);
  }
  return byPack;
}

/**
 * Everything Today shows, for one user. Reads go through indexes only; the
 * derivation is `buildTodayModel`. Up next and packs reviewed together reuse
 * the same helpers as `learnQueue` and `memoryStats`, so counts agree.
 */
export async function loadTodayModel(
  ctx: QueryCtx,
  userId: Id<"users">,
  args: { now: number; tzOffsetMinutes: number },
): Promise<TodayModelValue> {
  const { now } = args;
  const tzOffsetMinutes = Number.isFinite(args.tzOffsetMinutes)
    ? args.tzOffsetMinutes
    : 0;
  const dayStart = localDayStart(now, tzOffsetMinutes);

  const [
    verses,
    packs,
    passageRows,
    packVerses,
    verseLogs,
    passageLogs,
    upNext,
  ] = await Promise.all([
    loadGoalVerses(ctx, userId),
    ctx.db
      .query("packs")
      .withIndex("by_userId_lastOpenedAt", (q) => q.eq("userId", userId))
      .collect(),
    loadPassageMemoryByUser(ctx, userId),
    ctx.db
      .query("packVerses")
      .withIndex("by_userId_verseRefId", (q) => q.eq("userId", userId))
      .collect(),
    ctx.db
      .query("verseMemoryReviews")
      .withIndex("by_userId_createdAt", (q) =>
        q.eq("userId", userId).gte("createdAt", dayStart),
      )
      .take(MAX_TODAY_LOGS),
    ctx.db
      .query("passageReviews")
      .withIndex("by_userId_createdAt", (q) =>
        q.eq("userId", userId).gte("createdAt", dayStart),
      )
      .take(MAX_TODAY_LOGS),
    loadPackUpNext(ctx, userId),
  ]);

  const packById = new Map(packs.map((pack) => [pack._id, pack]));
  const passages = passageRows.flatMap(
    (row): GoalPassageInput<Id<"packs">>[] => {
      const pack = packById.get(row.packId);
      if (!pack) return [];
      return [
        {
          packId: row.packId,
          title: pack.name,
          status: row.status,
          pieces: row.pieces,
          addsOnDay: row.addsOnDay,
          addDayKey: row.addDayKey,
          intervalDays: row.intervalDays,
          dueAt: row.dueAt,
          lastSessionAt: row.lastSessionAt,
          createdAt: row.createdAt,
        },
      ];
    },
  );

  const unifiedPacks = await loadUnifiedReviewPacks(
    ctx,
    userId,
    new Set(passageRows.map((row) => row.packId)),
  );
  const packVerseIds = verseRefIdsByPack(packVerses);

  return buildTodayModel({
    now,
    tzOffsetMinutes,
    verses,
    packs: packs.map((pack) => ({
      packId: pack._id,
      name: pack.name,
      kind: pack.kind,
      scope: pack.scope,
      verseRefIds: packVerseIds.get(pack._id) ?? [],
      createdAt: pack.createdAt,
    })),
    passages,
    upNextByPackId: upNext.byPackId,
    upNextVerseRefIds: upNext.members.map((member) => member.verseRefId),
    reviewTogether: new Map(
      unifiedPacks.map(({ pack, members }) => [
        pack._id,
        dueUnifiedPackDueAt(members, now),
      ]),
    ),
    reviewTogetherVerseRefIds: unifiedReviewPhaseVerseRefIds(unifiedPacks),
    verseLogs: verseLogs.map((log) => ({
      verseRefId: log.verseRefId,
      mode: log.mode,
      createdAt: log.createdAt,
    })),
    passageLogs: passageLogs.map((log) => ({
      passageMemoryId: log.passageMemoryId,
      kind: log.kind,
      pieceIndex: log.pieceIndex,
      createdAt: log.createdAt,
    })),
  });
}

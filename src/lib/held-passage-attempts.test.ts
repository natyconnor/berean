import { describe, expect, it } from "vitest";

import type { Doc, Id } from "../../convex/_generated/dataModel";
import type { MutationCtx } from "../../convex/_generated/server";
import {
  applyHeldPassageById,
  applyLeftoverHeldPassagesForUser,
  commitPassageReview,
  deleteHeldPassageIfOwned,
  holdPassageMiss,
} from "../../convex/lib/heldPassageAttempts";
import { toPassageSchedule } from "../../convex/lib/passageMemory";
import { HELD_ATTEMPT_BACKSTOP_MS } from "./held-verse-attempt";
import { DAY_MS, keepReviewingSchedule } from "./memory-scheduler";

/** Just enough of Convex's `ctx` for these helpers: equality/range filters. */
function fakeCtx() {
  type Row = Record<string, unknown> & { _id: string };
  const tables = new Map<string, Map<string, Row>>();
  const scheduled: unknown[][] = [];
  let nextId = 0;
  const table = (name: string): Map<string, Row> => {
    let rows = tables.get(name);
    if (!rows) {
      rows = new Map<string, Row>();
      tables.set(name, rows);
    }
    return rows;
  };
  const tableOf = (id: string) => id.split(":")[0] ?? "";
  const db = {
    get: (id: string) => Promise.resolve(table(tableOf(id)).get(id) ?? null),
    insert: (name: string, doc: Record<string, unknown>) => {
      const _id = `${name}:${nextId++}`;
      table(name).set(_id, { ...doc, _id, _creationTime: nextId });
      return Promise.resolve(_id);
    },
    patch: (id: string, patch: Record<string, unknown>) => {
      const row = table(tableOf(id)).get(id);
      if (!row) return Promise.reject(new Error(`missing ${id}`));
      for (const [key, value] of Object.entries(patch)) {
        if (value === undefined) delete row[key];
        else row[key] = value;
      }
      return Promise.resolve();
    },
    delete: (id: string) => {
      table(tableOf(id)).delete(id);
      return Promise.resolve();
    },
    query: (name: string) => {
      const tests: Array<(row: Row) => boolean> = [];
      const range = {
        eq: (field: string, value: unknown) => {
          tests.push((row) => row[field] === value);
          return range;
        },
        gte: (field: string, value: number) => {
          tests.push((row) => (row[field] as number) >= value);
          return range;
        },
      };
      const rows = () =>
        [...table(name).values()].filter((row) => tests.every((t) => t(row)));
      const chain = {
        withIndex: (_index: string, build?: (q: typeof range) => unknown) => {
          build?.(range);
          return chain;
        },
        first: () => Promise.resolve(rows()[0] ?? null),
        take: (count: number) => Promise.resolve(rows().slice(0, count)),
        collect: () => Promise.resolve(rows()),
      };
      return chain;
    },
  };
  const scheduler = {
    runAfter: (...args: unknown[]) => {
      scheduled.push(args);
      return Promise.resolve();
    },
  };
  return {
    ctx: { db, scheduler } as unknown as MutationCtx,
    rows: (name: string) => [...table(name).values()],
    scheduled,
  };
}

const NOW = 1_700_000_000_000;
const USER = "users:u" as Id<"users">;
const PACK = "packs:p" as Id<"packs">;
const BACKSTOP = "backstop" as unknown as Parameters<typeof holdPassageMiss>[3];

async function seedDuePassage(
  ctx: MutationCtx,
  schedule: Partial<Doc<"passageMemory">> = {},
) {
  const id = await ctx.db.insert("passageMemory", {
    userId: USER,
    packId: PACK,
    status: "reviewing",
    // Psalm 13:1, then 13:2–3 as one multi-verse learning piece.
    pieces: [
      [1, 1],
      [2, 3],
    ].map(([startVerse, endVerse], index) => ({
      index,
      book: "Psalms",
      chapter: 13,
      startVerse: startVerse,
      endVerse: endVerse,
      sectionIndex: 0,
      attachment: "solid",
      learnStage: 3,
      stageReps: 0,
    })),
    addsOnDay: 0,
    ease: 2.3,
    intervalDays: 2,
    dueAt: NOW - 1,
    consecutiveCorrect: 4,
    lapses: 0,
    stageReps: 0,
    createdAt: NOW - 30 * DAY_MS,
    updatedAt: NOW - DAY_MS,
    ...schedule,
  });
  return (await ctx.db.get(id)) as Doc<"passageMemory">;
}

const V2 = { chapter: 13, verse: 2 };

/** Verse 2 omitted, verses 1 and 3 exact: 65% overall, a close miss. */
const MISS = {
  quality: "close" as const,
  accuracy: 65,
  verseScores: [
    { chapter: 13, verse: 1, accuracy: 100 },
    { ...V2, accuracy: 0 },
    { chapter: 13, verse: 3, accuracy: 100 },
  ],
  attemptedAt: NOW,
  tzOffsetMinutes: 0,
};

describe("held passage misses (server)", () => {
  it("holds a due miss without counting it and schedules the 24h backstop", async () => {
    const { ctx, rows, scheduled } = fakeCtx();
    const row = await seedDuePassage(ctx);
    const heldId = await holdPassageMiss(ctx, row, MISS, BACKSTOP);

    expect(rows("passageReviews")).toHaveLength(0);
    expect(rows("passageMemory")[0]).toMatchObject({ dueAt: NOW - 1 });
    expect(scheduled).toEqual([
      [HELD_ATTEMPT_BACKSTOP_MS, BACKSTOP, { heldId }],
    ]);
  });

  it("refuses to hold a pass or a not-due passage", async () => {
    const { ctx } = fakeCtx();
    const row = await seedDuePassage(ctx);
    await expect(
      holdPassageMiss(ctx, row, { ...MISS, accuracy: 85 }, BACKSTOP),
    ).rejects.toThrow();
    await expect(
      holdPassageMiss(ctx, { ...row, dueAt: NOW + DAY_MS }, MISS, BACKSTOP),
    ).rejects.toThrow();
  });

  it("survives a reload: the next load counts it once, and nothing after does", async () => {
    const { ctx, rows } = fakeCtx();
    const heldId = await holdPassageMiss(
      ctx,
      await seedDuePassage(ctx),
      MISS,
      BACKSTOP,
    );

    // The tab closed before Continue: the next load applies leftovers.
    await applyLeftoverHeldPassagesForUser(ctx, USER);
    await applyLeftoverHeldPassagesForUser(ctx, USER);
    await applyHeldPassageById(ctx, heldId, USER);
    await applyHeldPassageById(ctx, heldId);

    expect(rows("heldPassageAttempts")).toHaveLength(0);
    expect(rows("passageReviews")).toEqual([
      expect.objectContaining({ kind: "review", accuracy: 65, createdAt: NOW }),
    ]);
    const [passage] = rows("passageMemory");
    // Every-other-day with four banked loses one: daily gap, three banked.
    expect(passage).toMatchObject({ intervalDays: 1, stageReps: 3 });
    // The held try's verse targets survive: only verse 2, not its piece-mate.
    expect(passage?.shakyVerses).toEqual([V2]);
  });

  it("follows an overall pass but marks the sub-85 verse inside it", async () => {
    const { ctx, rows } = fakeCtx();
    const row = await seedDuePassage(ctx);
    await commitPassageReview(ctx, row, {
      quality: "close",
      accuracy: 90,
      now: NOW,
      tzOffsetMinutes: 0,
      verseScores: [
        { chapter: 13, verse: 1, accuracy: 100 },
        { ...V2, accuracy: 70 },
        { chapter: 13, verse: 3, accuracy: 100 },
      ],
    });
    // An 85–99% pass on every-other-day banks a rep and keeps the gap.
    expect(rows("passageMemory")[0]).toMatchObject({
      intervalDays: 2,
      stageReps: 1,
      shakyVerses: [V2],
    });
  });

  it("counts once when the 24h backstop fires after nobody came back", async () => {
    const { ctx, rows } = fakeCtx();
    const heldId = await holdPassageMiss(
      ctx,
      await seedDuePassage(ctx),
      MISS,
      BACKSTOP,
    );
    await applyHeldPassageById(ctx, heldId);
    await applyLeftoverHeldPassagesForUser(ctx, USER);
    expect(rows("passageReviews")).toHaveLength(1);
  });

  it("drops the held miss once a finished From memory try replaces it", async () => {
    const { ctx, rows } = fakeCtx();
    const row = await seedDuePassage(ctx);
    const heldId = await holdPassageMiss(ctx, row, MISS, BACKSTOP);

    const held = await deleteHeldPassageIfOwned(ctx, USER, heldId);
    await commitPassageReview(ctx, row, {
      quality: "exact",
      accuracy: 100,
      now: NOW + 60_000,
      tzOffsetMinutes: 0,
      verseScores: MISS.verseScores.map((score) => ({
        ...score,
        accuracy: 100,
      })),
      refresherUsed: true,
      heldMissAccuracy: held?.accuracy,
    });
    await applyHeldPassageById(ctx, heldId);
    await applyLeftoverHeldPassagesForUser(ctx, USER);

    expect(rows("passageReviews")).toEqual([
      expect.objectContaining({ accuracy: 100 }),
    ]);
    // A refresher pass after a close miss keeps the gap; the clean From
    // memory try leaves nothing shaky.
    expect(rows("passageMemory")[0]).toMatchObject({
      intervalDays: 2,
      stageReps: 0,
      shakyVerses: [],
    });
  });

  it("keeps the Psalm 23 sample's 1-day gap after a close miss and a refresher pass", async () => {
    const { ctx, rows } = fakeCtx();
    // The preview sample's schedule: daily gap, nothing banked yet.
    const sample = { intervalDays: 1, stageReps: 0, consecutiveCorrect: 2 };
    const row = await seedDuePassage(ctx, sample);
    const heldId = await holdPassageMiss(
      ctx,
      row,
      { ...MISS, accuracy: 68 },
      BACKSTOP,
    );

    const held = await deleteHeldPassageIfOwned(ctx, USER, heldId);
    await commitPassageReview(ctx, row, {
      quality: "exact",
      accuracy: 100,
      now: NOW + 60_000,
      tzOffsetMinutes: 0,
      refresherUsed: true,
      heldMissAccuracy: held?.accuracy,
    });

    // Counted as today's review, and nothing lost: same gap, reps and ease,
    // due again after that gap (tomorrow).
    expect(rows("passageReviews")).toHaveLength(1);
    expect(rows("passageMemory")[0]).toMatchObject({
      ...sample,
      ease: 2.3,
      dueAt: keepReviewingSchedule(toPassageSchedule(row), {
        now: NOW + 60_000,
        tzOffsetMinutes: 0,
      }).dueAt,
    });
  });

  it("drops a held miss whose passage was reviewed since", async () => {
    const { ctx, rows } = fakeCtx();
    const row = await seedDuePassage(ctx);
    await holdPassageMiss(ctx, row, MISS, BACKSTOP);
    await ctx.db.patch(row._id, { dueAt: NOW + DAY_MS });

    await applyLeftoverHeldPassagesForUser(ctx, USER);
    expect(rows("passageReviews")).toHaveLength(0);
    expect(rows("heldPassageAttempts")).toHaveLength(0);
  });

  it("ignores another user's held id", async () => {
    const { ctx, rows } = fakeCtx();
    const heldId = await holdPassageMiss(
      ctx,
      await seedDuePassage(ctx),
      MISS,
      BACKSTOP,
    );
    await applyHeldPassageById(ctx, heldId, "users:other" as Id<"users">);
    expect(rows("heldPassageAttempts")).toHaveLength(1);
    expect(rows("passageReviews")).toHaveLength(0);
  });
});

describe("••• Refresh From memory on a due passage (S13, R30)", () => {
  /** The daily gap's due day, as the scheduler aligns it. */
  const tomorrow = (row: Doc<"passageMemory">) =>
    keepReviewingSchedule(
      { ...toPassageSchedule(row), intervalDays: 1 },
      { now: NOW, tzOffsetMinutes: 0 },
    ).dueAt;
  const scored = (accuracy: number) => ({
    quality:
      accuracy === 100
        ? ("exact" as const)
        : accuracy >= 60
          ? ("close" as const)
          : ("off" as const),
    accuracy,
    now: NOW,
    tzOffsetMinutes: 0,
    // Verse 2 carries the miss; the menu round has no held first try.
    verseScores: [
      { chapter: 13, verse: 1, accuracy: 100 },
      { ...V2, accuracy },
      { chapter: 13, verse: 3, accuracy: 100 },
    ],
    refresherUsed: true,
  });

  it.each([85, 100])(
    "keeps the gap on a %i%% pass, counted once",
    async (accuracy) => {
      const { ctx, rows } = fakeCtx();
      const row = await seedDuePassage(ctx);
      await commitPassageReview(ctx, row, scored(accuracy));

      expect(rows("passageReviews")).toEqual([
        expect.objectContaining({ kind: "review", accuracy }),
      ]);
      const kept = keepReviewingSchedule(toPassageSchedule(row), {
        now: NOW,
        tzOffsetMinutes: 0,
      });
      expect(rows("passageMemory")[0]).toMatchObject({
        status: "reviewing",
        intervalDays: kept.intervalDays,
        stageReps: kept.stageReps,
        dueAt: kept.dueAt,
        shakyVerses: [],
      });
    },
  );

  it.each([
    // Every-other-day with four banked: a close miss loses one, a bad miss
    // three, with no softening for the pre-try round.
    [84, 3],
    [60, 3],
    [59, 1],
  ])("follows R49 once on a %i%% miss", async (accuracy, stageReps) => {
    const { ctx, rows } = fakeCtx();
    const row = await seedDuePassage(ctx);
    await commitPassageReview(ctx, row, scored(accuracy));

    expect(rows("passageReviews")).toHaveLength(1);
    expect(rows("passageMemory")[0]).toMatchObject({
      status: "reviewing",
      intervalDays: 1,
      stageReps,
      dueAt: tomorrow(row),
      shakyVerses: [V2],
    });
  });

  it("floors a 0% miss at the start of Memorized", async () => {
    const { ctx, rows } = fakeCtx();
    const row = await seedDuePassage(ctx, {
      intervalDays: 1,
      stageReps: 0,
      consecutiveCorrect: 0,
    });
    await commitPassageReview(ctx, row, scored(0));

    expect(rows("passageMemory")[0]).toMatchObject({
      status: "reviewing",
      intervalDays: 1,
      stageReps: 0,
      dueAt: tomorrow(row),
    });
  });
});

import { internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { v, type Infer } from "convex/values";
import { findVerseMemory, seedVerseMemory } from "./lib/verseMemory";
import { ensurePassageDueBackfill } from "./lib/passageDue";
import {
  backfillInMemoryForUser,
  checkInMemoryInvariantForUser,
  hasInMemoryBackfill,
  type InMemoryInvariantReport,
} from "./lib/inMemoryBackfill";

const DEFAULT_BACKFILL_BATCH_SIZE = 200;
const IN_MEMORY_BACKFILL_BATCH_SIZE = 25;
const IN_MEMORY_CHECK_BATCH_SIZE = 25;
const MAX_IN_MEMORY_CHECK_SAMPLES = 20;

/**
 * Backfill one `verseMemory` row for every existing `savedVerses` row that
 * lacks one, processed in bounded batches.
 *
 * Safe on large datasets: each invocation paginates a single batch of
 * `savedVerses`, seeds any missing memory rows, then self-schedules the next
 * batch (`ctx.scheduler.runAfter(0, ...)`) until the table is exhausted.
 *
 * Idempotent and safe to run twice: rows that already have a matching
 * `verseMemory` (by `by_userId_verseRefId`) are skipped. Runs globally across
 * all users, so it is an `internalMutation` (no auth context) — kick it off
 * from the Convex dashboard or `convex run` with no args.
 */
export const backfillVerseMemory = internalMutation({
  args: {
    cursor: v.optional(v.union(v.string(), v.null())),
    batchSize: v.optional(v.number()),
    // Running totals threaded through the self-scheduled chain so the final
    // batch's return value reflects the whole run.
    scannedSoFar: v.optional(v.number()),
    createdSoFar: v.optional(v.number()),
    skippedSoFar: v.optional(v.number()),
  },
  returns: v.object({
    batchScanned: v.number(),
    batchCreated: v.number(),
    batchSkipped: v.number(),
    totalScanned: v.number(),
    totalCreated: v.number(),
    totalSkipped: v.number(),
    isDone: v.boolean(),
    continueCursor: v.union(v.string(), v.null()),
  }),
  handler: async (ctx, args) => {
    const now = Date.now();
    const batchSize = args.batchSize ?? DEFAULT_BACKFILL_BATCH_SIZE;

    const { page, isDone, continueCursor } = await ctx.db
      .query("savedVerses")
      .paginate({ cursor: args.cursor ?? null, numItems: batchSize });

    let created = 0;
    let skipped = 0;

    for (const row of page) {
      const existing = await findVerseMemory(ctx, row.userId, row.verseRefId);
      if (existing) {
        skipped += 1;
        continue;
      }
      await seedVerseMemory(ctx, row.userId, row.verseRefId, now);
      created += 1;
    }

    const totalScanned = (args.scannedSoFar ?? 0) + page.length;
    const totalCreated = (args.createdSoFar ?? 0) + created;
    const totalSkipped = (args.skippedSoFar ?? 0) + skipped;

    if (!isDone) {
      await ctx.scheduler.runAfter(0, internal.migrations.backfillVerseMemory, {
        cursor: continueCursor,
        batchSize: args.batchSize,
        scannedSoFar: totalScanned,
        createdSoFar: totalCreated,
        skippedSoFar: totalSkipped,
      });
    }

    return {
      batchScanned: page.length,
      batchCreated: created,
      batchSkipped: skipped,
      totalScanned,
      totalCreated,
      totalSkipped,
      isDone,
      continueCursor: isDone ? null : continueCursor,
    };
  },
});

/**
 * Backfill the denormalized `verseMemory.isHearted` flag from the canonical
 * `savedVerses` table in bounded batches.
 */
export const backfillVerseMemoryIsHearted = internalMutation({
  args: {
    cursor: v.optional(v.union(v.string(), v.null())),
    batchSize: v.optional(v.number()),
    scannedSoFar: v.optional(v.number()),
    patchedSoFar: v.optional(v.number()),
    unchangedSoFar: v.optional(v.number()),
  },
  returns: v.object({
    batchScanned: v.number(),
    batchPatched: v.number(),
    batchUnchanged: v.number(),
    totalScanned: v.number(),
    totalPatched: v.number(),
    totalUnchanged: v.number(),
    isDone: v.boolean(),
    continueCursor: v.union(v.string(), v.null()),
  }),
  handler: async (ctx, args) => {
    const batchSize = args.batchSize ?? DEFAULT_BACKFILL_BATCH_SIZE;

    const { page, isDone, continueCursor } = await ctx.db
      .query("verseMemory")
      .paginate({ cursor: args.cursor ?? null, numItems: batchSize });

    let patched = 0;
    let unchanged = 0;

    for (const row of page) {
      const saved = await ctx.db
        .query("savedVerses")
        .withIndex("by_userId_verseRefId", (q) =>
          q.eq("userId", row.userId).eq("verseRefId", row.verseRefId),
        )
        .unique();
      const isHearted = saved !== null;
      if (row.isHearted === isHearted) {
        unchanged += 1;
        continue;
      }
      await ctx.db.patch(row._id, { isHearted });
      patched += 1;
    }

    const totalScanned = (args.scannedSoFar ?? 0) + page.length;
    const totalPatched = (args.patchedSoFar ?? 0) + patched;
    const totalUnchanged = (args.unchangedSoFar ?? 0) + unchanged;

    if (!isDone) {
      await ctx.scheduler.runAfter(
        0,
        internal.migrations.backfillVerseMemoryIsHearted,
        {
          cursor: continueCursor,
          batchSize: args.batchSize,
          scannedSoFar: totalScanned,
          patchedSoFar: totalPatched,
          unchangedSoFar: totalUnchanged,
        },
      );
    }

    return {
      batchScanned: page.length,
      batchPatched: patched,
      batchUnchanged: unchanged,
      totalScanned,
      totalPatched,
      totalUnchanged,
      isDone,
      continueCursor: isDone ? null : continueCursor,
    };
  },
});

/**
 * Delete custom-pack membership rows whose verse is no longer hearted.
 * Safe to re-run; processes packVerses in bounded batches.
 */
export const cleanupUnheartedPackVerses = internalMutation({
  args: {
    cursor: v.optional(v.union(v.string(), v.null())),
    batchSize: v.optional(v.number()),
    scannedSoFar: v.optional(v.number()),
    deletedSoFar: v.optional(v.number()),
  },
  returns: v.object({
    batchScanned: v.number(),
    batchDeleted: v.number(),
    totalScanned: v.number(),
    totalDeleted: v.number(),
    isDone: v.boolean(),
    continueCursor: v.union(v.string(), v.null()),
  }),
  handler: async (ctx, args) => {
    const batchSize = args.batchSize ?? DEFAULT_BACKFILL_BATCH_SIZE;

    const { page, isDone, continueCursor } = await ctx.db
      .query("packVerses")
      .paginate({ cursor: args.cursor ?? null, numItems: batchSize });

    let deleted = 0;
    for (const row of page) {
      const saved = await ctx.db
        .query("savedVerses")
        .withIndex("by_userId_verseRefId", (q) =>
          q.eq("userId", row.userId).eq("verseRefId", row.verseRefId),
        )
        .unique();
      if (saved) continue;
      await ctx.db.delete(row._id);
      deleted += 1;
    }

    const totalScanned = (args.scannedSoFar ?? 0) + page.length;
    const totalDeleted = (args.deletedSoFar ?? 0) + deleted;

    if (!isDone) {
      await ctx.scheduler.runAfter(
        0,
        internal.migrations.cleanupUnheartedPackVerses,
        {
          cursor: continueCursor,
          batchSize: args.batchSize,
          scannedSoFar: totalScanned,
          deletedSoFar: totalDeleted,
        },
      );
    }

    return {
      batchScanned: page.length,
      batchDeleted: deleted,
      totalScanned,
      totalDeleted,
      isDone,
      continueCursor: isDone ? null : continueCursor,
    };
  },
});

/**
 * Rebuild denormalized `userMemoryStats` from hearted `verseMemory` rows.
 */
export const backfillUserMemoryStats = internalMutation({
  args: {
    cursor: v.optional(v.union(v.string(), v.null())),
    batchSize: v.optional(v.number()),
    scannedSoFar: v.optional(v.number()),
  },
  returns: v.object({
    batchScanned: v.number(),
    totalScanned: v.number(),
    isDone: v.boolean(),
    continueCursor: v.union(v.string(), v.null()),
  }),
  handler: async (ctx, args) => {
    const now = Date.now();
    const batchSize = args.batchSize ?? DEFAULT_BACKFILL_BATCH_SIZE;

    const { page, isDone, continueCursor } = await ctx.db
      .query("users")
      .paginate({ cursor: args.cursor ?? null, numItems: batchSize });

    for (const user of page) {
      const existing = await ctx.db
        .query("userMemoryStats")
        .withIndex("by_userId", (q) => q.eq("userId", user._id))
        .unique();
      if (existing) {
        await ctx.db.delete(existing._id);
      }

      const hearted = await ctx.db
        .query("verseMemory")
        .withIndex("by_userId_isHearted", (q) =>
          q.eq("userId", user._id).eq("isHearted", true),
        )
        .collect();

      const counts = {
        new: 0,
        learning: 0,
        reviewing: 0,
        mastered: 0,
        total: 0,
      };
      for (const row of hearted) {
        counts[row.status] += 1;
        counts.total += 1;
      }

      await ctx.db.insert("userMemoryStats", {
        userId: user._id,
        ...counts,
        updatedAt: now,
      });
    }

    const totalScanned = (args.scannedSoFar ?? 0) + page.length;

    if (!isDone) {
      await ctx.scheduler.runAfter(
        0,
        internal.migrations.backfillUserMemoryStats,
        {
          cursor: continueCursor,
          batchSize: args.batchSize,
          scannedSoFar: totalScanned,
        },
      );
    }

    return {
      batchScanned: page.length,
      totalScanned,
      isDone,
      continueCursor: isDone ? null : continueCursor,
    };
  },
});

/**
 * Write skinny `passageMemoryDue` rows for every `passageMemory` document so
 * due/forecast/list queries stop collecting fat `pieces` arrays.
 */
export const backfillPassageMemoryDue = internalMutation({
  args: {
    cursor: v.optional(v.union(v.string(), v.null())),
    batchSize: v.optional(v.number()),
    scannedSoFar: v.optional(v.number()),
  },
  returns: v.object({
    batchScanned: v.number(),
    totalScanned: v.number(),
    isDone: v.boolean(),
    continueCursor: v.union(v.string(), v.null()),
  }),
  handler: async (ctx, args) => {
    const now = Date.now();
    const batchSize = args.batchSize ?? DEFAULT_BACKFILL_BATCH_SIZE;

    const { page, isDone, continueCursor } = await ctx.db
      .query("users")
      .paginate({ cursor: args.cursor ?? null, numItems: batchSize });

    for (const user of page) {
      await ensurePassageDueBackfill(ctx, user._id, now);
    }

    const totalScanned = (args.scannedSoFar ?? 0) + page.length;

    if (!isDone) {
      await ctx.scheduler.runAfter(
        0,
        internal.migrations.backfillPassageMemoryDue,
        {
          cursor: continueCursor,
          batchSize: args.batchSize,
          scannedSoFar: totalScanned,
        },
      );
    }

    return {
      batchScanned: page.length,
      totalScanned,
      isDone,
      continueCursor: isDone ? null : continueCursor,
    };
  },
});

const inMemoryTotalsValidator = v.object({
  usersBackfilled: v.number(),
  usersSkipped: v.number(),
  rows: v.number(),
  inMemory: v.number(),
  heartedOnly: v.number(),
  changed: v.number(),
  passageHeartsCreated: v.number(),
  passageHeartsLinked: v.number(),
});

type InMemoryTotals = Infer<typeof inMemoryTotalsValidator>;

const EMPTY_IN_MEMORY_TOTALS: InMemoryTotals = {
  usersBackfilled: 0,
  usersSkipped: 0,
  rows: 0,
  inMemory: 0,
  heartedOnly: 0,
  changed: 0,
  passageHeartsCreated: 0,
  passageHeartsLinked: 0,
};

function addInMemoryTotals(
  a: InMemoryTotals,
  b: InMemoryTotals,
): InMemoryTotals {
  const sum = { ...a };
  for (const key of Object.keys(sum) as (keyof InMemoryTotals)[]) {
    sum[key] += b[key];
  }
  return sum;
}

/**
 * Derive `verseMemory.inMemory`, create passage hearts, and rebuild
 * `userMemoryStats` from the in-Memory set for every user, in batches of
 * users that self-schedule until the table is exhausted. Logs counts per
 * batch and for the whole run.
 *
 * Users already stamped with `inMemoryBackfilledAt` are skipped, so it is
 * safe to run twice. Run it once Memory reads `inMemory`: before that,
 * hearting still enrolls verses, and stamped users would not be re-derived.
 * `force` re-derives stamped users too, which undoes any stop or passage
 * absorb made since their last backfill.
 */
export const backfillInMemory = internalMutation({
  args: {
    cursor: v.optional(v.union(v.string(), v.null())),
    batchSize: v.optional(v.number()),
    force: v.optional(v.boolean()),
    totals: v.optional(inMemoryTotalsValidator),
  },
  returns: v.object({
    batch: inMemoryTotalsValidator,
    totals: inMemoryTotalsValidator,
    isDone: v.boolean(),
    continueCursor: v.union(v.string(), v.null()),
  }),
  handler: async (ctx, args) => {
    const now = Date.now();
    const batchSize = args.batchSize ?? IN_MEMORY_BACKFILL_BATCH_SIZE;

    const { page, isDone, continueCursor } = await ctx.db
      .query("users")
      .paginate({ cursor: args.cursor ?? null, numItems: batchSize });

    let batch = EMPTY_IN_MEMORY_TOTALS;
    for (const user of page) {
      if (!args.force && (await hasInMemoryBackfill(ctx, user._id))) {
        batch = { ...batch, usersSkipped: batch.usersSkipped + 1 };
        continue;
      }
      const counts = await backfillInMemoryForUser(ctx, user._id, now);
      batch = addInMemoryTotals(batch, {
        usersBackfilled: 1,
        usersSkipped: 0,
        ...counts,
      });
    }

    const totals = addInMemoryTotals(
      args.totals ?? EMPTY_IN_MEMORY_TOTALS,
      batch,
    );
    console.log("backfillInMemory batch", batch);

    if (isDone) {
      console.log("backfillInMemory done", totals);
    } else {
      await ctx.scheduler.runAfter(0, internal.migrations.backfillInMemory, {
        cursor: continueCursor,
        batchSize: args.batchSize,
        force: args.force,
        totals,
      });
    }

    return {
      batch,
      totals,
      isDone,
      continueCursor: isDone ? null : continueCursor,
    };
  },
});

/**
 * Count in-Memory verses that no heart contains and active passages missing a
 * passage heart. Pass `userId` to check one user; otherwise page through users
 * with `cursor` until `isDone`. Every count but the scanned totals should be 0.
 */
export const checkInMemoryInvariant = internalQuery({
  args: {
    userId: v.optional(v.id("users")),
    cursor: v.optional(v.union(v.string(), v.null())),
    batchSize: v.optional(v.number()),
  },
  returns: v.object({
    usersScanned: v.number(),
    inMemoryRows: v.number(),
    inMemoryWithoutHeart: v.number(),
    activePassages: v.number(),
    passagesWithoutHeart: v.number(),
    uncoveredVerseMemoryIds: v.array(v.id("verseMemory")),
    passageMemoryIdsWithoutHeart: v.array(v.id("passageMemory")),
    isDone: v.boolean(),
    continueCursor: v.union(v.string(), v.null()),
  }),
  handler: async (ctx, args) => {
    let userIds: Id<"users">[];
    let isDone = true;
    let continueCursor: string | null = null;

    if (args.userId) {
      userIds = [args.userId];
    } else {
      const result = await ctx.db.query("users").paginate({
        cursor: args.cursor ?? null,
        numItems: args.batchSize ?? IN_MEMORY_CHECK_BATCH_SIZE,
      });
      userIds = result.page.map((user) => user._id);
      isDone = result.isDone;
      continueCursor = result.isDone ? null : result.continueCursor;
    }

    const reports: InMemoryInvariantReport[] = [];
    for (const userId of userIds) {
      reports.push(await checkInMemoryInvariantForUser(ctx, userId));
    }

    const uncovered = reports.flatMap(
      (report) => report.uncoveredVerseMemoryIds,
    );
    const withoutHeart = reports.flatMap(
      (report) => report.passageMemoryIdsWithoutHeart,
    );
    return {
      usersScanned: userIds.length,
      inMemoryRows: reports.reduce((sum, r) => sum + r.inMemoryRows, 0),
      inMemoryWithoutHeart: uncovered.length,
      activePassages: reports.reduce((sum, r) => sum + r.activePassages, 0),
      passagesWithoutHeart: withoutHeart.length,
      uncoveredVerseMemoryIds: uncovered.slice(0, MAX_IN_MEMORY_CHECK_SAMPLES),
      passageMemoryIdsWithoutHeart: withoutHeart.slice(
        0,
        MAX_IN_MEMORY_CHECK_SAMPLES,
      ),
      isDone,
      continueCursor,
    };
  },
});

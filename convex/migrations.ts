import { internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { findVerseMemory, seedVerseMemory } from "./lib/verseMemory";

const DEFAULT_BACKFILL_BATCH_SIZE = 200;

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

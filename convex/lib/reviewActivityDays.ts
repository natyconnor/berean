import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import {
  aggregateReviewDays,
  isReadPrimeAttempt,
  mergeReviewDayAggregates,
  normalizeTimeZone,
  startOfZonedDay,
  zonedDayStarts,
  type ReviewDayAggregate,
  type ReviewLogRow,
} from "../../src/lib/dashboard-buckets";

/** Same cap as the historical `reviewActivity` log scan. */
export const MAX_REVIEW_ACTIVITY_ROWS = 5000;
const BACKFILL_WINDOW_DAYS = 366;
/** Convex `.unique()` throws if a race inserted two rows with the same key. */
const DUPLICATE_TAKE = 8;

async function loadDayStateRows(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">,
  timeZone: string,
): Promise<Doc<"userMemoryReviewDayState">[]> {
  return await ctx.db
    .query("userMemoryReviewDayState")
    .withIndex("by_userId_timeZone", (q) =>
      q.eq("userId", userId).eq("timeZone", timeZone),
    )
    .take(DUPLICATE_TAKE);
}

async function loadDayState(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">,
  timeZone: string,
): Promise<Doc<"userMemoryReviewDayState"> | null> {
  const rows = await loadDayStateRows(ctx, userId, timeZone);
  return rows[0] ?? null;
}

async function getOrCreateDayState(
  ctx: MutationCtx,
  userId: Id<"users">,
  timeZone: string,
  now: number,
): Promise<Doc<"userMemoryReviewDayState">> {
  const rows = await loadDayStateRows(ctx, userId, timeZone);
  const first = rows[0];
  if (first) {
    for (const extra of rows.slice(1)) {
      await ctx.db.delete(extra._id);
    }
    return first;
  }
  const id = await ctx.db.insert("userMemoryReviewDayState", {
    userId,
    timeZone,
    backfilled: false,
    updatedAt: now,
  });
  const created = await ctx.db.get(id);
  if (!created) throw new Error("Failed to create review-day state");
  return created;
}

async function loadDayAggregates(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">,
  timeZone: string,
  windowStart: number,
): Promise<ReviewDayAggregate[]> {
  const rows = await ctx.db
    .query("userMemoryReviewDays")
    .withIndex("by_userId_timeZone_dayStart", (q) =>
      q
        .eq("userId", userId)
        .eq("timeZone", timeZone)
        .gte("dayStart", windowStart),
    )
    .collect();
  return mergeReviewDayAggregates(
    rows.map((row) => ({
      dayStart: row.dayStart,
      count: row.count,
      accuracySum: row.accuracySum,
      accuracyCount: row.accuracyCount,
    })),
  );
}

export async function isReviewActivityBackfilled(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">,
  timeZone: string,
): Promise<boolean> {
  const state = await loadDayState(ctx, userId, timeZone);
  return state?.backfilled === true;
}

export async function loadBackfilledReviewDays(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">,
  timeZone: string,
  windowStart: number,
): Promise<ReviewDayAggregate[] | null> {
  if (!(await isReviewActivityBackfilled(ctx, userId, timeZone))) return null;
  return await loadDayAggregates(ctx, userId, timeZone, windowStart);
}

async function replaceReviewDays(
  ctx: MutationCtx,
  userId: Id<"users">,
  timeZone: string,
  days: readonly ReviewDayAggregate[],
): Promise<void> {
  const existing = await ctx.db
    .query("userMemoryReviewDays")
    .withIndex("by_userId_timeZone_dayStart", (q) =>
      q.eq("userId", userId).eq("timeZone", timeZone),
    )
    .collect();
  for (const row of existing) {
    await ctx.db.delete(row._id);
  }
  for (const day of days) {
    await ctx.db.insert("userMemoryReviewDays", {
      userId,
      timeZone,
      dayStart: day.dayStart,
      count: day.count,
      accuracySum: day.accuracySum,
      accuracyCount: day.accuracyCount,
    });
  }
}

export async function rebuildReviewActivityDays(
  ctx: MutationCtx,
  userId: Id<"users">,
  timeZone: string,
  now: number,
): Promise<void> {
  const tz = normalizeTimeZone(timeZone);
  const windowStart = zonedDayStarts(now, BACKFILL_WINDOW_DAYS, tz)[0];
  const rows = await ctx.db
    .query("verseMemoryReviews")
    .withIndex("by_userId_createdAt", (q) =>
      q.eq("userId", userId).gte("createdAt", windowStart),
    )
    .take(MAX_REVIEW_ACTIVITY_ROWS);
  const logs: ReviewLogRow[] = rows.map((row) => ({
    createdAt: row.createdAt,
    accuracy: row.accuracy,
    mode: row.mode,
    stage: row.stage,
  }));
  const days = aggregateReviewDays(logs, now, BACKFILL_WINDOW_DAYS, tz);
  await replaceReviewDays(ctx, userId, tz, days);
}

export async function ensureReviewActivityDays(
  ctx: MutationCtx,
  userId: Id<"users">,
  timeZone: string,
  now: number,
): Promise<void> {
  const tz = normalizeTimeZone(timeZone);
  const state = await getOrCreateDayState(ctx, userId, tz, now);
  if (state.backfilled) return;

  // Touch the state row first so a concurrent ensure / grade OCC-retries this
  // mutation and re-scans logs, instead of inserting a second state row.
  await ctx.db.patch(state._id, { updatedAt: now });
  await rebuildReviewActivityDays(ctx, userId, tz, now);
  await ctx.db.patch(state._id, { backfilled: true, updatedAt: now });
}

async function loadDayRows(
  ctx: MutationCtx,
  userId: Id<"users">,
  timeZone: string,
  dayStart: number,
): Promise<Doc<"userMemoryReviewDays">[]> {
  return await ctx.db
    .query("userMemoryReviewDays")
    .withIndex("by_userId_timeZone_dayStart", (q) =>
      q.eq("userId", userId).eq("timeZone", timeZone).eq("dayStart", dayStart),
    )
    .take(DUPLICATE_TAKE);
}

export async function noteVerseReviewForActivity(
  ctx: MutationCtx,
  args: {
    userId: Id<"users">;
    createdAt: number;
    accuracy: number;
    mode: string;
    stage: number;
    timeZone: string;
  },
): Promise<void> {
  const tz = normalizeTimeZone(args.timeZone);
  const state = await getOrCreateDayState(ctx, args.userId, tz, args.createdAt);
  if (!state.backfilled) {
    // Dashboard `ensureReviewActivityDays` rebuilds from logs. Patch the state
    // row so an in-flight backfill OCC-retries and includes this review.
    await ctx.db.patch(state._id, { updatedAt: args.createdAt });
    return;
  }

  const dayStart = startOfZonedDay(args.createdAt, tz);
  const existingRows = await loadDayRows(ctx, args.userId, tz, dayStart);
  const accuracyDelta = isReadPrimeAttempt(args) ? 0 : args.accuracy;
  const accuracyCountDelta = isReadPrimeAttempt(args) ? 0 : 1;
  const existing = existingRows[0];
  if (existing) {
    let count = 0;
    let accuracySum = 0;
    let accuracyCount = 0;
    for (const row of existingRows) {
      count += row.count;
      accuracySum += row.accuracySum;
      accuracyCount += row.accuracyCount;
    }
    await ctx.db.patch(existing._id, {
      count: count + 1,
      accuracySum: accuracySum + accuracyDelta,
      accuracyCount: accuracyCount + accuracyCountDelta,
    });
    for (const extra of existingRows.slice(1)) {
      await ctx.db.delete(extra._id);
    }
    return;
  }
  await ctx.db.insert("userMemoryReviewDays", {
    userId: args.userId,
    timeZone: tz,
    dayStart,
    count: 1,
    accuracySum: accuracyDelta,
    accuracyCount: accuracyCountDelta,
  });
}

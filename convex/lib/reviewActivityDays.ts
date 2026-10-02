import type { Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import {
  aggregateReviewDays,
  isReadPrimeAttempt,
  normalizeTimeZone,
  startOfZonedDay,
  zonedDayStarts,
  type ReviewDayAggregate,
  type ReviewLogRow,
} from "../../src/lib/dashboard-buckets";

/** Same cap as the historical `reviewActivity` log scan. */
export const MAX_REVIEW_ACTIVITY_ROWS = 5000;
const BACKFILL_WINDOW_DAYS = 366;

async function loadDayState(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">,
  timeZone: string,
) {
  return await ctx.db
    .query("userMemoryReviewDayState")
    .withIndex("by_userId_timeZone", (q) =>
      q.eq("userId", userId).eq("timeZone", timeZone),
    )
    .unique();
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
  return rows.map((row) => ({
    dayStart: row.dayStart,
    count: row.count,
    accuracySum: row.accuracySum,
    accuracyCount: row.accuracyCount,
  }));
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
  now: number,
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
  const state = await loadDayState(ctx, userId, timeZone);
  if (state) {
    await ctx.db.patch(state._id, { backfilled: true, updatedAt: now });
    return;
  }
  await ctx.db.insert("userMemoryReviewDayState", {
    userId,
    timeZone,
    backfilled: true,
    updatedAt: now,
  });
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
  await replaceReviewDays(ctx, userId, tz, days, now);
}

export async function ensureReviewActivityDays(
  ctx: MutationCtx,
  userId: Id<"users">,
  timeZone: string,
  now: number,
): Promise<void> {
  const tz = normalizeTimeZone(timeZone);
  if (await isReviewActivityBackfilled(ctx, userId, tz)) return;
  await rebuildReviewActivityDays(ctx, userId, tz, now);
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
  if (!(await isReviewActivityBackfilled(ctx, args.userId, tz))) {
    await rebuildReviewActivityDays(ctx, args.userId, tz, args.createdAt);
    return;
  }

  const dayStart = startOfZonedDay(args.createdAt, tz);
  const existing = await ctx.db
    .query("userMemoryReviewDays")
    .withIndex("by_userId_timeZone_dayStart", (q) =>
      q.eq("userId", args.userId).eq("timeZone", tz).eq("dayStart", dayStart),
    )
    .unique();
  const accuracyDelta = isReadPrimeAttempt(args) ? 0 : args.accuracy;
  const accuracyCountDelta = isReadPrimeAttempt(args) ? 0 : 1;
  if (existing) {
    await ctx.db.patch(existing._id, {
      count: existing.count + 1,
      accuracySum: existing.accuracySum + accuracyDelta,
      accuracyCount: existing.accuracyCount + accuracyCountDelta,
    });
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

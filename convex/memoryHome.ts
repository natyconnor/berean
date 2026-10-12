import { query } from "./_generated/server";
import { v } from "convex/values";
import { getCurrentUserIdOrNull } from "./lib/auth";
import { loadTodayModel, type TodayModelValue } from "./lib/memoryHome";
import { passageStatusValidator } from "./lib/passageValues";
import { emptyTodayModel } from "../src/lib/memory-today";

const memoryStatusValidator = v.union(
  v.literal("new"),
  v.literal("learning"),
  v.literal("reviewing"),
  v.literal("mastered"),
);

const nullableNumber = v.union(v.number(), v.null());

const passageGoalValidator = v.object({
  kind: v.literal("passage"),
  packId: v.id("packs"),
  title: v.string(),
  verseCount: v.number(),
  learnedVerses: v.number(),
  status: passageStatusValidator,
  hasWorkToday: v.boolean(),
  todayStep: v.union(
    v.object({
      label: v.string(),
      ladderDay: v.union(v.literal(1), v.literal(2), v.literal(3)),
    }),
    v.null(),
  ),
  masteryFraction: v.number(),
  nextDueAt: nullableNumber,
  createdAt: v.number(),
  lastActivityAt: v.number(),
  lastPracticedAt: nullableNumber,
});

const packGoalValidator = v.object({
  kind: v.literal("pack"),
  packId: v.id("packs"),
  title: v.string(),
  verseCount: v.number(),
  learned: v.number(),
  learning: v.number(),
  upNext: v.number(),
  mastered: v.number(),
  masteryFraction: v.number(),
  reviewsDue: v.array(
    v.object({ verseRefId: v.id("verseRefs"), label: v.string() }),
  ),
  learningToday: v.number(),
  reviewTogether: v.boolean(),
  hasWorkToday: v.boolean(),
  nextDueAt: nullableNumber,
  createdAt: v.number(),
  lastActivityAt: v.number(),
  lastPracticedAt: nullableNumber,
  memberLabels: v.array(v.string()),
});

const verseGoalValidator = v.object({
  kind: v.literal("verse"),
  verseRefId: v.id("verseRefs"),
  title: v.string(),
  book: v.string(),
  chapter: v.number(),
  startVerse: v.number(),
  endVerse: v.number(),
  status: memoryStatusValidator,
  learnStage: v.number(),
  intervalDays: v.number(),
  masteryFraction: v.number(),
  hasWorkToday: v.boolean(),
  nextDueAt: nullableNumber,
  createdAt: v.number(),
  lastActivityAt: v.number(),
  lastPracticedAt: nullableNumber,
});

const todayModelValidator = v.object({
  state: v.union(
    v.literal("firstRun"),
    v.literal("work"),
    v.literal("caughtUp"),
  ),
  counts: v.object({
    learningVerses: v.number(),
    passageSessions: v.number(),
    reviews: v.number(),
  }),
  doneToday: v.object({ learningSteps: v.number(), reviews: v.number() }),
  startedToday: v.boolean(),
  nextReviewAt: nullableNumber,
  hasAnythingMemorized: v.boolean(),
  totalInMemory: v.number(),
  statusCounts: v.object({
    learning: v.number(),
    memorized: v.number(),
    mastered: v.number(),
  }),
  goals: v.array(
    v.union(passageGoalValidator, packGoalValidator, verseGoalValidator),
  ),
});

/**
 * Everything the Today home, its side cards, and the Your verses drawer show
 * (see `src/lib/memory-today.ts`). Signed out reads as first run. `now` and
 * `tzOffsetMinutes` set today's local midnight; `timeZone` keeps the cache key
 * in step with the client, which formats day names in that zone.
 */
export const today = query({
  args: { now: v.number(), tzOffsetMinutes: v.number(), timeZone: v.string() },
  returns: todayModelValidator,
  handler: async (ctx, args): Promise<TodayModelValue> => {
    void args.timeZone;
    const userId = await getCurrentUserIdOrNull(ctx);
    if (!userId) return emptyTodayModel();
    return await loadTodayModel(ctx, userId, args);
  },
});

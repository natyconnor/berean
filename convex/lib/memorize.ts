import type { MutationCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { getVerseRefBoundsErrorMessage } from "../../shared/verse-ref-validation";
import {
  passageHeartSpans,
  spanCoveredBy,
  type VerseSpan,
} from "../../src/lib/hearted-verse-coverage";
import { initialSchedule } from "../../src/lib/memory-scheduler";
import {
  planMemorizeTransition,
  type MemorizeSpanResult,
} from "../../src/lib/memorize-transition";
import { loadChapterHeartSpans } from "./savedVerses";
import {
  adjustUserMemoryStats,
  findSavedVerse,
  findVerseMemory,
} from "./verseMemory";
import { findOrCreateVerseRefId } from "./verseRefs";

/**
 * Heart the exact span unless an existing heart (exact, wider, or a passage
 * heart) already contains it. Never removes or changes an existing heart.
 */
export async function ensureHeartCoverage(
  ctx: MutationCtx,
  userId: Id<"users">,
  span: VerseSpan,
  now: number,
): Promise<"added" | "covered"> {
  const hearts = await loadChapterHeartSpans(
    ctx,
    userId,
    span.book,
    span.chapter,
  );
  if (spanCoveredBy(span, hearts)) return "covered";

  const verseRefId = await findOrCreateVerseRefId(ctx, userId, span);
  await ctx.db.insert("savedVerses", {
    userId,
    verseRefId,
    book: span.book,
    chapter: span.chapter,
    createdAt: now,
  });
  return "added";
}

/**
 * Put one span in Memory (see `planMemorizeTransition`) and make sure a heart
 * covers it. Keeps `userMemoryStats` in step with the in-Memory set and
 * mirrors `isHearted` from the exact heart row.
 */
export async function memorizeSpan(
  ctx: MutationCtx,
  userId: Id<"users">,
  span: VerseSpan,
  now: number,
  opts: { upNext: boolean },
): Promise<{ verseRefId: Id<"verseRefs">; result: MemorizeSpanResult }> {
  const boundsError = getVerseRefBoundsErrorMessage(span);
  if (boundsError) {
    throw new Error(boundsError);
  }

  const verseRefId = await findOrCreateVerseRefId(ctx, userId, span);
  await ensureHeartCoverage(ctx, userId, span, now);
  const isHearted = (await findSavedVerse(ctx, userId, verseRefId)) !== null;

  const existing = await findVerseMemory(ctx, userId, verseRefId);
  const plan = planMemorizeTransition(existing, opts.upNext);

  if (!existing) {
    const schedule = initialSchedule(now);
    await ctx.db.insert("verseMemory", {
      userId,
      verseRefId,
      status: plan.status,
      learnStage: schedule.learnStage,
      stageReps: schedule.stageReps,
      ease: schedule.ease,
      intervalDays: schedule.intervalDays,
      dueAt: schedule.dueAt,
      consecutiveCorrect: schedule.consecutiveCorrect,
      lapses: schedule.lapses,
      earlyReviewApplied: schedule.earlyReviewApplied,
      isHearted,
      inMemory: true,
      createdAt: now,
    });
  } else if (plan.result !== "already") {
    await ctx.db.patch(existing._id, {
      inMemory: true,
      isHearted,
      ...(plan.status !== existing.status
        ? { status: plan.status, dueAt: now }
        : {}),
    });
  } else if (existing.isHearted !== isHearted) {
    await ctx.db.patch(existing._id, { isHearted });
  }

  await adjustUserMemoryStats(ctx, userId, now, plan.statsFrom, plan.status);
  return { verseRefId, result: plan.result };
}

/**
 * Take a verse out of Memory. Its schedule, review history, heart, and pack
 * rows are kept, so memorizing it again resumes where it left off. No-op when
 * the verse is not in Memory.
 */
export async function stopMemorizingVerse(
  ctx: MutationCtx,
  userId: Id<"users">,
  verseRefId: Id<"verseRefs">,
  now: number,
): Promise<void> {
  const memory = await findVerseMemory(ctx, userId, verseRefId);
  if (!memory || memory.inMemory !== true) return;

  await ctx.db.patch(memory._id, { inMemory: false });
  await adjustUserMemoryStats(ctx, userId, now, memory.status, null);
}

/**
 * Make sure each chapter of a passage has its passage heart: link an existing
 * exact heart row, or insert one. Never adds per-verse hearts. A row already
 * linked to another passage that still exists is left alone.
 */
export async function ensurePassageHearts(
  ctx: MutationCtx,
  userId: Id<"users">,
  passage: Pick<Doc<"passageMemory">, "_id" | "pieces">,
  now: number,
): Promise<{ created: number; linked: number }> {
  let created = 0;
  let linked = 0;

  for (const span of passageHeartSpans(passage.pieces)) {
    const verseRefId = await findOrCreateVerseRefId(ctx, userId, span);
    const saved = await findSavedVerse(ctx, userId, verseRefId);
    if (!saved) {
      await ctx.db.insert("savedVerses", {
        userId,
        verseRefId,
        book: span.book,
        chapter: span.chapter,
        createdAt: now,
        passageMemoryId: passage._id,
      });
      created += 1;
      continue;
    }

    if (saved.passageMemoryId === passage._id) continue;
    if (saved.passageMemoryId !== undefined) {
      const other = await ctx.db.get(saved.passageMemoryId);
      if (other) continue;
    }
    await ctx.db.patch(saved._id, { passageMemoryId: passage._id });
    linked += 1;
  }

  return { created, linked };
}

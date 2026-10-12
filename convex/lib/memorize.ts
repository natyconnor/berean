import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { getVerseRefBoundsErrorMessage } from "../../shared/verse-ref-validation";
import {
  passageHeartSpans,
  spanCoveredBy,
  type VerseSpan,
} from "../../src/lib/hearted-verse-coverage";
import { initialSchedule } from "../../src/lib/memory-scheduler";
import {
  MEMORIZE_MAX_PACK_SPANS,
  passageCoverage,
  sameSpanSet,
} from "../../src/lib/memorize-status";
import {
  planMemorizeTransition,
  type MemorizeSpanResult,
} from "../../src/lib/memorize-transition";
import { loadChapterHeartSpans } from "./savedVerses";
import {
  adjustUserMemoryStats,
  findSavedVerse,
  findVerseMemory,
  isInMemory,
} from "./verseMemory";
import { findOrCreateVerseRefId, findVerseRefId } from "./verseRefs";

export { stopMemorizingVerse } from "./verseMemory";

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

export type MemorizeDestination =
  | { kind: "verse"; verseRefId: Id<"verseRefs">; span: VerseSpan }
  | { kind: "pack"; packId: Id<"packs"> };

export type MemorizeStatus = {
  state: "none" | "memorizing" | "partOf";
  title?: string;
  destination?: MemorizeDestination;
  allHearted: boolean;
};

/** Packs checked when looking for a custom pack made of exactly these spans. */
const MAX_CANDIDATE_PACKS = 50;

/** Heart spans in one chapter and the passages whose hearts are among them. */
async function loadChapterHearts(
  ctx: QueryCtx,
  userId: Id<"users">,
  book: string,
  chapter: number,
): Promise<{ spans: VerseSpan[]; passageIds: Id<"passageMemory">[] }> {
  const rows = await ctx.db
    .query("savedVerses")
    .withIndex("by_userId_book_chapter", (q) =>
      q.eq("userId", userId).eq("book", book).eq("chapter", chapter),
    )
    .collect();
  const spans: VerseSpan[] = [];
  const passageIds: Id<"passageMemory">[] = [];
  for (const row of rows) {
    if (row.passageMemoryId !== undefined) passageIds.push(row.passageMemoryId);
    const ref = await ctx.db.get(row.verseRefId);
    if (!ref || ref.userId !== userId) continue;
    spans.push({
      book: ref.book,
      chapter: ref.chapter,
      startVerse: ref.startVerse,
      endVerse: ref.endVerse,
    });
  }
  return { spans, passageIds };
}

/** A custom pack whose in-Memory members are exactly `spans`, if any. */
async function findCustomPackWithSpans(
  ctx: QueryCtx,
  userId: Id<"users">,
  spans: readonly VerseSpan[],
): Promise<Doc<"packs"> | null> {
  const firstRefId = await findVerseRefId(ctx, userId, spans[0]);
  if (!firstRefId) return null;

  const memberships = await ctx.db
    .query("packVerses")
    .withIndex("by_userId_verseRefId", (q) =>
      q.eq("userId", userId).eq("verseRefId", firstRefId),
    )
    .take(MAX_CANDIDATE_PACKS);
  for (const membership of memberships) {
    const pack = await ctx.db.get(membership.packId);
    if (!pack || pack.userId !== userId || pack.kind !== "custom") continue;

    const rows = await ctx.db
      .query("packVerses")
      .withIndex("by_userId_packId_order", (q) =>
        q.eq("userId", userId).eq("packId", pack._id),
      )
      .take(MEMORIZE_MAX_PACK_SPANS + 1);
    if (rows.length < spans.length || rows.length > MEMORIZE_MAX_PACK_SPANS) {
      continue;
    }

    const members: VerseSpan[] = [];
    for (const row of rows) {
      const memory = await findVerseMemory(ctx, userId, row.verseRefId);
      if (!memory || !isInMemory(memory)) continue;
      const ref = await ctx.db.get(row.verseRefId);
      if (!ref || ref.userId !== userId) continue;
      members.push(ref);
    }
    if (sameSpanSet(members, spans)) return pack;
  }
  return null;
}

/**
 * Whether the user is already memorizing a target (deduped spans, see
 * `memorizeTargetSpans`):
 * - `memorizing` a passage whose verses equal the target, the exact verse, or
 *   (several spans) a custom pack made of exactly those spans
 * - `partOf` a passage that contains the target
 * `allHearted` is true when a single heart covers each span.
 */
export async function loadMemorizeStatus(
  ctx: QueryCtx,
  userId: Id<"users">,
  spans: readonly VerseSpan[],
): Promise<MemorizeStatus> {
  const chapters = new Map<string, { book: string; chapter: number }>();
  for (const span of spans) {
    chapters.set(`${span.book}|${span.chapter}`, span);
  }
  const heartsByChapter = new Map<string, VerseSpan[]>();
  const passageIds = new Set<Id<"passageMemory">>();
  for (const [key, { book, chapter }] of chapters) {
    const hearts = await loadChapterHearts(ctx, userId, book, chapter);
    heartsByChapter.set(key, hearts.spans);
    for (const id of hearts.passageIds) passageIds.add(id);
  }
  const allHearted = spans.every((span) =>
    spanCoveredBy(
      span,
      heartsByChapter.get(`${span.book}|${span.chapter}`) ?? [],
    ),
  );

  let partOf: Doc<"packs"> | null = null;
  for (const passageId of passageIds) {
    const passage = await ctx.db.get(passageId);
    if (!passage || passage.userId !== userId) continue;
    const pack = await ctx.db.get(passage.packId);
    if (!pack || pack.userId !== userId) continue;

    const coverage = passageCoverage(spans, passageHeartSpans(passage.pieces));
    if (coverage === "equal") {
      return {
        state: "memorizing",
        title: pack.name,
        destination: { kind: "pack", packId: pack._id },
        allHearted,
      };
    }
    if (coverage === "contains") partOf ??= pack;
  }

  if (spans.length === 1) {
    const span = spans[0];
    const verseRefId = await findVerseRefId(ctx, userId, span);
    const memory = verseRefId
      ? await findVerseMemory(ctx, userId, verseRefId)
      : null;
    if (verseRefId && memory && isInMemory(memory)) {
      return {
        state: "memorizing",
        destination: {
          kind: "verse",
          verseRefId,
          span: {
            book: span.book,
            chapter: span.chapter,
            startVerse: span.startVerse,
            endVerse: span.endVerse,
          },
        },
        allHearted,
      };
    }
  }

  if (partOf) {
    return {
      state: "partOf",
      title: partOf.name,
      destination: { kind: "pack", packId: partOf._id },
      allHearted,
    };
  }

  if (spans.length > 1) {
    const pack = await findCustomPackWithSpans(ctx, userId, spans);
    if (pack) {
      return {
        state: "memorizing",
        title: pack.name,
        destination: { kind: "pack", packId: pack._id },
        allHearted,
      };
    }
  }

  return { state: "none", allHearted };
}

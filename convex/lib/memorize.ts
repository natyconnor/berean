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
  carriedOverVerses,
  MEMORIZE_MAX_PACK_SPANS,
  passageRelation,
  sameSpanSet,
  spanKey,
  uniqueSpans,
  type CarriedOverVerse,
  type VerseProgressSpan,
} from "../../src/lib/memorize-status";
import {
  planMemorizeTransition,
  type MemorizeSpanResult,
} from "../../src/lib/memorize-transition";
import { loadPackMembers, loadPackMembershipIndex } from "./packs";
import { deletePassageAndReviews, findPassageByPackId } from "./passageMemory";
import { loadChapterHeartSpans } from "./savedVerses";
import {
  adjustUserMemoryStats,
  findSavedVerse,
  findVerseMemory,
  isInMemory,
  stopMemorizingVerse,
} from "./verseMemory";
import { findOrCreateVerseRefId, findVerseRefId } from "./verseRefs";

export { stopMemorizingVerse } from "./verseMemory";

/**
 * Stop memorizing a pack and delete it. A passage loses its progress and its
 * hearts stay as plain range hearts. Members of any other pack leave Memory
 * unless another pack still lists them; their progress and hearts are kept.
 */
export async function stopMemorizingPack(
  ctx: MutationCtx,
  userId: Id<"users">,
  pack: Doc<"packs">,
  now: number,
): Promise<void> {
  const passage = await findPassageByPackId(ctx, pack._id);
  if (passage && passage.userId === userId) {
    await deletePassageAndReviews(ctx, passage);
  } else {
    const [members, membership] = await Promise.all([
      loadPackMembers(ctx, userId, pack),
      loadPackMembershipIndex(ctx, userId),
    ]);
    for (const member of members) {
      const otherPacks = membership
        .packIdsFor(member.verseRefId, member)
        .filter((packId) => packId !== pack._id);
      if (otherPacks.length === 0) {
        await stopMemorizingVerse(ctx, userId, member.verseRefId, now);
      }
    }
  }

  const rows = await ctx.db
    .query("packVerses")
    .withIndex("by_packId", (q) => q.eq("packId", pack._id))
    .collect();
  for (const row of rows) {
    await ctx.db.delete(row._id);
  }
  await ctx.db.delete(pack._id);
}

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
  state: "none" | "memorizing" | "partOf" | "overlaps";
  title?: string;
  destination?: MemorizeDestination;
  allHearted: boolean;
  /**
   * Verses inside the target already in Memory on their own whose progress a
   * new passage would keep. Only from {@link loadMemorizeStartStatus}, and
   * only when there are some.
   */
  carriedOver?: CarriedOverVerse[];
};

/** Packs checked when looking for a custom pack made of exactly these spans. */
const MAX_CANDIDATE_PACKS = 50;

type ChapterHearts = { spans: VerseSpan[]; passageIds: Id<"passageMemory">[] };

/** A passage the user memorizes: its pack and one span per chapter. */
type MemorizedPassage = { pack: Doc<"packs">; spans: VerseSpan[] };

/**
 * The reads behind {@link loadMemorizeStatus}, cached so one query can check
 * many targets without reading a chapter's hearts or a passage twice.
 */
export type MemorizeStatusReader = {
  chapterHearts(book: string, chapter: number): Promise<ChapterHearts>;
  passage(passageId: Id<"passageMemory">): Promise<MemorizedPassage | null>;
  /** The verse ref for exactly this span, when that verse is in Memory. */
  inMemoryVerseRefId(span: VerseSpan): Promise<Id<"verseRefs"> | null>;
  /** Verses in Memory in one chapter, with their progress. */
  chapterMemoryVerses(
    book: string,
    chapter: number,
  ): Promise<VerseProgressSpan[]>;
};

function cached<K, V>(
  cache: Map<K, Promise<V>>,
  key: K,
  load: () => Promise<V>,
): Promise<V> {
  const hit = cache.get(key);
  if (hit) return hit;
  const value = load();
  cache.set(key, value);
  return value;
}

export function memorizeStatusReader(
  ctx: QueryCtx,
  userId: Id<"users">,
): MemorizeStatusReader {
  const hearts = new Map<string, Promise<ChapterHearts>>();
  const passages = new Map<
    Id<"passageMemory">,
    Promise<MemorizedPassage | null>
  >();
  const verses = new Map<string, Promise<Id<"verseRefs"> | null>>();
  const memoryVerses = new Map<string, Promise<VerseProgressSpan[]>>();
  return {
    chapterHearts: (book, chapter) =>
      cached(hearts, `${book}|${chapter}`, () =>
        loadChapterHearts(ctx, userId, book, chapter),
      ),
    passage: (passageId) =>
      cached(passages, passageId, () =>
        loadMemorizedPassage(ctx, userId, passageId),
      ),
    inMemoryVerseRefId: (span) =>
      cached(verses, spanKey(span), () =>
        loadInMemoryVerseRefId(ctx, userId, span),
      ),
    chapterMemoryVerses: (book, chapter) =>
      cached(memoryVerses, `${book}|${chapter}`, () =>
        loadChapterMemoryVerses(ctx, userId, book, chapter),
      ),
  };
}

async function loadChapterMemoryVerses(
  ctx: QueryCtx,
  userId: Id<"users">,
  book: string,
  chapter: number,
): Promise<VerseProgressSpan[]> {
  const refs = await ctx.db
    .query("verseRefs")
    .withIndex("by_userId_book_chapter", (q) =>
      q.eq("userId", userId).eq("book", book).eq("chapter", chapter),
    )
    .collect();
  const loaded = await Promise.all(
    refs
      .filter((ref) => ref.scope !== "chapter")
      .map(async (ref): Promise<VerseProgressSpan | null> => {
        const memory = await findVerseMemory(ctx, userId, ref._id);
        if (!memory || !isInMemory(memory)) return null;
        return {
          book: ref.book,
          chapter: ref.chapter,
          startVerse: ref.startVerse,
          endVerse: ref.endVerse,
          status: memory.status,
          learnStage: memory.learnStage,
          stageReps: memory.stageReps ?? 0,
        };
      }),
  );
  return loaded.filter((verse): verse is VerseProgressSpan => verse !== null);
}

async function loadMemorizedPassage(
  ctx: QueryCtx,
  userId: Id<"users">,
  passageId: Id<"passageMemory">,
): Promise<MemorizedPassage | null> {
  const passage = await ctx.db.get(passageId);
  if (!passage || passage.userId !== userId) return null;
  const pack = await ctx.db.get(passage.packId);
  if (!pack || pack.userId !== userId) return null;
  return { pack, spans: passageHeartSpans(passage.pieces) };
}

async function loadInMemoryVerseRefId(
  ctx: QueryCtx,
  userId: Id<"users">,
  span: VerseSpan,
): Promise<Id<"verseRefs"> | null> {
  const verseRefId = await findVerseRefId(ctx, userId, span);
  if (!verseRefId) return null;
  const memory = await findVerseMemory(ctx, userId, verseRefId);
  return memory && isInMemory(memory) ? verseRefId : null;
}

/** Heart spans in one chapter and the passages whose hearts are among them. */
async function loadChapterHearts(
  ctx: QueryCtx,
  userId: Id<"users">,
  book: string,
  chapter: number,
): Promise<ChapterHearts> {
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
 * - `overlaps` a passage that shares verses with the target without
 *   containing it
 * `allHearted` is true when a single heart covers each span. Pass one
 * `reader` to check several targets with shared reads.
 */
export async function loadMemorizeStatus(
  ctx: QueryCtx,
  userId: Id<"users">,
  spans: readonly VerseSpan[],
  reader: MemorizeStatusReader = memorizeStatusReader(ctx, userId),
): Promise<MemorizeStatus> {
  const chapters = new Map<string, { book: string; chapter: number }>();
  for (const span of spans) {
    chapters.set(`${span.book}|${span.chapter}`, span);
  }
  const heartsByChapter = new Map<string, VerseSpan[]>();
  const passageIds = new Set<Id<"passageMemory">>();
  for (const [key, { book, chapter }] of chapters) {
    const hearts = await reader.chapterHearts(book, chapter);
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
  let overlaps: Doc<"packs"> | null = null;
  for (const passageId of passageIds) {
    const passage = await reader.passage(passageId);
    if (!passage) continue;

    const { pack } = passage;
    const relation = passageRelation(spans, passage.spans);
    if (relation === "equal") {
      return {
        state: "memorizing",
        title: pack.name,
        destination: { kind: "pack", packId: pack._id },
        allHearted,
      };
    }
    if (relation === "contains") partOf ??= pack;
    if (relation === "overlaps") overlaps ??= pack;
  }

  if (spans.length === 1) {
    const span = spans[0];
    const verseRefId = await reader.inMemoryVerseRefId(span);
    if (verseRefId) {
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

  if (overlaps) {
    return {
      state: "overlaps",
      title: overlaps.name,
      destination: { kind: "pack", packId: overlaps._id },
      allHearted,
    };
  }

  return { state: "none", allHearted };
}

/**
 * {@link loadMemorizeStatus} for spans as a client sent them: deduped, and
 * not memorizing or hearted when there are none or more than one Memorize
 * call takes.
 */
export async function loadMemorizeStatusForSpans(
  ctx: QueryCtx,
  userId: Id<"users">,
  spans: readonly VerseSpan[],
  reader?: MemorizeStatusReader,
): Promise<MemorizeStatus> {
  const unique = uniqueSpans(spans);
  if (unique.length === 0 || unique.length > MEMORIZE_MAX_PACK_SPANS) {
    return { state: "none", allHearted: false };
  }
  return await loadMemorizeStatus(ctx, userId, unique, reader);
}

/**
 * {@link loadMemorizeStatusForSpans}, plus `carriedOver` when the target
 * would start fresh (`none`): the verses inside it already memorized or
 * started on their own (see `carriedOverVerses`). The Memorize sheet says so
 * before a passage starts over them.
 */
export async function loadMemorizeStartStatus(
  ctx: QueryCtx,
  userId: Id<"users">,
  spans: readonly VerseSpan[],
): Promise<MemorizeStatus> {
  const reader = memorizeStatusReader(ctx, userId);
  const status = await loadMemorizeStatusForSpans(ctx, userId, spans, reader);
  const unique = uniqueSpans(spans);
  if (
    status.state !== "none" ||
    unique.length === 0 ||
    unique.length > MEMORIZE_MAX_PACK_SPANS
  ) {
    return status;
  }

  const chapters = new Map<string, { book: string; chapter: number }>();
  for (const span of unique) {
    chapters.set(`${span.book}|${span.chapter}`, span);
  }
  const verses: VerseProgressSpan[] = [];
  for (const { book, chapter } of chapters.values()) {
    verses.push(...(await reader.chapterMemoryVerses(book, chapter)));
  }
  const carriedOver = carriedOverVerses(unique, verses);
  return carriedOver.length > 0 ? { ...status, carriedOver } : status;
}

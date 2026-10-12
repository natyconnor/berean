import type { QueryCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import {
  spanCoveredBy,
  type VerseSpan,
} from "../../src/lib/hearted-verse-coverage";
import {
  firstChapterHeart,
  passageHeartAnchor,
} from "../../src/lib/heart-list";
import { loadPassageDueRecords } from "./passageDue";
import { findVerseMemory, isInMemory } from "./verseMemory";

/**
 * One heart in the Hearted list or "From your hearts". A memorized passage is
 * one item however many chapters it spans: `passage` is set and the span is
 * its first chapter's heart. `inMemory` is true while the user is memorizing
 * it: the verse is in Memory, it is a passage heart, or an active passage
 * contains it.
 */
export type HeartListItem = {
  savedVerseId: Id<"savedVerses">;
  verseRefId: Id<"verseRefs">;
  book: string;
  chapter: number;
  startVerse: number;
  endVerse: number;
  createdAt: number;
  inMemory: boolean;
  passage?: { packId: Id<"packs">; title: string };
};

type HeartRow = { row: Doc<"savedVerses">; span: VerseSpan };

type ActivePassageHeart = {
  packId: Id<"packs">;
  title: string;
  /** Where the passage sits in a newest-first list (see `passageHeartAnchor`). */
  anchorId: Id<"savedVerses">;
  first: HeartRow;
};

export type ActivePassageHearts = {
  byPassageId: Map<Id<"passageMemory">, ActivePassageHeart>;
  /** Every active passage heart span, for "an active passage contains it". */
  spans: VerseSpan[];
};

async function toHeartRow(
  ctx: QueryCtx,
  userId: Id<"users">,
  row: Doc<"savedVerses">,
): Promise<HeartRow | null> {
  const ref = await ctx.db.get(row.verseRefId);
  if (!ref || ref.userId !== userId) return null;
  return {
    row,
    span: {
      book: ref.book,
      chapter: ref.chapter,
      startVerse: ref.startVerse,
      endVerse: ref.endVerse,
    },
  };
}

/**
 * The hearts of the user's started passages (one row per chapter), keyed by
 * passage, with the pack name as the title. Reads the skinny due cache and the
 * `by_userId_passageMemoryId` index, not the passages' pieces.
 */
export async function loadActivePassageHearts(
  ctx: QueryCtx,
  userId: Id<"users">,
): Promise<ActivePassageHearts> {
  const byPassageId = new Map<Id<"passageMemory">, ActivePassageHeart>();
  const spans: VerseSpan[] = [];

  // `now` only feeds due projections, which are not read here.
  for (const record of await loadPassageDueRecords(ctx, userId, 0)) {
    const pack = await ctx.db.get(record.packId);
    if (!pack || pack.userId !== userId) continue;

    const rows = await ctx.db
      .query("savedVerses")
      .withIndex("by_userId_passageMemoryId", (q) =>
        q.eq("userId", userId).eq("passageMemoryId", record.passageMemoryId),
      )
      .collect();
    const hearts: HeartRow[] = [];
    for (const row of rows) {
      const heart = await toHeartRow(ctx, userId, row);
      if (heart) hearts.push(heart);
    }

    const anchor = passageHeartAnchor(hearts.map(({ row }) => row));
    const first = firstChapterHeart(hearts);
    if (!anchor || !first) continue;

    byPassageId.set(record.passageMemoryId, {
      packId: pack._id,
      title: pack.name,
      anchorId: anchor._id,
      first,
    });
    spans.push(...hearts.map(({ span }) => span));
  }

  return { byPassageId, spans };
}

function activePassageFor(
  row: Doc<"savedVerses">,
  passages: ActivePassageHearts,
): ActivePassageHeart | undefined {
  return row.passageMemoryId === undefined
    ? undefined
    : passages.byPassageId.get(row.passageMemoryId);
}

function toItem(
  { row, span }: HeartRow,
  createdAt: number,
  inMemory: boolean,
  passage?: HeartListItem["passage"],
): HeartListItem {
  return {
    savedVerseId: row._id,
    verseRefId: row.verseRefId,
    book: span.book,
    chapter: span.chapter,
    startVerse: span.startVerse,
    endVerse: span.endVerse,
    createdAt,
    inMemory,
    ...(passage ? { passage } : {}),
  };
}

/**
 * The list item for one heart row, or `null` when the row is not the listed
 * row of its passage or its verse ref is missing. A passage heart whose
 * passage has stopped is a plain heart.
 */
export async function toHeartListItem(
  ctx: QueryCtx,
  userId: Id<"users">,
  row: Doc<"savedVerses">,
  passages: ActivePassageHearts,
): Promise<HeartListItem | null> {
  const passage = activePassageFor(row, passages);
  if (passage) {
    if (passage.anchorId !== row._id) return null;
    return toItem(passage.first, row.createdAt, true, {
      packId: passage.packId,
      title: passage.title,
    });
  }

  const heart = await toHeartRow(ctx, userId, row);
  if (!heart) return null;
  const memory = await findVerseMemory(ctx, userId, row.verseRefId);
  const inMemory =
    (memory !== null && isInMemory(memory)) ||
    spanCoveredBy(heart.span, passages.spans);
  return toItem(heart, row.createdAt, inMemory);
}

/**
 * Newest hearts the user is not memorizing, for "From your hearts": skips
 * passage hearts, verses in Memory, and hearts an active passage contains.
 * Reads at most `scanCap` heart rows.
 */
export async function loadNotMemorizingHearts(
  ctx: QueryCtx,
  userId: Id<"users">,
  limit: number,
  scanCap: number,
): Promise<HeartListItem[]> {
  const passages = await loadActivePassageHearts(ctx, userId);
  const items: HeartListItem[] = [];
  let scanned = 0;

  for await (const row of ctx.db
    .query("savedVerses")
    .withIndex("by_userId_createdAt", (q) => q.eq("userId", userId))
    .order("desc")) {
    if (scanned >= scanCap || items.length >= limit) break;
    scanned += 1;

    if (activePassageFor(row, passages)) continue;
    const item = await toHeartListItem(ctx, userId, row, passages);
    if (item && !item.inMemory) items.push(item);
  }

  return items;
}

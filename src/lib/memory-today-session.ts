import { estimateSessionMinutes } from "./memorize-plan";

/**
 * The blended Today session (`/memory/today`) as an ordered list of segments:
 * each building passage (oldest first), then verse learning, then reviews.
 * Segments with nothing to do are left out. Pure; the page freezes its queues
 * at mount and passes the counts in.
 */

export interface TodayPassageInput<P extends string = string> {
  packId: P;
  packName: string;
  /** When its work came due; older passages run first. */
  dueAt: number;
}

export type TodaySegment<P extends string = string> =
  | { kind: "passage"; packId: P; title: string }
  | { kind: "learning"; verseCount: number }
  | { kind: "review"; reviewCount: number };

/** One half of today: passages and new verses, or just the reviews. */
export type TodaySessionOnly = "learning" | "review";

export interface TodaySessionInput<P extends string = string> {
  passages: readonly TodayPassageInput<P>[];
  learningVerses: number;
  reviews: number;
  only?: TodaySessionOnly;
}

export function planTodaySession<P extends string>({
  passages,
  learningVerses,
  reviews,
  only,
}: TodaySessionInput<P>): TodaySegment<P>[] {
  const segments: TodaySegment<P>[] = [];
  const includeLearning = only !== "review";
  const includeReviews = only !== "learning";
  const seen = new Set<P>();
  const passageQueue = includeLearning ? passages : [];
  for (const passage of [...passageQueue].sort((a, b) => a.dueAt - b.dueAt)) {
    if (seen.has(passage.packId)) continue;
    seen.add(passage.packId);
    segments.push({
      kind: "passage",
      packId: passage.packId,
      title: passage.packName,
    });
  }
  if (includeLearning && learningVerses > 0) {
    segments.push({ kind: "learning", verseCount: learningVerses });
  }
  if (includeReviews && reviews > 0) {
    segments.push({ kind: "review", reviewCount: reviews });
  }
  return segments;
}

function countLabel(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

/** "A", "A and B", "A, B and C" */
function joinList(parts: readonly string[]): string {
  if (parts.length <= 1) return parts[0] ?? "";
  return `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
}

export function todaySegmentMinutes(segment: TodaySegment): number {
  switch (segment.kind) {
    case "passage":
      return estimateSessionMinutes({
        learningVerses: 0,
        reviewVerses: 0,
        passageSessions: 1,
      });
    case "learning":
      return estimateSessionMinutes({
        learningVerses: segment.verseCount,
        reviewVerses: 0,
        passageSessions: 0,
      });
    case "review":
      return estimateSessionMinutes({
        learningVerses: 0,
        reviewVerses: segment.reviewCount,
        passageSessions: 0,
      });
  }
}

/** Queue items in a segment: a passage is one, verses and reviews count each. */
export function todaySegmentItemCount(segment: TodaySegment): number {
  switch (segment.kind) {
    case "passage":
      return 1;
    case "learning":
      return segment.verseCount;
    case "review":
      return segment.reviewCount;
  }
}

function segmentWork(segment: TodaySegment): string {
  switch (segment.kind) {
    case "passage":
      return segment.title;
    case "learning":
      return `${countLabel(segment.verseCount, "verse")} to learn`;
    case "review":
      return countLabel(segment.reviewCount, "review");
  }
}

export interface TodayInterstitialCopy {
  /** "Next up: 5 reviews" */
  title: string;
  /** "About 5 min" */
  time: string;
}

/** Between segments: what comes next, and roughly how long it takes. */
export function todayInterstitialCopy(
  next: TodaySegment,
): TodayInterstitialCopy {
  return {
    title: `Next up: ${segmentWork(next)}`,
    time: `About ${todaySegmentMinutes(next)} min`,
  };
}

export interface TodayQueueEntry {
  id: string;
  label: string;
}

/**
 * What's behind the learner. Segments can be taken in any order from the
 * queue, so progress is per segment rather than a count from the start.
 */
export interface TodayProgressInput {
  segments: readonly TodaySegment[];
  /** The learning segment's verses, in the order they run. */
  learning: readonly TodayQueueEntry[];
  /** The review segment's verses, in the order they run. */
  reviews: readonly TodayQueueEntry[];
  /** Segments finished, by index. */
  done: ReadonlySet<number>;
  /** Verse cards with nothing left today, by id. */
  spent?: ReadonlySet<string>;
}

const NO_IDS: ReadonlySet<string> = new Set();

function segmentEntries(
  segment: TodaySegment,
  { learning, reviews }: Pick<TodayProgressInput, "learning" | "reviews">,
): readonly TodayQueueEntry[] {
  if (segment.kind === "passage") return [];
  return segment.kind === "learning" ? learning : reviews;
}

/**
 * Items done in each segment, in plan order: all of a finished segment, and
 * the spent cards of a verse segment still underway.
 */
export function todayDoneItems(input: TodayProgressInput): number[] {
  const spent = input.spent ?? NO_IDS;
  return input.segments.map((segment, index) => {
    if (input.done.has(index)) return todaySegmentItemCount(segment);
    return segmentEntries(segment, input).filter((entry) => spent.has(entry.id))
      .length;
  });
}

/**
 * Segments with nothing left: marked finished, or a verse segment whose every
 * card is spent (left before its last result was dismissed).
 */
export function todayFinishedSegments(
  input: TodayProgressInput,
): ReadonlySet<number> {
  const doneItems = todayDoneItems(input);
  const finished = new Set<number>();
  input.segments.forEach((segment, index) => {
    if ((doneItems[index] ?? 0) >= todaySegmentItemCount(segment)) {
      finished.add(index);
    }
  });
  return finished;
}

/**
 * The segment to run after `after` finishes: the next unfinished one in plan
 * order, wrapping back to any skipped earlier, or null when all are done.
 */
export function todayNextSegment(
  segmentCount: number,
  finished: ReadonlySet<number>,
  after: number,
): number | null {
  for (let step = 1; step < segmentCount; step += 1) {
    const index = (after + step) % segmentCount;
    if (!finished.has(index)) return index;
  }
  return null;
}

export function todayQueueItemStep(
  segments: readonly TodaySegment[],
  learning: readonly TodayQueueEntry[],
  reviews: readonly TodayQueueEntry[],
  item: string,
): { index: number; verseId?: string } | null {
  for (const [index, segment] of segments.entries()) {
    if (segment.kind === "passage" && segment.packId === item) {
      return { index };
    }
    const entries =
      segment.kind === "learning"
        ? learning
        : segment.kind === "review"
          ? reviews
          : [];
    if (entries.some((entry) => entry.id === item)) {
      return { index, verseId: item };
    }
  }
  return null;
}

function clampDone(done: number | undefined, items: number): number {
  return Math.min(Math.max(Math.trunc(done ?? 0), 0), items);
}

function doneShare(done: number | undefined, items: number): number {
  return items > 0 ? Math.min(Math.max(done ?? 0, 0), items) / items : 0;
}

/**
 * Share of the whole session behind the learner, weighted by each segment's
 * estimated minutes. `doneItems` holds each segment's items done
 * ({@link todayDoneItems}), so the bar moves one item at a time; a passage
 * underway may pass a fraction so the bar moves within it.
 */
export function todaySessionProgress(
  segments: readonly TodaySegment[],
  doneItems: readonly number[],
): number {
  if (segments.length === 0) return 1;
  const minutes = segments.map((segment) =>
    Math.max(1, todaySegmentMinutes(segment)),
  );
  const total = minutes.reduce((sum, value) => sum + value, 0);
  const behind = segments.reduce(
    (sum, segment, index) =>
      sum +
      (minutes[index] ?? 0) *
        doneShare(doneItems[index], todaySegmentItemCount(segment)),
    0,
  );
  return behind / total;
}

export interface TodaySessionCounts {
  done: number;
  total: number;
}

/** Items done across every segment, for "Today · 4 of 12". */
export function todaySessionCounts(
  segments: readonly TodaySegment[],
  doneItems: readonly number[],
): TodaySessionCounts {
  const items = segments.map(todaySegmentItemCount);
  return {
    done: items.reduce(
      (sum, count, index) => sum + clampDone(doneItems[index], count),
      0,
    ),
    total: items.reduce((sum, value) => sum + value, 0),
  };
}

/**
 * Adds items finished on an earlier visit today to the count and the bar,
 * so coming back reads "8 of 13", not "0 of 5".
 */
export function carryTodayProgress(
  counts: TodaySessionCounts,
  fraction: number,
  carriedItems: number,
): { counts: TodaySessionCounts; fraction: number } {
  const earlier = Math.max(0, Math.trunc(carriedItems));
  if (earlier === 0) return { counts, fraction };
  const total = counts.total + earlier;
  return {
    counts: { done: counts.done + earlier, total },
    fraction: (earlier + fraction * counts.total) / total,
  };
}

/** Text beside the session bar, so it reads as the whole day: "Today · 4 of 12". */
export function todaySessionCountLabel(counts: TodaySessionCounts): string {
  return `Today · ${counts.done} of ${counts.total}`;
}

export type TodayQueueState = "done" | "current" | "upcoming";

export interface TodayQueueItem extends TodayQueueEntry {
  state: TodayQueueState;
  /** Index of the segment this item runs in. */
  segment: number;
  /**
   * Choosing it opens it: anything still to come, or a finished passage that
   * still has work today. The item underway is already open.
   */
  openable: boolean;
}

export interface TodayQueueGroup {
  kind: TodaySegment["kind"];
  heading: string;
  /** "current" only while one of its segments is underway. */
  state: TodayQueueState;
  /** Every item in the group, so a count can name the whole segment. */
  total: number;
  /** Items done so far. */
  done: number;
  /** The items to list; reviews stop at {@link TODAY_QUEUE_REVIEW_LIMIT}. */
  items: TodayQueueItem[];
  /** Items past the list, shown as "+N more". */
  moreCount: number;
  /** Segment to open when the group itself is chosen, or null for none. */
  target: number | null;
}

/** Reviews listed in the queue before the rest fold into "+N more". */
export const TODAY_QUEUE_REVIEW_LIMIT = 12;

export interface TodayQueueInput extends TodayProgressInput {
  /** Finished passages that still have work today, by pack id. */
  reopenable?: ReadonlySet<string>;
  /** The segment underway, or null between segments. */
  current: number | null;
  /** The card on screen; only this row is current in a verse group. */
  shownId?: string;
}

const QUEUE_HEADINGS: Record<TodaySegment["kind"], string> = {
  passage: "Passages",
  learning: "Verses to learn",
  review: "Reviews",
};

function segmentState(
  index: number,
  finished: ReadonlySet<number>,
  current: number | null,
): TodayQueueState {
  if (index === current) return "current";
  return finished.has(index) ? "done" : "upcoming";
}

/**
 * Everything in today's frozen session, grouped like the segments run:
 * Passages, then Verses to learn, then Reviews, each item done, current, or
 * upcoming, and whether choosing it can open it.
 */
function verseItemState(
  entryId: string,
  segmentState: TodayQueueState,
  spent: ReadonlySet<string>,
  shownId: string | undefined,
  firstUnspentId: string | undefined,
): TodayQueueState {
  if (segmentState === "done" || spent.has(entryId)) return "done";
  if (shownId === entryId) return "current";
  if (
    shownId === undefined &&
    segmentState === "current" &&
    entryId === firstUnspentId
  ) {
    return "current";
  }
  return "upcoming";
}

function visibleQueueItems(
  items: TodayQueueItem[],
  limit: number,
  shownId: string | undefined,
): { items: TodayQueueItem[]; moreCount: number } {
  if (items.length <= limit + 1) {
    return { items, moreCount: 0 };
  }
  const visible = items.slice(0, limit);
  const shownIndex = shownId
    ? items.findIndex((item) => item.id === shownId)
    : -1;
  if (shownIndex >= limit) {
    const shown = items[shownIndex];
    if (shown) visible[limit - 1] = shown;
  }
  return { items: visible, moreCount: items.length - limit };
}

export function todayQueueGroups(input: TodayQueueInput): TodayQueueGroup[] {
  const { segments, current } = input;
  const spent = input.spent ?? NO_IDS;
  const reopenable = input.reopenable ?? NO_IDS;
  const shownId = input.shownId;
  const finished = todayFinishedSegments(input);
  const passages: TodayQueueItem[] = [];
  const groups: TodayQueueGroup[] = [];
  segments.forEach((segment, index) => {
    const state = segmentState(index, finished, current);
    if (segment.kind === "passage") {
      passages.push({
        id: segment.packId,
        label: segment.title,
        state,
        segment: index,
        openable:
          state === "upcoming" ||
          (state === "done" && reopenable.has(segment.packId)),
      });
      return;
    }
    const entries = segmentEntries(segment, input);
    const firstUnspent = entries.find((entry) => !spent.has(entry.id))?.id;
    const items = entries.map((entry): TodayQueueItem => {
      const itemState = verseItemState(
        entry.id,
        state,
        spent,
        shownId,
        firstUnspent,
      );
      return {
        ...entry,
        state: itemState,
        segment: index,
        openable: itemState === "upcoming",
      };
    });
    const limited =
      segment.kind === "review"
        ? visibleQueueItems(items, TODAY_QUEUE_REVIEW_LIMIT, shownId)
        : { items, moreCount: 0 };
    groups.push({
      kind: segment.kind,
      heading: QUEUE_HEADINGS[segment.kind],
      state,
      total: entries.length,
      done: items.filter((item) => item.state === "done").length,
      items: limited.items,
      moreCount: limited.moreCount,
      target: state === "upcoming" ? index : null,
    });
  });
  if (passages.length === 0) return groups;
  const firstOpen =
    passages.find((item) => item.openable && item.state === "upcoming") ??
    passages.find((item) => item.openable);
  return [
    {
      kind: "passage",
      heading: QUEUE_HEADINGS.passage,
      state: passages.some((item) => item.state === "current")
        ? "current"
        : passages.every((item) => item.state === "done")
          ? "done"
          : "upcoming",
      total: passages.length,
      done: passages.filter((item) => item.state === "done").length,
      items: passages,
      moreCount: 0,
      target:
        firstOpen && !passages.some((item) => item.state === "current")
          ? firstOpen.segment
          : null,
    },
    ...groups,
  ];
}

export interface TodaySessionTally {
  /** Titles of the passages worked on today. */
  passages: readonly string[];
  learningSteps: number;
  reviews: number;
}

/** Summary line: "Psalm 16, 2 learning steps and 5 reviews done today." */
export function todaySessionDoneLine(tally: TodaySessionTally): string {
  const parts = [
    ...tally.passages,
    tally.learningSteps > 0
      ? countLabel(tally.learningSteps, "learning step")
      : null,
    tally.reviews > 0 ? countLabel(tally.reviews, "review") : null,
  ].filter((part): part is string => part !== null);
  if (parts.length === 0) return "Today's session is done.";
  return `${joinList(parts)} done today.`;
}

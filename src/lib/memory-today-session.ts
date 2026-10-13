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

function clampCompleted(
  segments: readonly TodaySegment[],
  completed: number,
): number {
  return Math.min(Math.max(Math.trunc(completed), 0), segments.length);
}

/**
 * Share of the whole session behind the learner once `completed` segments
 * are done, weighted by each segment's estimated minutes. `doneInSegment`
 * moves the bar through the segment underway, one item at a time.
 */
export function todaySessionProgress(
  segments: readonly TodaySegment[],
  completed: number,
  doneInSegment = 0,
): number {
  if (segments.length === 0) return 1;
  const done = clampCompleted(segments, completed);
  const minutes = segments.map((segment) =>
    Math.max(1, todaySegmentMinutes(segment)),
  );
  const total = minutes.reduce((sum, value) => sum + value, 0);
  const behind = minutes.slice(0, done).reduce((sum, value) => sum + value, 0);
  const current = segments[done];
  const share = current
    ? Math.min(Math.max(doneInSegment, 0) / todaySegmentItemCount(current), 1)
    : 0;
  return (behind + (minutes[done] ?? 0) * share) / total;
}

export interface TodaySessionCounts {
  done: number;
  total: number;
}

/** Items done across every segment, for "Today · 4 of 12". */
export function todaySessionCounts(
  segments: readonly TodaySegment[],
  completed: number,
  doneInSegment = 0,
): TodaySessionCounts {
  const done = clampCompleted(segments, completed);
  const items = segments.map(todaySegmentItemCount);
  const total = items.reduce((sum, value) => sum + value, 0);
  const behind = items.slice(0, done).reduce((sum, value) => sum + value, 0);
  const current = items[done] ?? 0;
  return {
    done: behind + Math.min(Math.max(Math.trunc(doneInSegment), 0), current),
    total,
  };
}

/** Text beside the session bar, so it reads as the whole day: "Today · 4 of 12". */
export function todaySessionCountLabel(counts: TodaySessionCounts): string {
  return `Today · ${counts.done} of ${counts.total}`;
}

export type TodayQueueState = "done" | "current" | "upcoming";

export interface TodayQueueEntry {
  id: string;
  label: string;
}

export interface TodayQueueItem extends TodayQueueEntry {
  state: TodayQueueState;
}

export interface TodayQueueGroup {
  kind: TodaySegment["kind"];
  heading: string;
  state: TodayQueueState;
  /** Every item in the group, so a count can name the whole segment. */
  total: number;
  /** The items to list; reviews stop at {@link TODAY_QUEUE_REVIEW_LIMIT}. */
  items: TodayQueueItem[];
  /** Items past the list, shown as "+N more". */
  moreCount: number;
}

/** Reviews listed in the queue before the rest fold into "+N more". */
export const TODAY_QUEUE_REVIEW_LIMIT = 12;

export interface TodayQueueInput {
  segments: readonly TodaySegment[];
  /** The learning segment's verses, in the order they run. */
  learning: readonly TodayQueueEntry[];
  /** The review segment's verses, in the order they run. */
  reviews: readonly TodayQueueEntry[];
  /** Segments finished so far. */
  completed: number;
  /** The segment underway, or null between segments. */
  current: number | null;
}

const QUEUE_HEADINGS: Record<TodaySegment["kind"], string> = {
  passage: "Passages",
  learning: "Verses to learn",
  review: "Reviews",
};

function segmentState(
  index: number,
  completed: number,
  current: number | null,
): TodayQueueState {
  if (index === current) return "current";
  return index < completed ? "done" : "upcoming";
}

function groupState(items: readonly TodayQueueItem[]): TodayQueueState {
  if (items.every((item) => item.state === "done")) return "done";
  if (items.every((item) => item.state === "upcoming")) return "upcoming";
  return "current";
}

/**
 * Everything in today's frozen session, grouped like the segments run:
 * Passages, then Verses to learn, then Reviews, each item done, current, or
 * upcoming.
 */
export function todayQueueGroups({
  segments,
  learning,
  reviews,
  completed,
  current,
}: TodayQueueInput): TodayQueueGroup[] {
  const passages: TodayQueueItem[] = [];
  const groups: TodayQueueGroup[] = [];
  segments.forEach((segment, index) => {
    const state = segmentState(index, completed, current);
    if (segment.kind === "passage") {
      passages.push({ id: segment.packId, label: segment.title, state });
      return;
    }
    const entries = segment.kind === "learning" ? learning : reviews;
    const limit =
      segment.kind === "review" ? TODAY_QUEUE_REVIEW_LIMIT : entries.length;
    const shown = entries.length > limit + 1 ? limit : entries.length;
    groups.push({
      kind: segment.kind,
      heading: QUEUE_HEADINGS[segment.kind],
      state,
      total: entries.length,
      items: entries.slice(0, shown).map((entry) => ({ ...entry, state })),
      moreCount: entries.length - shown,
    });
  });
  if (passages.length === 0) return groups;
  return [
    {
      kind: "passage",
      heading: QUEUE_HEADINGS.passage,
      state: groupState(passages),
      total: passages.length,
      items: passages,
      moreCount: 0,
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

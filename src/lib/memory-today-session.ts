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

export interface TodaySessionInput<P extends string = string> {
  passages: readonly TodayPassageInput<P>[];
  learningVerses: number;
  reviews: number;
}

export function planTodaySession<P extends string>({
  passages,
  learningVerses,
  reviews,
}: TodaySessionInput<P>): TodaySegment<P>[] {
  const segments: TodaySegment<P>[] = [];
  const seen = new Set<P>();
  for (const passage of [...passages].sort((a, b) => a.dueAt - b.dueAt)) {
    if (seen.has(passage.packId)) continue;
    seen.add(passage.packId);
    segments.push({
      kind: "passage",
      packId: passage.packId,
      title: passage.packName,
    });
  }
  if (learningVerses > 0) {
    segments.push({ kind: "learning", verseCount: learningVerses });
  }
  if (reviews > 0) segments.push({ kind: "review", reviewCount: reviews });
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

/** Session header text: "Psalm 16 · new verses", "Learning · 2 verses", "Review · 5". */
export function todaySegmentHeader(segment: TodaySegment): string {
  switch (segment.kind) {
    case "passage":
      return `${segment.title} · new verses`;
    case "learning":
      return `Learning · ${countLabel(segment.verseCount, "verse")}`;
    case "review":
      return `Review · ${segment.reviewCount}`;
  }
}

function segmentWork(segment: TodaySegment): string {
  switch (segment.kind) {
    case "passage":
      return segment.title;
    case "learning":
      return countLabel(segment.verseCount, "learning step");
    case "review":
      return countLabel(segment.reviewCount, "review");
  }
}

/** Between segments: "Nice. Next: 5 reviews · about 3 min". */
export function todayInterstitialCopy(next: TodaySegment): string {
  return `Nice. Next: ${segmentWork(next)} · about ${todaySegmentMinutes(next)} min`;
}

/**
 * Share of the whole session behind the learner once `completed` segments
 * are done, weighted by each segment's estimated minutes.
 */
export function todaySessionProgress(
  segments: readonly TodaySegment[],
  completed: number,
): number {
  if (segments.length === 0) return 1;
  const done = Math.min(Math.max(Math.trunc(completed), 0), segments.length);
  const minutes = segments.map((segment) =>
    Math.max(1, todaySegmentMinutes(segment)),
  );
  const total = minutes.reduce((sum, value) => sum + value, 0);
  const behind = minutes.slice(0, done).reduce((sum, value) => sum + value, 0);
  return behind / total;
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

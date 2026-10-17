import { localDayIndex } from "@/lib/passage-frontier";

/** Session summary banner the first time a verse is memorized. */
export function firstMemorizedCopy(reference: string): {
  lead: string;
  rest: string;
} {
  return {
    lead: `${reference} is memorized.`,
    rest: "We'll bring it back tomorrow to keep it fresh.",
  };
}

/** Toast the first time a verse or passage is mastered. */
export function firstMasteredCopy(reference: string): {
  title: string;
  description: string;
} {
  return {
    title: `${reference} is mastered.`,
    description: "A month between reviews and it's still yours.",
  };
}

/** The passage moment's headline. */
export function passageMomentHeadline(title: string): string {
  return `You can say all of ${title} by heart.`;
}

/**
 * Calendar days from the passage's start through `now`, counting both ends:
 * started Monday, finished Wednesday is 3 days, the same count "Learn it in
 * about N days" promised. Never less than 1.
 */
export function passageMomentDays(
  createdAt: number,
  now: number,
  tzOffsetMinutes: number,
): number {
  const days =
    localDayIndex(now, tzOffsetMinutes) -
    localDayIndex(createdAt, tzOffsetMinutes) +
    1;
  return Math.max(1, days);
}

/** "11 verses · 4 days". */
export function passageMomentStats(verseCount: number, days: number): string {
  const verses = `${verseCount} verse${verseCount === 1 ? "" : "s"}`;
  return `${verses} · ${days} day${days === 1 ? "" : "s"}`;
}

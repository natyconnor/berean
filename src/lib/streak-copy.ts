/** A streak shorter than this isn't shown anywhere. */
export const MIN_SHOWN_STREAK_DAYS = 2;
/** From here the streak line adds "Faithful in little." */
export const FAITHFUL_STREAK_DAYS = 7;
/** The window "Practiced {n} of the last 7 days" counts over. */
export const PRACTICE_WINDOW_DAYS = 7;

export interface StreakCopy {
  /** "3-day streak". */
  label: string;
  /** "Faithful in little." from 7 days on, else null. */
  note: string | null;
  /** `label` and `note` as one line. */
  sentence: string;
}

/**
 * Streak copy, or null below two days: a one-day streak means nothing yet,
 * and an ended streak just disappears (no "lost" or "reset" wording).
 */
export function streakCopy(days: number): StreakCopy | null {
  if (!Number.isFinite(days) || days < MIN_SHOWN_STREAK_DAYS) return null;
  const label = `${days}-day streak`;
  const note = days >= FAITHFUL_STREAK_DAYS ? "Faithful in little." : null;
  return { label, note, sentence: note ? `${label}. ${note}` : label };
}

/** Days with any practice among the last `windowDays` (today last). */
export function practicedDaysIn(
  dailyCounts: readonly number[],
  windowDays = PRACTICE_WINDOW_DAYS,
): number {
  return dailyCounts.slice(-windowDays).filter((count) => count > 0).length;
}

/** What shows where the streak is hidden. */
export function practicedDaysCopy(
  practicedDays: number,
  windowDays = PRACTICE_WINDOW_DAYS,
): string {
  return practicedDays > 0
    ? `Practiced ${practicedDays} of the last ${windowDays} days`
    : `No practice in the last ${windowDays} days`;
}

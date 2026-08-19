export interface DayAccuracy {
  dayStart: number;
  average: number | null;
  count: number;
}

/** Map a pointer x in viewBox space to the nearest day index. */
export function hoverIndexFromX(
  x: number,
  dayCount: number,
  viewWidth: number,
): number {
  if (dayCount <= 1) return 0;
  if (viewWidth <= 0) return 0;
  const index = Math.round((x / viewWidth) * (dayCount - 1));
  return Math.max(0, Math.min(dayCount - 1, index));
}

/** One decimal when needed so hover shows the true daily average. */
export function formatAccuracyPercent(average: number): string {
  const rounded = Math.round(average * 10) / 10;
  return Number.isInteger(rounded) ? `${rounded}%` : `${rounded.toFixed(1)}%`;
}

export function attemptPhrase(count: number): string {
  return count === 1 ? "1 attempt" : `${count} attempts`;
}

export function accuracyTooltipCopy(day: DayAccuracy): {
  headline: string;
  detail: string;
} {
  if (day.average === null || day.count === 0) {
    return { headline: "No attempts", detail: attemptPhrase(0) };
  }
  return {
    headline: formatAccuracyPercent(day.average),
    detail: attemptPhrase(day.count),
  };
}

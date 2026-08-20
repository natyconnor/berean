export interface DayCount {
  dayStart: number;
  count: number;
}

/** Square cell size in pixels — does not stretch with the card. */
export const HEATMAP_CELL_PX = 12;
/** Gap between cells / week columns; matches Tailwind `gap-1`. */
export const HEATMAP_GAP_PX = 4;

/**
 * Group days into Sunday-aligned week columns. The first column is padded with
 * leading `null`s so weekday rows line up (row 0 = Sunday).
 *
 * `dayStart` values are local midnights (as UTC instants), so {@link Date#getDay}
 * matches the viewer's weekday. The series ends on today — no future days.
 */
export function toWeeks(data: readonly DayCount[]): (DayCount | null)[][] {
  if (data.length === 0) return [];
  const leadingBlanks = new Date(data[0].dayStart).getDay();
  const cells: (DayCount | null)[] = [
    ...Array.from({ length: leadingBlanks }, () => null),
    ...data,
  ];
  const weeks: (DayCount | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) {
    const week = cells.slice(i, i + 7);
    while (week.length < 7) week.push(null);
    weeks.push(week);
  }
  return weeks;
}

/** Pixel width of `weekCount` fixed-size week columns including gaps. */
export function heatmapGridWidthPx(weekCount: number): number {
  if (weekCount <= 0) return 0;
  return weekCount * HEATMAP_CELL_PX + (weekCount - 1) * HEATMAP_GAP_PX;
}

/**
 * How many fixed-size week columns fit in `widthPx`. Returns 0 when the
 * container has not been measured yet so callers can keep a fallback.
 */
export function weeksThatFit(widthPx: number): number {
  if (widthPx <= 0) return 0;
  return Math.max(
    1,
    Math.floor((widthPx + HEATMAP_GAP_PX) / (HEATMAP_CELL_PX + HEATMAP_GAP_PX)),
  );
}

/** Keep the newest `count` week columns (today stays on the right). */
export function visibleWeeksFromEnd<T>(
  weeks: readonly T[],
  count: number,
): T[] {
  if (weeks.length === 0 || count <= 0) return [];
  if (count >= weeks.length) return [...weeks];
  return weeks.slice(weeks.length - count);
}

export interface DayCount {
  dayStart: number;
  count: number;
}

/** Square cell size in pixels — does not stretch with the card. */
export const HEATMAP_CELL_PX = 12;
/** Gap between cells / week columns; matches Tailwind `gap-1`. */
export const HEATMAP_GAP_PX = 4;
/** Full Sunday–Saturday weeks drawn after the current week. */
export const HEATMAP_FUTURE_WEEKS = 2;

/**
 * Local midnight of the calendar day after `dayStart`. Uses the viewer's
 * timezone so DST 23h/25h days still land on the next local midnight.
 */
export function nextLocalDayStart(dayStart: number): number {
  const next = new Date(dayStart);
  next.setDate(next.getDate() + 1);
  return next.getTime();
}

/**
 * Append empty (`count: 0`) days through Saturday of the current week, then
 * `futureWeeks` more full weeks. Weeks are Sunday-aligned (same as the
 * heatmap columns).
 *
 * `data` is oldest-first and must already end on "today". Empty input is
 * returned unchanged.
 */
export function padHeatmapFutureDays(
  data: readonly DayCount[],
  futureWeeks: number = HEATMAP_FUTURE_WEEKS,
): DayCount[] {
  if (data.length === 0) return [];
  const last = data[data.length - 1];
  const remainingThisWeek = 6 - new Date(last.dayStart).getDay();
  const extraDays = remainingThisWeek + futureWeeks * 7;
  if (extraDays <= 0) return [...data];

  const extra: DayCount[] = [];
  let dayStart = last.dayStart;
  for (let i = 0; i < extraDays; i += 1) {
    dayStart = nextLocalDayStart(dayStart);
    extra.push({ dayStart, count: 0 });
  }
  return [...data, ...extra];
}

/**
 * Group days into Sunday-aligned week columns. The first column is padded with
 * leading `null`s so weekday rows line up (row 0 = Sunday).
 *
 * `dayStart` values are local midnights (as UTC instants), so {@link Date#getDay}
 * matches the viewer's weekday.
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

/** Keep the newest `count` week columns (today + future stay on the right). */
export function visibleWeeksFromEnd<T>(
  weeks: readonly T[],
  count: number,
): T[] {
  if (weeks.length === 0 || count <= 0) return [];
  if (count >= weeks.length) return [...weeks];
  return weeks.slice(weeks.length - count);
}

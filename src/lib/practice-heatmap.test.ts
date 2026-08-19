import { describe, expect, it } from "vitest";
import {
  HEATMAP_CELL_PX,
  HEATMAP_GAP_PX,
  heatmapGridWidthPx,
  toWeeks,
  visibleWeeksFromEnd,
  weeksThatFit,
  type DayCount,
} from "./practice-heatmap";

/** Local midnight so `Date#getDay` matches the calendar day in any TZ. */
function localDay(year: number, monthIndex: number, day: number): number {
  return new Date(year, monthIndex, day).getTime();
}

function countsOn(
  starts: readonly number[],
  active: ReadonlySet<number>,
): DayCount[] {
  return starts.map((dayStart) => ({
    dayStart,
    count: active.has(dayStart) ? 2 : 0,
  }));
}

describe("toWeeks", () => {
  it("Sunday-aligns columns and ends on the last day without future padding", () => {
    const wednesday = localDay(2024, 0, 10);
    const weeks = toWeeks([{ dayStart: wednesday, count: 1 }]);

    expect(weeks.every((week) => week.length === 7)).toBe(true);
    expect(weeks[0][0]).toBeNull();
    expect(weeks[0][1]).toBeNull();
    expect(weeks[0][2]).toBeNull();
    expect(weeks[0][3]).toEqual({ dayStart: wednesday, count: 1 });
    expect(weeks).toHaveLength(1);
  });

  it("keeps a Sunday start with no leading blanks", () => {
    const sunday = localDay(2024, 0, 7);
    const monday = localDay(2024, 0, 8);
    const days = countsOn([sunday, monday], new Set([sunday]));
    const weeks = toWeeks(days);
    expect(weeks[0][0]).toEqual({ dayStart: sunday, count: 2 });
    expect(weeks[0][1]?.count).toBe(0);
  });
});

describe("heatmapGridWidthPx / weeksThatFit", () => {
  it("uses fixed cell size plus gaps, never stretching", () => {
    expect(heatmapGridWidthPx(0)).toBe(0);
    expect(heatmapGridWidthPx(1)).toBe(HEATMAP_CELL_PX);
    expect(heatmapGridWidthPx(3)).toBe(
      3 * HEATMAP_CELL_PX + 2 * HEATMAP_GAP_PX,
    );
  });

  it("counts how many week columns fit in a width", () => {
    expect(weeksThatFit(0)).toBe(0);
    expect(weeksThatFit(HEATMAP_CELL_PX)).toBe(1);
    expect(weeksThatFit(heatmapGridWidthPx(12))).toBe(12);
    expect(weeksThatFit(heatmapGridWidthPx(12) + HEATMAP_CELL_PX - 1)).toBe(12);
  });
});

describe("visibleWeeksFromEnd", () => {
  it("keeps the newest columns so today stays visible", () => {
    expect(visibleWeeksFromEnd(["a", "b", "c", "d"], 2)).toEqual(["c", "d"]);
    expect(visibleWeeksFromEnd(["a", "b"], 9)).toEqual(["a", "b"]);
    expect(visibleWeeksFromEnd(["a"], 0)).toEqual([]);
  });
});

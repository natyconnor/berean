import { describe, expect, it } from "vitest";
import {
  HEATMAP_CELL_PX,
  HEATMAP_FUTURE_WEEKS,
  HEATMAP_GAP_PX,
  heatmapGridWidthPx,
  nextLocalDayStart,
  padHeatmapFutureDays,
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

describe("nextLocalDayStart", () => {
  it("steps one calendar day from local midnight", () => {
    const wednesday = localDay(2024, 0, 10);
    expect(new Date(wednesday).getDay()).toBe(3);
    const thursday = nextLocalDayStart(wednesday);
    expect(new Date(thursday).getFullYear()).toBe(2024);
    expect(new Date(thursday).getMonth()).toBe(0);
    expect(new Date(thursday).getDate()).toBe(11);
    expect(new Date(thursday).getDay()).toBe(4);
  });
});

describe("padHeatmapFutureDays", () => {
  it("returns empty input unchanged", () => {
    expect(padHeatmapFutureDays([])).toEqual([]);
  });

  it("fills the rest of a Wednesday week plus two future weeks", () => {
    const wednesday = localDay(2024, 0, 10);
    const padded = padHeatmapFutureDays([{ dayStart: wednesday, count: 4 }]);

    expect(padded).toHaveLength(1 + 3 + HEATMAP_FUTURE_WEEKS * 7);
    expect(padded[0]).toEqual({ dayStart: wednesday, count: 4 });
    expect(padded.slice(1).every((d) => d.count === 0)).toBe(true);

    const last = padded[padded.length - 1];
    expect(new Date(last.dayStart).getDay()).toBe(6);
    expect(new Date(last.dayStart).getDate()).toBe(27);
  });

  it("adds only two weeks when today is already Saturday", () => {
    const saturday = localDay(2024, 0, 13);
    const padded = padHeatmapFutureDays([{ dayStart: saturday, count: 1 }]);
    expect(padded).toHaveLength(1 + HEATMAP_FUTURE_WEEKS * 7);
    expect(new Date(padded[padded.length - 1].dayStart).getDate()).toBe(27);
  });

  it("fills Mon–Sat of the current week when today is Sunday", () => {
    const sunday = localDay(2024, 0, 7);
    const padded = padHeatmapFutureDays([{ dayStart: sunday, count: 0 }]);
    expect(padded).toHaveLength(1 + 6 + HEATMAP_FUTURE_WEEKS * 7);
    expect(new Date(padded[padded.length - 1].dayStart).getDate()).toBe(27);
  });
});

describe("toWeeks", () => {
  it("Sunday-aligns columns and completes the last week after future padding", () => {
    const wednesday = localDay(2024, 0, 10);
    const padded = padHeatmapFutureDays([{ dayStart: wednesday, count: 1 }]);
    const weeks = toWeeks(padded);

    expect(weeks.every((week) => week.length === 7)).toBe(true);
    // Wednesday 2024-01-10 is column 0 row 3; leading Sunday–Tue are blanks.
    expect(weeks[0][0]).toBeNull();
    expect(weeks[0][1]).toBeNull();
    expect(weeks[0][2]).toBeNull();
    expect(weeks[0][3]).toEqual({ dayStart: wednesday, count: 1 });
    expect(weeks).toHaveLength(1 + HEATMAP_FUTURE_WEEKS);
    expect(weeks[weeks.length - 1][6]?.count).toBe(0);
  });

  it("keeps a Sunday start with no leading blanks", () => {
    const sunday = localDay(2024, 0, 7);
    const days = countsOn(
      [sunday, nextLocalDayStart(sunday)],
      new Set([sunday]),
    );
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
  it("keeps the newest columns so today and future stay visible", () => {
    expect(visibleWeeksFromEnd(["a", "b", "c", "d"], 2)).toEqual(["c", "d"]);
    expect(visibleWeeksFromEnd(["a", "b"], 9)).toEqual(["a", "b"]);
    expect(visibleWeeksFromEnd(["a"], 0)).toEqual([]);
  });
});

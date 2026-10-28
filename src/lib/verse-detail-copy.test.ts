import { describe, expect, it } from "vitest";

import { DAY_MS } from "./memory-scheduler";
import {
  accuraciesForHowItsGoing,
  formatFactDay,
  howItsGoing,
  verseDetailFacts,
} from "./verse-detail-copy";

const NOW = Date.UTC(2026, 9, 12, 18, 0, 0); // Mon Oct 12
const TZ = "UTC";

describe("formatFactDay", () => {
  it("says Today, Tomorrow, or the weekday and date", () => {
    expect(formatFactDay(NOW - DAY_MS, NOW, TZ)).toBe("Today");
    expect(formatFactDay(NOW + 60_000, NOW, TZ)).toBe("Today");
    expect(formatFactDay(NOW + DAY_MS, NOW, TZ)).toBe("Tomorrow");
    expect(formatFactDay(NOW + 3 * DAY_MS, NOW, TZ)).toBe("Thu, Oct 15");
  });
});

describe("verseDetailFacts", () => {
  it("names the next review and the gap for memorized verses", () => {
    expect(
      verseDetailFacts(
        {
          status: "reviewing",
          learnStage: 3,
          dueAt: NOW + 3 * DAY_MS,
          intervalDays: 8,
          lapses: 0,
        },
        NOW,
        TZ,
      ),
    ).toEqual([
      { label: "Next review", value: "Thu, Oct 15" },
      { label: "Gap between reviews", value: "8 days" },
    ]);
  });

  it("shows slips only when there are some", () => {
    expect(
      verseDetailFacts(
        {
          status: "mastered",
          learnStage: 3,
          dueAt: NOW + DAY_MS,
          intervalDays: 40,
          lapses: 2,
        },
        NOW,
        TZ,
      ),
    ).toContainEqual({ label: "Times it slipped", value: "2" });
  });

  it("gives learning verses their next step instead", () => {
    expect(
      verseDetailFacts(
        {
          status: "learning",
          learnStage: 1,
          dueAt: NOW - 1000,
          intervalDays: 0,
          lapses: 0,
        },
        NOW,
        TZ,
      ),
    ).toEqual([{ label: "Next step", value: "Today" }]);
    expect(
      verseDetailFacts(
        {
          status: "learning",
          learnStage: 2,
          dueAt: NOW + 12 * 60 * 60 * 1000,
          intervalDays: 0,
          lapses: 0,
          lastReviewedAt: NOW - 1000,
        },
        NOW,
        TZ,
      ),
    ).toEqual([{ label: "Next step", value: "Tomorrow" }]);
    expect(
      verseDetailFacts(
        {
          status: "learning",
          learnStage: 2,
          dueAt: NOW + 2 * 60 * 60 * 1000,
          intervalDays: 0,
          lapses: 0,
        },
        NOW,
        TZ,
      ),
    ).toEqual([{ label: "Next step", value: "Later today" }]);
    expect(
      verseDetailFacts(
        {
          status: "new",
          learnStage: 0,
          dueAt: NOW,
          intervalDays: 0,
          lapses: 0,
        },
        NOW,
        TZ,
      ),
    ).toEqual([{ label: "Next step", value: "When you're ready" }]);
  });
});

describe("howItsGoing", () => {
  it("reads the latest five attempts", () => {
    expect(howItsGoing([])).toBeNull();
    expect(howItsGoing([100, 95, 92])?.label).toBe("Solid");
    expect(howItsGoing([80, 75, 70])?.label).toBe("A few slips");
    expect(howItsGoing([40, 60])?.label).toBe("Needs another pass");
    expect(howItsGoing([100, 100, 100, 100, 100, 0, 0])).toEqual({
      label: "Solid",
      averageAccuracy: 100,
      attempts: 5,
    });
  });

  it("drops hinted tries from the accuracy readout", () => {
    expect(
      howItsGoing(
        accuraciesForHowItsGoing([
          { accuracy: 0, hint: "first-letters" },
          { accuracy: 0, hint: "first-letters" },
          { accuracy: 100 },
          { accuracy: 97 },
          { accuracy: 97 },
        ]),
      ),
    ).toEqual({
      label: "Solid",
      averageAccuracy: 98,
      attempts: 3,
    });
  });

  it("drops held Refresh sitting tries from the accuracy readout", () => {
    expect(
      howItsGoing(
        accuraciesForHowItsGoing([
          { accuracy: 100, holdSchedule: true },
          { accuracy: 100, holdSchedule: true },
          { accuracy: 100, hint: "first-letters", holdSchedule: true },
          { accuracy: 100 },
        ]),
      ),
    ).toEqual({
      label: "Solid",
      averageAccuracy: 100,
      attempts: 1,
    });
  });

  it("drops tries from before Start over", () => {
    expect(
      howItsGoing(
        accuraciesForHowItsGoing(
          [
            { accuracy: 40, createdAt: NOW - 1000 },
            { accuracy: 98, createdAt: NOW - DAY_MS },
          ],
          NOW,
        ),
      ),
    ).toBeNull();
  });
});

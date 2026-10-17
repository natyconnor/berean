import { describe, expect, it } from "vitest";

import {
  learnEmptyCopy,
  libraryEmptyCopy,
  practiceEmptyCopy,
  reviewEmptyCopy,
  soonestLearningUnlock,
  soonestReviewAt,
  type ScheduledVerse,
} from "./memory-empty-states";
import { DAY_MS, MIN_LEARNING_LOCK_MS } from "./memory-scheduler";

// Tue Oct 13 2026, 09:00 in Los Angeles.
const NOW = Date.UTC(2026, 9, 13, 16, 0);
const TZ = "America/Los_Angeles";

function verse(
  status: ScheduledVerse["status"],
  dueAt: number,
  extra: Partial<ScheduledVerse> = {},
): ScheduledVerse {
  return { status, learnStage: 3, dueAt, ...extra };
}

describe("soonestReviewAt", () => {
  it("picks the soonest memorized verse after now", () => {
    expect(
      soonestReviewAt(
        [
          verse("reviewing", NOW + 4 * DAY_MS),
          verse("mastered", NOW + 2 * DAY_MS),
          verse("reviewing", NOW - DAY_MS),
          verse("learning", NOW + DAY_MS, { learnStage: 2 }),
        ],
        NOW,
      ),
    ).toBe(NOW + 2 * DAY_MS);
  });

  it("is null with nothing memorized", () => {
    expect(soonestReviewAt([verse("learning", NOW + DAY_MS)], NOW)).toBeNull();
  });
});

describe("soonestLearningUnlock", () => {
  it("picks the locked learning verse that opens first", () => {
    const later = verse("learning", NOW + 2 * DAY_MS, {
      learnStage: 2,
      lastReviewedAt: NOW,
    });
    const sooner = verse("learning", NOW + MIN_LEARNING_LOCK_MS, {
      learnStage: 1,
      lastReviewedAt: NOW,
    });
    expect(
      soonestLearningUnlock(
        [later, sooner, verse("learning", NOW, { learnStage: 0 })],
        NOW,
      ),
    ).toBe(sooner);
  });

  it("ignores Up next and memorized verses", () => {
    expect(
      soonestLearningUnlock(
        [verse("new", NOW + DAY_MS), verse("reviewing", NOW + DAY_MS)],
        NOW,
      ),
    ).toBeNull();
  });
});

describe("empty copy", () => {
  it("names the next review day, or says there is nothing to review", () => {
    expect(reviewEmptyCopy(NOW + 2 * DAY_MS, NOW, TZ)).toEqual({
      title: "All caught up",
      body: "Your next review is Thursday.",
    });
    expect(reviewEmptyCopy(NOW + DAY_MS, NOW, TZ).body).toBe(
      "Your next review is tomorrow.",
    );
    expect(reviewEmptyCopy(null, NOW, TZ)).toEqual({
      title: "Nothing to review yet",
      body: null,
    });
  });

  it("says what unlocks next, or offers something new", () => {
    expect(
      learnEmptyCopy(
        verse("learning", NOW + DAY_MS, { learnStage: 1, lastReviewedAt: NOW }),
        NOW,
        TZ,
      ),
    ).toEqual({
      title: "Nothing new today",
      body: "Nice. Tomorrow you'll try it with blanks.",
      startSomethingNew: false,
    });
    expect(learnEmptyCopy(null, NOW, TZ)).toEqual({
      title: "Nothing new today",
      body: "Pick something new to memorize.",
      startSomethingNew: true,
    });
  });

  it("explains when practice opens", () => {
    expect(practiceEmptyCopy()).toEqual({
      title: "Nothing to practice yet",
      body: "Practice opens once you've memorized your first verse.",
    });
    expect(practiceEmptyCopy("John 3:16").body).toBe(
      "Practice opens once John 3:16 is memorized.",
    );
  });

  it("gives every Library filter its own empty line", () => {
    expect(libraryEmptyCopy("due")).toBe("Nothing due today.");
    expect(libraryEmptyCopy("learning")).toBe(
      "Nothing in progress. Memorize a verse to start.",
    );
    expect(libraryEmptyCopy("mastered")).toBe(
      "Nothing mastered yet. Mastery comes after about 2 months of short reviews.",
    );
  });
});

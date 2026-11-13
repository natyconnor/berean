import { describe, expect, it } from "vitest";

import { diffWords } from "@/lib/diff-words";
import { DAY_MS, reviewGradeOutcome } from "@/lib/memory-scheduler";

import {
  classifyVerseAttempt,
  countAttemptErrors,
  verseAttemptAccuracy,
} from "./study-attempt-quality";
import {
  attemptFeedbackLine,
  reviewOutcomeMessage,
  SCORE_LINES,
  specialMissLine,
} from "./verse-attempt-feedback";

function lineForTyped(typed: string, actual: string): string {
  const tokens = diffWords(typed, actual);
  const accuracy = verseAttemptAccuracy(tokens);
  const quality = classifyVerseAttempt(tokens) ?? "off";
  return attemptFeedbackLine({
    accuracy,
    outcome: reviewGradeOutcome(quality, accuracy),
    errors: countAttemptErrors(tokens),
  });
}

const NOW = 1_700_000_000_000;

const reviewingTomorrow = {
  status: "reviewing" as const,
  learnStage: 3,
  stageReps: 0,
  ease: 2.3,
  intervalDays: 1,
  dueAt: NOW + DAY_MS,
  consecutiveCorrect: 3,
  lapses: 0,
  earlyReviewApplied: false,
};

describe("specialMissLine", () => {
  it("calls out a single swapped word", () => {
    const tokens = diffWords(
      "The Lord is my shepherd I shall not want he makes me sit down in green pastures",
      "The Lord is my shepherd I shall not want he makes me lie down in green pastures",
    );
    expect(specialMissLine(countAttemptErrors(tokens))).toBe(
      "So close! Just one word off.",
    );
  });

  it("says one word off for a missing or an extra word too", () => {
    const actual =
      "For God so loved the world that he gave his only Son that whoever believes in him should not perish but have eternal life";
    const typed =
      "For God so loved the world that he gave his only Son that whoever believes in him should not perish but have life";
    expect(specialMissLine(countAttemptErrors(diffWords(typed, actual)))).toBe(
      "So close! Just one word off.",
    );
    expect(
      specialMissLine(
        countAttemptErrors(diffWords("Jesus really wept", "Jesus wept")),
      ),
    ).toBe("So close! Just one word off.");
  });

  it("calls out two and three word misses", () => {
    expect(
      specialMissLine({
        matches: 8,
        typos: 0,
        mismatches: 2,
        missing: 0,
        extra: 0,
      }),
    ).toBe("So close! Just two words off.");
    expect(
      specialMissLine({
        matches: 8,
        typos: 0,
        mismatches: 3,
        missing: 0,
        extra: 0,
      }),
    ).toBe("Almost! Just three words off.");
  });

  it("calls out typo-only misses that are not exact", () => {
    expect(
      specialMissLine({
        matches: 6,
        typos: 3,
        mismatches: 0,
        missing: 0,
        extra: 0,
      }),
    ).toBe("Basically perfect, just a few typos!");
  });
});

describe("attemptFeedbackLine", () => {
  it("celebrates perfect attempts, including allowed typos", () => {
    expect(attemptFeedbackLine({ accuracy: 100, outcome: "exact" })).toBe(
      "Perfect!",
    );
    expect(
      attemptFeedbackLine({
        accuracy: 93,
        outcome: "exact",
        errors: { matches: 2, typos: 1, mismatches: 0, missing: 0, extra: 0 },
      }),
    ).toBe("Basically perfect, just one typo!");
    expect(
      attemptFeedbackLine({
        accuracy: 90,
        outcome: "exact",
        errors: { matches: 4, typos: 2, mismatches: 0, missing: 0, extra: 0 },
      }),
    ).toBe("Basically perfect, just a couple of typos!");
  });

  it("prefers a one-word miss over the score line", () => {
    expect(
      attemptFeedbackLine({
        accuracy: 91,
        outcome: "pass",
        errors: { matches: 10, typos: 0, mismatches: 1, missing: 0, extra: 0 },
      }),
    ).toBe("So close! Just one word off.");
  });

  it.each([
    [99, "Almost perfect!"],
    [96, "Almost perfect!"],
    [95, "You've pretty much got this."],
    [93, "You've pretty much got this."],
    [92, "A few slips, but you know it."],
    [90, "A few slips, but you know it."],
    [89, "That was pretty good."],
    [87, "That was pretty good."],
    [86, "Good work, just a few words to fix."],
    [85, "Good work, just a few words to fix."],
    [84, "Almost there."],
    [80, "Almost there."],
    [79, "Mostly right, with a few gaps."],
    [73, "Mostly right, with a few gaps."],
    [72, "Mostly there, but it needs some work."],
    [70, "Mostly there, but it needs some work."],
    [69, "Getting there, but this one needs another round."],
    [60, "Getting there, but this one needs another round."],
    [59, "You still need some work on this one."],
    [0, "You still need some work on this one."],
  ])("says the line for %i%%", (accuracy, line) => {
    const outcome =
      accuracy >= 85 ? "pass" : accuracy >= 60 ? "close" : "lapse";
    expect(attemptFeedbackLine({ accuracy, outcome })).toBe(line);
  });

  it("orders the score lines from highest to lowest", () => {
    const mins = SCORE_LINES.map((band) => band.min);
    expect(mins).toEqual([...mins].sort((a, b) => b - a));
    expect(mins.at(-1)).toBe(0);
  });

  it("never mentions a kept interval, an extra try, recall, or stretching", () => {
    for (const { line } of SCORE_LINES) {
      expect(line).not.toMatch(/keep the same review interval/i);
      expect(line).not.toMatch(/extend your review interval/i);
      expect(line).not.toMatch(/try again to/i);
      expect(line).not.toMatch(/recall/i);
    }
  });

  it("uses the low-score line for a 0% miss on a short verse", () => {
    expect(lineForTyped("nope nope 0", "Jesus wept.")).toBe(
      "You still need some work on this one.",
    );
    expect(lineForTyped("nope nope 0", "God is love.")).toBe(
      "You still need some work on this one.",
    );
  });

  it("keeps the one-word line for a one-word miss at retry accuracy", () => {
    expect(
      lineForTyped("The Lord is my helper", "The Lord is my shepherd"),
    ).toBe("So close! Just one word off.");
  });

  it("keeps the one-word line for a one-word miss at hold accuracy", () => {
    expect(lineForTyped("The Lord is kind", "The Lord is good")).toBe(
      "So close! Just one word off.",
    );
  });

  it("uses the low-score line when a one-word miss is still below 60%", () => {
    expect(lineForTyped("Jesus slept", "Jesus wept.")).toBe(
      "You still need some work on this one.",
    );
  });
});

describe("reviewOutcomeMessage", () => {
  it("keeps the next-review line on a close miss that stays memorized", () => {
    expect(
      reviewOutcomeMessage({
        outcome: "close",
        nextSchedule: reviewingTomorrow,
        now: NOW,
        lapsedToLearning: false,
      }),
    ).toMatch(/^Next review /);
  });

  it("states only the schedule consequence, as a sentence", () => {
    expect(
      reviewOutcomeMessage({
        outcome: "exact",
        nextSchedule: { ...reviewingTomorrow, dueAt: NOW + 3 * DAY_MS },
        now: NOW,
        lapsedToLearning: false,
      }),
    ).toBe("Next review in 3 days.");
    expect(
      reviewOutcomeMessage({
        outcome: "pass",
        nextSchedule: reviewingTomorrow,
        now: NOW,
        lapsedToLearning: false,
      }),
    ).toBe("Next review tomorrow.");
    expect(
      reviewOutcomeMessage({
        outcome: "lapse",
        now: NOW,
        lapsedToLearning: true,
      }),
    ).toBe("We'll learn it again, starting with fill in the blanks.");
  });

  it("says a miss comes back sooner until its date is known", () => {
    expect(
      reviewOutcomeMessage({
        outcome: "lapse",
        nextSchedule: null,
        now: NOW,
        lapsedToLearning: false,
      }),
    ).toBe("We'll review it again sooner.");
    expect(
      reviewOutcomeMessage({
        outcome: "lapse",
        nextSchedule: null,
        now: NOW,
        lapsedToLearning: false,
        unscheduled: true,
      }),
    ).toBeNull();
  });

  it("says nothing on a pass until the next review is known", () => {
    expect(
      reviewOutcomeMessage({
        outcome: "close",
        nextSchedule: null,
        now: NOW,
        lapsedToLearning: false,
      }),
    ).toBeNull();
  });
});

import { describe, expect, it } from "vitest";

import { diffWords } from "@/lib/diff-words";
import { DAY_MS, reviewGradeOutcome } from "@/lib/memory-scheduler";

import {
  classifyVerseAttempt,
  countAttemptErrors,
  verseAttemptAccuracy,
} from "./study-attempt-quality";
import {
  attemptFeedbackLead,
  attemptPraiseLine,
  CLOSE_ACCURACY_LEADS,
  LAPSE_ACCURACY_LEADS,
  PASS_ACCURACY_LEADS,
  reviewOutcomeMessage,
  specialMissLead,
} from "./verse-attempt-feedback";

function leadForTyped(typed: string, actual: string): string {
  const tokens = diffWords(typed, actual);
  const accuracy = verseAttemptAccuracy(tokens);
  const quality = classifyVerseAttempt(tokens) ?? "off";
  return attemptFeedbackLead({
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

describe("specialMissLead", () => {
  it("calls out a single swapped word", () => {
    const tokens = diffWords(
      "The Lord is my shepherd I shall not want he makes me sit down in green pastures",
      "The Lord is my shepherd I shall not want he makes me lie down in green pastures",
    );
    expect(specialMissLead(countAttemptErrors(tokens))).toBe(
      "Oh so close! Just one word off",
    );
  });

  it("calls out a single missing word", () => {
    const actual =
      "For God so loved the world that he gave his only Son that whoever believes in him should not perish but have eternal life";
    const typed =
      "For God so loved the world that he gave his only Son that whoever believes in him should not perish but have life";
    expect(specialMissLead(countAttemptErrors(diffWords(typed, actual)))).toBe(
      "Oh so close! Just one word missing",
    );
  });

  it("calls out a single extra word", () => {
    const tokens = diffWords("Jesus really wept", "Jesus wept");
    expect(specialMissLead(countAttemptErrors(tokens))).toBe(
      "Oh so close! Just one extra word",
    );
  });

  it("calls out two and three word misses", () => {
    expect(
      specialMissLead({
        matches: 8,
        typos: 0,
        mismatches: 2,
        missing: 0,
        extra: 0,
      }),
    ).toBe("So close — just two words off");
    expect(
      specialMissLead({
        matches: 8,
        typos: 0,
        mismatches: 3,
        missing: 0,
        extra: 0,
      }),
    ).toBe("Almost — just three words off");
  });

  it("calls out typo-only misses that are not exact", () => {
    expect(
      specialMissLead({
        matches: 6,
        typos: 3,
        mismatches: 0,
        missing: 0,
        extra: 0,
      }),
    ).toBe("The words are right — just a few spellings to tidy up");
  });
});

describe("attemptFeedbackLead", () => {
  it("celebrates exact recalls, including allowed typos", () => {
    expect(attemptFeedbackLead({ accuracy: 100, outcome: "exact" })).toBe(
      "Nailed it",
    );
    expect(
      attemptFeedbackLead({
        accuracy: 93,
        outcome: "exact",
        errors: { matches: 2, typos: 1, mismatches: 0, missing: 0, extra: 0 },
      }),
    ).toBe("Nailed it — just a tiny spelling slip");
    expect(
      attemptFeedbackLead({
        accuracy: 90,
        outcome: "exact",
        errors: { matches: 4, typos: 2, mismatches: 0, missing: 0, extra: 0 },
      }),
    ).toBe("Nailed it — a couple of spelling slips");
  });

  it("prefers a one-word miss over the accuracy band", () => {
    expect(
      attemptFeedbackLead({
        accuracy: 91,
        outcome: "pass",
        errors: { matches: 10, typos: 0, mismatches: 1, missing: 0, extra: 0 },
      }),
    ).toBe("Oh so close! Just one word off");
  });

  it("uses each 85–99 pass accuracy band", () => {
    expect(attemptFeedbackLead({ accuracy: 99, outcome: "pass" })).toBe(
      PASS_ACCURACY_LEADS[0].lead,
    );
    expect(attemptFeedbackLead({ accuracy: 96, outcome: "pass" })).toBe(
      PASS_ACCURACY_LEADS[1].lead,
    );
    expect(attemptFeedbackLead({ accuracy: 93, outcome: "pass" })).toBe(
      PASS_ACCURACY_LEADS[2].lead,
    );
    expect(attemptFeedbackLead({ accuracy: 90, outcome: "pass" })).toBe(
      PASS_ACCURACY_LEADS[3].lead,
    );
    expect(attemptFeedbackLead({ accuracy: 87, outcome: "pass" })).toBe(
      PASS_ACCURACY_LEADS[4].lead,
    );
    expect(attemptFeedbackLead({ accuracy: 85, outcome: "pass" })).toBe(
      PASS_ACCURACY_LEADS[5].lead,
    );
  });

  it("uses each 60–84 close accuracy band", () => {
    expect(attemptFeedbackLead({ accuracy: 84, outcome: "close" })).toBe(
      CLOSE_ACCURACY_LEADS[0].lead,
    );
    expect(attemptFeedbackLead({ accuracy: 80, outcome: "close" })).toBe(
      CLOSE_ACCURACY_LEADS[1].lead,
    );
    expect(attemptFeedbackLead({ accuracy: 77, outcome: "close" })).toBe(
      CLOSE_ACCURACY_LEADS[2].lead,
    );
    expect(attemptFeedbackLead({ accuracy: 73, outcome: "close" })).toBe(
      CLOSE_ACCURACY_LEADS[3].lead,
    );
    expect(attemptFeedbackLead({ accuracy: 70, outcome: "close" })).toBe(
      CLOSE_ACCURACY_LEADS[4].lead,
    );
    expect(attemptFeedbackLead({ accuracy: 66, outcome: "close" })).toBe(
      CLOSE_ACCURACY_LEADS[5].lead,
    );
    expect(attemptFeedbackLead({ accuracy: 63, outcome: "close" })).toBe(
      CLOSE_ACCURACY_LEADS[6].lead,
    );
    expect(attemptFeedbackLead({ accuracy: 60, outcome: "close" })).toBe(
      CLOSE_ACCURACY_LEADS[7].lead,
    );
  });

  it("never mentions a kept interval, an extra try, or stretching", () => {
    const lines = [
      ...PASS_ACCURACY_LEADS,
      ...CLOSE_ACCURACY_LEADS,
      ...LAPSE_ACCURACY_LEADS,
    ].map((band) => band.lead);
    for (const line of lines) {
      expect(line).not.toMatch(/keep the same review interval/i);
      expect(line).not.toMatch(/extend your review interval/i);
      expect(line).not.toMatch(/try again to/i);
    }
  });

  it("uses each lapse accuracy band", () => {
    expect(attemptFeedbackLead({ accuracy: 58, outcome: "lapse" })).toBe(
      LAPSE_ACCURACY_LEADS[0].lead,
    );
    expect(attemptFeedbackLead({ accuracy: 50, outcome: "lapse" })).toBe(
      LAPSE_ACCURACY_LEADS[1].lead,
    );
    expect(attemptFeedbackLead({ accuracy: 45, outcome: "lapse" })).toBe(
      LAPSE_ACCURACY_LEADS[2].lead,
    );
    expect(attemptFeedbackLead({ accuracy: 40, outcome: "lapse" })).toBe(
      LAPSE_ACCURACY_LEADS[3].lead,
    );
    expect(attemptFeedbackLead({ accuracy: 30, outcome: "lapse" })).toBe(
      LAPSE_ACCURACY_LEADS[4].lead,
    );
    expect(attemptFeedbackLead({ accuracy: 20, outcome: "lapse" })).toBe(
      LAPSE_ACCURACY_LEADS[5].lead,
    );
    expect(attemptFeedbackLead({ accuracy: 10, outcome: "lapse" })).toBe(
      LAPSE_ACCURACY_LEADS[6].lead,
    );
    expect(attemptFeedbackLead({ accuracy: 0, outcome: "lapse" })).toBe(
      LAPSE_ACCURACY_LEADS[7].lead,
    );
  });

  it("uses the lapse band for a 0% miss on a two-word verse", () => {
    expect(leadForTyped("nope nope 0", "Jesus wept.")).toBe(
      "Blank slate this round — we'll rebuild it",
    );
  });

  it("uses the lapse band for a 0% miss on a three-word verse", () => {
    expect(leadForTyped("nope nope 0", "God is love.")).toBe(
      "Blank slate this round — we'll rebuild it",
    );
  });

  it("keeps the close-call line for a one-word miss at retry accuracy", () => {
    expect(
      leadForTyped("The Lord is my helper", "The Lord is my shepherd"),
    ).toBe("Oh so close! Just one word off");
  });

  it("keeps the close-call line for a one-word miss at hold accuracy", () => {
    expect(leadForTyped("The Lord is kind", "The Lord is good")).toBe(
      "Oh so close! Just one word off",
    );
  });

  it("uses the lapse band when a one-word miss is still below 60%", () => {
    expect(leadForTyped("Jesus slept", "Jesus wept.")).toBe("Halfway home");
  });
});

describe("attemptPraiseLine", () => {
  it("exclaims an exact recall and ends the rest as a sentence", () => {
    expect(attemptPraiseLine({ accuracy: 100, outcome: "exact" })).toBe(
      "Nailed it!",
    );
    expect(
      attemptPraiseLine({
        accuracy: 91,
        outcome: "pass",
        errors: { matches: 10, typos: 0, mismatches: 1, missing: 0, extra: 0 },
      }),
    ).toBe("Oh so close! Just one word off.");
    expect(attemptPraiseLine({ accuracy: 40, outcome: "lapse" })).toBe(
      "A handful of words came back.",
    );
  });
});

describe("reviewOutcomeMessage", () => {
  it("keeps the next-review clause on a close miss that stays reviewing", () => {
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
    ).toBe("Back to fill in the blanks.");
  });

  it("says nothing until the next review is known", () => {
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

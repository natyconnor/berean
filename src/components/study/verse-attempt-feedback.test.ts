import { describe, expect, it } from "vitest";

import { diffWords } from "@/lib/diff-words";
import { DAY_MS } from "@/lib/memory-scheduler";

import { countAttemptErrors } from "./study-attempt-quality";
import {
  attemptFeedbackLead,
  HOLD_ACCURACY_LEADS,
  LAPSE_ACCURACY_LEADS,
  RETRY_ACCURACY_LEADS,
  reviewFeedbackMessage,
  specialMissLead,
} from "./verse-attempt-feedback";

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
        outcome: "retry",
        errors: { matches: 10, typos: 0, mismatches: 1, missing: 0, extra: 0 },
      }),
    ).toBe("Oh so close! Just one word off");
  });

  it("uses each retry accuracy band", () => {
    expect(attemptFeedbackLead({ accuracy: 99, outcome: "retry" })).toBe(
      RETRY_ACCURACY_LEADS[0].lead,
    );
    expect(attemptFeedbackLead({ accuracy: 96, outcome: "retry" })).toBe(
      RETRY_ACCURACY_LEADS[1].lead,
    );
    expect(attemptFeedbackLead({ accuracy: 93, outcome: "retry" })).toBe(
      RETRY_ACCURACY_LEADS[2].lead,
    );
    expect(attemptFeedbackLead({ accuracy: 90, outcome: "retry" })).toBe(
      RETRY_ACCURACY_LEADS[3].lead,
    );
    expect(attemptFeedbackLead({ accuracy: 87, outcome: "retry" })).toBe(
      RETRY_ACCURACY_LEADS[4].lead,
    );
    expect(attemptFeedbackLead({ accuracy: 84, outcome: "retry" })).toBe(
      RETRY_ACCURACY_LEADS[5].lead,
    );
    expect(attemptFeedbackLead({ accuracy: 80, outcome: "retry" })).toBe(
      RETRY_ACCURACY_LEADS[6].lead,
    );
  });

  it("uses each hold accuracy band", () => {
    expect(attemptFeedbackLead({ accuracy: 79, outcome: "hold" })).toBe(
      HOLD_ACCURACY_LEADS[0].lead,
    );
    expect(attemptFeedbackLead({ accuracy: 73, outcome: "hold" })).toBe(
      HOLD_ACCURACY_LEADS[1].lead,
    );
    expect(attemptFeedbackLead({ accuracy: 70, outcome: "hold" })).toBe(
      HOLD_ACCURACY_LEADS[2].lead,
    );
    expect(attemptFeedbackLead({ accuracy: 66, outcome: "hold" })).toBe(
      HOLD_ACCURACY_LEADS[3].lead,
    );
    expect(attemptFeedbackLead({ accuracy: 63, outcome: "hold" })).toBe(
      HOLD_ACCURACY_LEADS[4].lead,
    );
    expect(attemptFeedbackLead({ accuracy: 60, outcome: "hold" })).toBe(
      HOLD_ACCURACY_LEADS[5].lead,
    );
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
});

describe("reviewFeedbackMessage", () => {
  it("invites a retry instead of naming a due date", () => {
    expect(
      reviewFeedbackMessage({
        lead: "Almost there",
        outcome: "retry",
        now: NOW,
        lapsedToLearning: false,
      }),
    ).toBe("Almost there — try again to earn a longer wait.");
  });

  it("names Challenge when a daily review lapses into learning", () => {
    expect(
      reviewFeedbackMessage({
        lead: "A handful of words came back",
        outcome: "lapse",
        now: NOW,
        lapsedToLearning: true,
      }),
    ).toBe("A handful of words came back — back to Challenge.");
  });

  it("keeps the next-review clause on hold and later-ladder lapses", () => {
    expect(
      reviewFeedbackMessage({
        lead: "Mostly there, but it needs some work",
        outcome: "hold",
        nextSchedule: reviewingTomorrow,
        now: NOW,
        lapsedToLearning: false,
      }),
    ).toMatch(/^Mostly there, but it needs some work — next review /);
  });
});

import { describe, expect, it } from "vitest";

import { DAY_MS } from "./memory-scheduler";
import {
  hasSessionWorkLeft,
  isLearningSessionCandidate,
  isMemorySessionCandidate,
  isPracticeSessionCandidate,
  isReviewSessionCandidate,
  reviewPhaseListAction,
} from "./memory-session";

const NOW = 1_700_000_000_000;

describe("memory session membership", () => {
  it("keeps Practice limited to graduated verses", () => {
    expect(isPracticeSessionCandidate({ status: "new" })).toBe(false);
    expect(isPracticeSessionCandidate({ status: "learning" })).toBe(false);
    expect(isPracticeSessionCandidate({ status: "reviewing" })).toBe(true);
    expect(isPracticeSessionCandidate({ status: "mastered" })).toBe(true);
  });

  it("puts only available in-progress verses in an unscoped Learning session", () => {
    expect(
      isLearningSessionCandidate(
        { status: "learning", dueAt: NOW },
        NOW,
        false,
      ),
    ).toBe(true);
    expect(
      isLearningSessionCandidate(
        { status: "learning", dueAt: NOW + DAY_MS },
        NOW,
        false,
      ),
    ).toBe(false);
    expect(
      isLearningSessionCandidate({ status: "new", dueAt: NOW }, NOW, false),
    ).toBe(false);
  });

  it("keeps in-progress learning in session when the clock is hours stale", () => {
    const staleNow = NOW - 3 * 60 * 60 * 1000;
    expect(
      isLearningSessionCandidate(
        { status: "learning", dueAt: NOW, lastReviewedAt: NOW },
        staleNow,
        false,
      ),
    ).toBe(true);
    expect(
      isLearningSessionCandidate(
        {
          status: "learning",
          dueAt: NOW + DAY_MS,
          lastReviewedAt: NOW,
        },
        staleNow,
        false,
      ),
    ).toBe(false);
  });

  it("allows a verse-scoped Learning CTA to start a new verse", () => {
    expect(
      isLearningSessionCandidate({ status: "new", dueAt: NOW }, NOW, true),
    ).toBe(true);
    expect(isLearningSessionCandidate({}, NOW, true)).toBe(true);
  });

  it("dispatches membership by explicit session kind", () => {
    expect(
      isMemorySessionCandidate(
        { status: "learning", dueAt: NOW },
        "learning",
        NOW,
      ),
    ).toBe(true);
    expect(
      isMemorySessionCandidate(
        { status: "learning", dueAt: NOW },
        "practice",
        NOW,
      ),
    ).toBe(false);
    expect(
      isMemorySessionCandidate(
        { status: "reviewing", dueAt: NOW - 1 },
        "review",
        NOW,
      ),
    ).toBe(true);
    expect(
      isMemorySessionCandidate(
        { status: "reviewing", dueAt: NOW + DAY_MS },
        "review",
        NOW,
      ),
    ).toBe(false);
  });

  it("limits Review to due review-phase verses", () => {
    expect(
      isReviewSessionCandidate({ status: "reviewing", dueAt: NOW }, NOW),
    ).toBe(true);
    expect(
      isReviewSessionCandidate({ status: "learning", dueAt: NOW }, NOW),
    ).toBe(false);
    expect(
      isReviewSessionCandidate(
        { status: "reviewing", dueAt: NOW + DAY_MS },
        NOW,
      ),
    ).toBe(false);
  });

  it("uses Review when due and Practice when the next review is still ahead", () => {
    expect(
      reviewPhaseListAction({ status: "reviewing", dueAt: NOW }, NOW),
    ).toBe("review");
    expect(
      reviewPhaseListAction({ status: "mastered", dueAt: NOW - 1 }, NOW),
    ).toBe("review");
    expect(
      reviewPhaseListAction({ status: "reviewing", dueAt: NOW + DAY_MS }, NOW),
    ).toBe("practice");
    expect(reviewPhaseListAction({ status: "reviewing" }, NOW)).toBe(
      "practice",
    );
  });
});

describe("hasSessionWorkLeft", () => {
  it("never spends a Practice verse — extra recall has no ration", () => {
    expect(
      hasSessionWorkLeft(
        "practice",
        { status: "reviewing", dueAt: NOW + DAY_MS },
        NOW,
      ),
    ).toBe(true);
  });

  it("spends a Review verse once it is no longer due", () => {
    expect(
      hasSessionWorkLeft("review", { status: "reviewing", dueAt: NOW }, NOW),
    ).toBe(true);
    expect(
      hasSessionWorkLeft(
        "review",
        { status: "reviewing", dueAt: NOW + 2 * DAY_MS },
        NOW,
      ),
    ).toBe(false);
  });

  it("spends a Review verse that lapsed back into learning", () => {
    expect(
      hasSessionWorkLeft("review", { status: "learning", dueAt: NOW }, NOW),
    ).toBe(false);
  });

  it("keeps a Review verse when an 80% retry left it due", () => {
    expect(
      hasSessionWorkLeft("review", { status: "reviewing", dueAt: NOW }, NOW),
    ).toBe(true);
  });

  it("keeps a Learning verse until it soft-locks", () => {
    expect(
      hasSessionWorkLeft(
        "learning",
        { status: "learning", dueAt: NOW, lastReviewedAt: NOW },
        NOW,
      ),
    ).toBe(true);
    expect(
      hasSessionWorkLeft(
        "learning",
        {
          status: "learning",
          dueAt: NOW + DAY_MS,
          lastReviewedAt: NOW,
        },
        NOW,
      ),
    ).toBe(false);
  });
});

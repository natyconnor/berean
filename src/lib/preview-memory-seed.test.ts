import { describe, expect, it } from "vitest";

import { getVerseRefBoundsErrorMessage } from "../../shared/verse-ref-validation";
import {
  isDueForLearning,
  isDueForReview,
  isLearningLocked,
  isReviewPhase,
} from "./memory-scheduler";
import {
  assertLearningLockGap,
  buildPreviewMemorySeed,
  countPreviewMemoryRoles,
} from "./preview-memory-seed";

const NOW = 1_700_000_000_000;

describe("preview memory seed", () => {
  const plan = buildPreviewMemorySeed(NOW);
  const counts = countPreviewMemoryRoles(plan.verses);

  it("covers every lifecycle the Memory UI needs to demo", () => {
    expect(counts.new).toBeGreaterThanOrEqual(1);
    expect(counts.learningRead).toBeGreaterThanOrEqual(1);
    expect(counts.learningGuided).toBeGreaterThanOrEqual(1);
    expect(counts.learningChallenge).toBeGreaterThanOrEqual(1);
    expect(counts.learningMemory).toBeGreaterThanOrEqual(1);
    expect(counts.learningLocked).toBeGreaterThanOrEqual(1);
    expect(counts.reviewDue).toBeGreaterThanOrEqual(2);
    expect(counts.reviewOverdue).toBeGreaterThanOrEqual(1);
    expect(counts.reviewLater).toBeGreaterThanOrEqual(1);
    expect(counts.masteredDue).toBeGreaterThanOrEqual(1);
    expect(counts.masteredLater).toBeGreaterThanOrEqual(1);
  });

  it("uses canonical verse refs the ESV path can load", () => {
    for (const verse of plan.verses) {
      expect(getVerseRefBoundsErrorMessage(verse.reference)).toBeNull();
    }
  });

  it("puts several review-phase verses in today's Review queue", () => {
    const due = plan.verses.filter((verse) =>
      isDueForReview(verse.schedule, NOW),
    );
    expect(due.length).toBeGreaterThanOrEqual(3);
    expect(due.some((verse) => verse.schedule.status === "mastered")).toBe(
      true,
    );
  });

  it("keeps future review-phase verses out of the due queue", () => {
    const later = plan.verses.filter(
      (verse) => verse.role === "reviewLater" || verse.role === "masteredLater",
    );
    expect(later.length).toBeGreaterThan(0);
    for (const verse of later) {
      expect(isReviewPhase(verse.schedule.status)).toBe(true);
      expect(isDueForReview(verse.schedule, NOW)).toBe(false);
    }
  });

  it("leaves in-progress learning available and locks the rest-day verse", () => {
    const available = plan.verses.filter((verse) =>
      isDueForLearning(
        { ...verse.schedule, lastReviewedAt: verse.lastReviewedAt },
        NOW,
      ),
    );
    const locked = plan.verses.filter(
      (verse) => verse.role === "learningLocked",
    );
    expect(available.length).toBeGreaterThanOrEqual(3);
    expect(locked).toHaveLength(1);
    const lockedVerse = locked[0];
    expect(lockedVerse).toBeDefined();
    if (!lockedVerse) return;
    expect(assertLearningLockGap(lockedVerse)).toBe(true);
    expect(
      isLearningLocked(
        { ...lockedVerse.schedule, lastReviewedAt: lockedVerse.lastReviewedAt },
        NOW,
      ),
    ).toBe(true);
    expect(
      isDueForLearning(
        { ...lockedVerse.schedule, lastReviewedAt: lockedVerse.lastReviewedAt },
        NOW,
      ),
    ).toBe(false);
  });

  it("builds packs that only reference seeded verse ids", () => {
    const ids = new Set(plan.verses.map((verse) => verse.id));
    expect(plan.packs.length).toBeGreaterThanOrEqual(3);
    for (const pack of plan.packs) {
      expect(pack.verseIds.length).toBeGreaterThan(0);
      for (const verseId of pack.verseIds) {
        expect(ids.has(verseId)).toBe(true);
      }
    }
  });

  it("seeds review history so dashboard charts are not empty", () => {
    expect(plan.reviews.length).toBeGreaterThan(10);
    expect(plan.reviews.every((review) => review.createdAt < NOW)).toBe(true);
  });
});

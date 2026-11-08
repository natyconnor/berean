import { describe, expect, it } from "vitest";

import { getVerseRefBoundsErrorMessage } from "../../shared/verse-ref-validation";
import {
  isDueForLearning,
  isDueForReview,
  isLearningLocked,
  isReviewPhase,
} from "./memory-scheduler";
import { isStaleVerse } from "./memory-stale";
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

  it("seeds every verse in Memory, with Up-next verses inside a pack", () => {
    expect(plan.verses.every((verse) => verse.inMemory)).toBe(true);
    const packed = new Set(plan.packs.flatMap((pack) => pack.verseIds));
    const upNext = plan.verses.filter(
      (verse) => verse.schedule.status === "new",
    );
    expect(upNext.length).toBeGreaterThan(0);
    for (const verse of upNext) {
      expect(packed.has(verse.id)).toBe(true);
    }
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

  function staleIds(seed: typeof plan): string[] {
    return seed.verses
      .filter((verse) =>
        isStaleVerse({
          status: verse.schedule.status,
          dueAt: verse.schedule.dueAt,
          intervalDays: verse.schedule.intervalDays,
          now: NOW,
          // Newest first, as `verseMemory.verseDetail` returns them.
          lastReviews: seed.reviews
            .filter((review) => review.verseId === verse.id)
            .sort((a, b) => b.createdAt - a.createdAt),
        }),
      )
      .map((verse) => verse.id);
  }

  it("seeds production exactly as before: no stale verse, every review 100% or 92%", () => {
    expect(buildPreviewMemorySeed(NOW, { staleFixture: false })).toEqual(plan);
    expect(staleIds(plan)).toEqual([]);
    const reviewPhase = new Set(
      plan.verses
        .filter((verse) => isReviewPhase(verse.schedule.status))
        .map((verse) => verse.id),
    );
    for (const review of plan.reviews) {
      if (!reviewPhase.has(review.verseId)) continue;
      expect(review.mode).toBe("review");
      expect([
        [100, "exact"],
        [92, "close"],
      ]).toContainEqual([review.accuracy, review.quality]);
    }
  });

  it("non-production seeds exactly two stale Memorized verses, one due and one not", () => {
    const fixture = buildPreviewMemorySeed(NOW, { staleFixture: true });
    expect(staleIds(fixture)).toEqual(["matthew-6-33", "joshua-1-9"]);
    const byId = new Map(fixture.verses.map((verse) => [verse.id, verse]));
    const due = byId.get("matthew-6-33");
    const notDue = byId.get("joshua-1-9");
    expect(due?.schedule.status).toBe("reviewing");
    expect(notDue?.schedule.status).toBe("reviewing");
    expect(due && isDueForReview(due.schedule, NOW)).toBe(true);
    expect(notDue && isDueForReview(notDue.schedule, NOW)).toBe(false);

    // Same verses, schedules, packs and row count; only the newest two
    // reviews of those two verses change, to 40% "off".
    expect(fixture.verses).toEqual(plan.verses);
    expect(fixture.packs).toEqual(plan.packs);
    expect(fixture.reviews).toHaveLength(plan.reviews.length);
    const changed = fixture.reviews.filter(
      (review, index) =>
        JSON.stringify(review) !== JSON.stringify(plan.reviews[index]),
    );
    expect(changed).toHaveLength(4);
    for (const review of changed) {
      expect(["matthew-6-33", "joshua-1-9"]).toContain(review.verseId);
      expect(review).toMatchObject({ accuracy: 40, quality: "off" });
    }
  });
});

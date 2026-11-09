import { describe, expect, it } from "vitest";

import type { Doc, Id } from "../../convex/_generated/dataModel";
import { passageReviewTries } from "../../convex/lib/passageMemory";
import { isStaleVerse } from "./memory-stale";

import { passageHeartSpans } from "./hearted-verse-coverage";
import { packAllowsPassageMode } from "./passage-eligibility";
import { requiredRepsFor } from "./memory-scheduler";
import { PASSAGE_MAX_ADDS_PER_DAY } from "./passage-frontier";
import { isPassageDueForLearning, isPassageDueForReview } from "./passage-due";
import {
  reducePassageSession,
  type PassageSessionState,
} from "./passage-session";
import {
  buildPreviewPassageSeed,
  testerMaintenancePacks,
  testerSectionRecitalPacks,
  testerStalePacks,
  type PreviewPassageSeedPack,
} from "./preview-passage-seed";
import { scopesEqual } from "./scope-equality";

const NOW = 1_700_000_000_000;
const TZ = 300;

describe("buildPreviewPassageSeed", () => {
  const plan = buildPreviewPassageSeed(NOW, TZ);

  it("covers the manual-test roles we need", () => {
    const roles = new Set(plan.packs.map((pack) => pack.role));
    expect(roles).toEqual(
      new Set([
        "readyToStart",
        "buildingDue",
        "budgetExhausted",
        "maintenanceDue",
      ]),
    );
  });

  it("keeps the ready-to-start pack passage-eligible and unstarted", () => {
    const ready = plan.packs.find((pack) => pack.role === "readyToStart");
    expect(ready).toBeDefined();
    if (!ready) return;
    expect(packAllowsPassageMode(ready.scope)).toBe(true);
    expect(ready.passage).toBeUndefined();
  });

  it("seeds a building pack that is learn-due today", () => {
    const building = plan.packs.find((pack) => pack.role === "buildingDue");
    expect(building?.passage).toBeDefined();
    const passage = building!.passage!;
    expect(
      isPassageDueForLearning(
        {
          status: passage.status,
          dueAt: passage.schedule.dueAt,
          pieces: passage.pieces,
          addsOnDay: passage.addsOnDay,
          addDayKey: passage.addDayKey,
        },
        NOW,
        TZ,
      ),
    ).toBe(true);
  });

  it("seeds a budget-exhausted pack at the daily introduce cap", () => {
    const budget = plan.packs.find((pack) => pack.role === "budgetExhausted");
    expect(budget?.passage?.addsOnDay).toBe(PASSAGE_MAX_ADDS_PER_DAY);
    expect(
      budget?.passage?.pieces.some((piece) => piece.attachment === "unreached"),
    ).toBe(true);
    expect(budget?.name).toMatch(/3 John/);
  });

  it("seeds a maintenance pack that is review-due now", () => {
    const maintenance = plan.packs.find(
      (pack) => pack.role === "maintenanceDue",
    );
    expect(maintenance?.passage).toBeDefined();
    const passage = maintenance!.passage!;
    expect(passage.pieces.every((piece) => piece.attachment === "solid")).toBe(
      true,
    );
    expect(
      isPassageDueForReview(
        { status: passage.status, dueAt: passage.schedule.dueAt },
        NOW,
      ),
    ).toBe(true);
  });

  it("uses a distinct scope for every sample pack", () => {
    for (let i = 0; i < plan.packs.length; i++) {
      for (let j = i + 1; j < plan.packs.length; j++) {
        expect(scopesEqual(plan.packs[i].scope, plan.packs[j].scope)).toBe(
          false,
        );
      }
    }
    expect(
      plan.packs.filter((pack) => /\bJude\b/.test(pack.name)),
    ).toHaveLength(1);
  });

  it("gives each seeded passage one heart span per chapter", () => {
    const seeded = plan.packs.filter((pack) => pack.passage);
    expect(seeded.length).toBeGreaterThan(0);
    for (const pack of seeded) {
      const pieces = pack.passage!.pieces;
      const chapters = new Set(
        pieces.map((piece) => `${piece.book}:${piece.chapter}`),
      );
      const hearts = passageHeartSpans(pieces);
      expect(hearts).toHaveLength(chapters.size);
      expect(hearts[0]?.startVerse).toBe(pieces[0]?.startVerse);
      expect(hearts.at(-1)?.endVerse).toBe(pieces.at(-1)?.endVerse);
    }
  });

  it("builds Jude pieces from auto-heart grouping (short chunks)", () => {
    const jude = plan.packs.find((pack) => pack.role === "buildingDue");
    expect(jude?.passage).toBeDefined();
    const pieces = jude!.passage!.pieces;
    expect(pieces.length).toBeGreaterThan(10);
    expect(
      pieces.every((piece) => piece.endVerse - piece.startVerse + 1 <= 4),
    ).toBe(true);
  });
});

describe("testerMaintenancePacks", () => {
  const base = buildPreviewPassageSeed(NOW, TZ).packs;

  it("adds nothing on a production deployment, so production seeds as before", () => {
    expect(testerMaintenancePacks(NOW, "prod:berean-123")).toEqual([]);
    expect(base.map((pack) => pack.name)).toEqual([
      "Sample · Psalm 1 (start passage)",
      "Sample · Jude (building)",
      "Sample · 3 John (budget used)",
      "Sample · Psalm 23 (maintenance due)",
    ]);
  });

  it.each(["dev:berean-123", "preview:berean-pr-364", undefined])(
    "adds three due maintenance passages on %s",
    (deployment) => {
      const extra = testerMaintenancePacks(NOW, deployment);
      expect(extra.map((pack) => pack.name)).toEqual([
        "Sample · Psalm 13 (maintenance due)",
        "Sample · Psalm 15 (maintenance due)",
        "Sample · Psalm 100 (maintenance due)",
      ]);
      for (const pack of extra) {
        expect(pack.role).toBe("maintenanceDue");
        expect(pack.scope.chapterRanges).toHaveLength(1);
        const passage = pack.passage!;
        expect(passage.status).toBe("reviewing");
        expect(passage.schedule).toMatchObject({
          status: "reviewing",
          dueAt: NOW,
          intervalDays: 1,
          stageReps: 0,
          consecutiveCorrect: 2,
        });
        expect(passage.pieces.length).toBeGreaterThanOrEqual(2);
        for (const piece of passage.pieces) {
          expect(piece).toMatchObject({ attachment: "solid", learnStage: 3 });
        }
        expect(passage).not.toHaveProperty("shakyVerses");
        expect(passage.pieces[0]?.startVerse).toBe(1);
        expect(
          isPassageDueForReview(
            { status: passage.status, dueAt: passage.schedule.dueAt },
            NOW,
          ),
        ).toBe(true);
      }
    },
  );

  it("keeps every sample scope distinct", () => {
    const all = [...base, ...testerMaintenancePacks(NOW, undefined)];
    for (let i = 0; i < all.length; i++) {
      for (let j = i + 1; j < all.length; j++) {
        expect(scopesEqual(all[i].scope, all[j].scope)).toBe(false);
      }
    }
  });

  it("drops the obsolete pass-then-fail advice from Psalm 23", () => {
    const psalm23 = base.find((pack) => pack.name.includes("Psalm 23"));
    expect(psalm23?.howToTry).not.toMatch(/fail once|both times/);
  });
});

describe("testerSectionRecitalPacks", () => {
  it("adds nothing on a production deployment", () => {
    expect(testerSectionRecitalPacks(NOW, "prod:berean-123")).toEqual([]);
  });

  it.each(["dev:berean-123", "preview:berean-pr-366", undefined])(
    "adds one Learning Psalm 112 on %s",
    (deployment) => {
      expect(
        testerSectionRecitalPacks(NOW, deployment).map((pack) => pack.name),
      ).toEqual(["Sample · Psalm 112 (section almost done)"]);
    },
  );

  const [pack] = testerSectionRecitalPacks(NOW, undefined);
  const passage = pack.passage!;
  const pieces = passage.pieces;
  const firstSection = pieces.filter((piece) => piece.sectionIndex === 0);
  const last = firstSection.at(-1)!;

  it("is a Learning passage, due to learn today, on a passage no other fixture uses", () => {
    expect(pack).toMatchObject({
      role: "sectionOneStepLeft",
      scope: { chapterRanges: [{ book: "Psalms", startChapter: 112 }] },
    });
    expect(passage.status).toBe("building");
    expect(
      isPassageDueForLearning(
        {
          status: passage.status,
          dueAt: passage.schedule.dueAt,
          pieces,
          addsOnDay: passage.addsOnDay,
          addDayKey: passage.addDayKey,
        },
        NOW,
        TZ,
      ),
    ).toBe(true);
    const others = [
      ...buildPreviewPassageSeed(NOW, TZ).packs,
      ...testerMaintenancePacks(NOW, undefined),
      ...testerStalePacks(NOW, undefined),
    ];
    for (const other of others) {
      expect(scopesEqual(other.scope, pack.scope)).toBe(false);
    }
    expect(pack.name).not.toMatch(/Psalm 1(17|31|33|34)\b/);
  });

  it("leaves its first section one From memory pass from complete", () => {
    expect(new Set(pieces.map((piece) => piece.sectionIndex)).size).toBe(2);
    expect(firstSection.length).toBeGreaterThanOrEqual(2);
    for (const piece of firstSection.slice(0, -1)) {
      expect(piece).toMatchObject({ attachment: "solid", learnStage: 3 });
    }
    expect(last).toMatchObject({
      attachment: "attached",
      learnStage: 3,
      stageReps: requiredRepsFor(3) - 1,
      dueAt: NOW,
    });
    for (const piece of pieces.slice(firstSection.length)) {
      expect(piece.attachment).toBe("unreached");
    }
  });

  it("reaches Section complete on that one pass, and not on a miss", () => {
    const state: PassageSessionState = {
      phase: "frontier",
      pieces,
      addsOnDay: passage.addsOnDay,
      now: NOW,
      tzOffsetMinutes: TZ,
    };
    const passed = reducePassageSession(state, {
      type: "attempt",
      accuracy: 100,
      now: NOW,
    });
    expect(passed.phase).toBe("section-complete");
    expect(passed.pieces[last.index]?.attachment).toBe("solid");

    const missed = reducePassageSession(state, {
      type: "attempt",
      accuracy: 50,
      now: NOW,
    });
    expect(missed.phase).not.toBe("section-complete");
  });
});

describe("testerStalePacks", () => {
  const PASSAGE = "passageMemory:1" as Id<"passageMemory">;

  /**
   * The seed logs each review row in order; `recentReviews` reads them back
   * newest first and the session runs the real stale check on them.
   */
  function staleNow(pack: PreviewPassageSeedPack): boolean {
    const passage = pack.passage!;
    const logged = (passage.reviews ?? []).map(
      (review, index): Doc<"passageReviews"> => ({
        _id: `passageReviews:${index}` as Id<"passageReviews">,
        _creationTime: index,
        userId: "users:1" as Id<"users">,
        packId: "packs:1" as Id<"packs">,
        passageMemoryId: PASSAGE,
        kind: "review",
        ...review,
      }),
    );
    const newestFirst = [...logged].sort(
      (a, b) => b._creationTime - a._creationTime,
    );
    return isStaleVerse({
      status: passage.status === "mastered" ? "mastered" : "reviewing",
      dueAt: passage.schedule.dueAt,
      intervalDays: passage.schedule.intervalDays,
      now: NOW,
      lastReviews: passageReviewTries(newestFirst, PASSAGE),
    });
  }

  it("adds nothing on a production deployment", () => {
    expect(testerStalePacks(NOW, "prod:berean-123")).toEqual([]);
  });

  it.each(["dev:berean-123", "preview:berean-pr-367", undefined])(
    "lands each fixture in its intended state on %s",
    (deployment) => {
      const packs = testerStalePacks(NOW, deployment);
      const states = packs.map((pack) => {
        const passage = pack.passage!;
        return {
          name: pack.name,
          status: passage.status,
          due: isPassageDueForReview(
            { status: passage.status, dueAt: passage.schedule.dueAt },
            NOW,
          ),
          stale: staleNow(pack),
          shakyVerses: passage.shakyVerses,
        };
      });
      expect(states).toEqual([
        {
          name: "Sample · Psalm 131 (stale, due)",
          status: "reviewing",
          due: true,
          stale: true,
          shakyVerses: [{ chapter: 131, verse: 2 }],
        },
        {
          name: "Sample · Psalm 133 (stale, not due)",
          status: "reviewing",
          due: false,
          stale: true,
          shakyVerses: [{ chapter: 133, verse: 3 }],
        },
        {
          name: "Sample · Psalm 134 (mastered, not due)",
          status: "mastered",
          due: false,
          stale: false,
          shakyVerses: [{ chapter: 134, verse: 2 }],
        },
      ]);
    },
  );

  it("is stale by misses, not by time, and every shaky verse is in the passage", () => {
    for (const pack of testerStalePacks(NOW, undefined)) {
      const passage = pack.passage!;
      // Never 7 days overdue: only the review history can make it stale.
      expect(NOW - passage.schedule.dueAt).toBeLessThan(7 * 86_400_000);
      expect(passage.reviews).toHaveLength(3);
      expect(
        passage.pieces.every((piece) => piece.attachment === "solid"),
      ).toBe(true);
      for (const key of passage.shakyVerses ?? []) {
        expect(
          passage.pieces.some(
            (piece) =>
              piece.chapter === key.chapter &&
              piece.startVerse <= key.verse &&
              key.verse <= piece.endVerse,
          ),
        ).toBe(true);
      }
    }
  });

  it("keeps every sample scope distinct from the other fixtures", () => {
    const all = [
      ...buildPreviewPassageSeed(NOW, TZ).packs,
      ...testerMaintenancePacks(NOW, undefined),
      ...testerStalePacks(NOW, undefined),
    ];
    for (let i = 0; i < all.length; i++) {
      for (let j = i + 1; j < all.length; j++) {
        expect(scopesEqual(all[i].scope, all[j].scope)).toBe(false);
      }
    }
  });
});

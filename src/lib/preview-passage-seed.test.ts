import { describe, expect, it } from "vitest";

import { passageHeartSpans } from "./hearted-verse-coverage";
import { packAllowsPassageMode } from "./passage-eligibility";
import { PASSAGE_MAX_ADDS_PER_DAY } from "./passage-frontier";
import { isPassageDueForLearning, isPassageDueForReview } from "./passage-due";
import { buildPreviewPassageSeed } from "./preview-passage-seed";
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

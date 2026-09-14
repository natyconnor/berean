import { describe, expect, it } from "vitest";

import { packAllowsPassageMode } from "./passage-eligibility";
import { PASSAGE_MAX_ADDS_PER_DAY } from "./passage-frontier";
import { isPassageDueForLearning, isPassageDueForReview } from "./passage-due";
import { buildPreviewPassageSeed } from "./preview-passage-seed";

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
        "collectionOnly",
      ]),
    );
  });

  it("keeps start/maintenance packs passage-eligible and multi-book ineligible", () => {
    const ready = plan.packs.find((pack) => pack.role === "readyToStart");
    const multi = plan.packs.find((pack) => pack.role === "collectionOnly");
    expect(ready).toBeDefined();
    expect(multi).toBeDefined();
    if (!ready || !multi) return;
    expect(packAllowsPassageMode(ready.scope)).toBe(true);
    expect(packAllowsPassageMode(multi.scope)).toBe(false);
    expect(ready.passage).toBeUndefined();
    expect(multi.passage).toBeUndefined();
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
});

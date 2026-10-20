import { describe, expect, it } from "vitest";

import { DAY_MS } from "@/lib/memory-scheduler";
import { packListSummary, type PackListSummary } from "@/lib/pack-list-summary";

import { packListSubtitle } from "./pack-list-subtitle";

/** Monday, Oct 12, 2026, 18:00 UTC. */
const NOW = Date.UTC(2026, 9, 12, 18);
const HOUR_MS = 60 * 60 * 1000;

function passage(
  extra: Partial<Extract<PackListSummary, { kind: "passage" }>>,
): PackListSummary {
  return {
    kind: "passage",
    status: "building",
    verseCount: 6,
    learnedVerses: 0,
    hasWorkToday: true,
    nextDueAt: NOW,
    masteryFraction: 0,
    ...extra,
  };
}

const subtitle = (summary: PackListSummary) =>
  packListSubtitle(summary, NOW, "UTC");

describe("packListSubtitle for passages", () => {
  it("counts learned verses while building, with today's work", () => {
    expect(subtitle(passage({ learnedVerses: 0 }))).toBe(
      "Learning · 0 of 6 verses learned · today",
    );
  });

  it("says more tomorrow when nothing is left today", () => {
    expect(
      subtitle(
        passage({
          learnedVerses: 4,
          hasWorkToday: false,
          nextDueAt: Date.UTC(2026, 9, 13, 6),
        }),
      ),
    ).toBe("Learning · 4 of 6 verses learned · more tomorrow");
  });

  it("asks to recite a memorized passage that is due", () => {
    expect(
      subtitle(
        passage({
          status: "reviewing",
          learnedVerses: 6,
          hasWorkToday: true,
          nextDueAt: NOW - HOUR_MS,
          masteryFraction: 0.22,
        }),
      ),
    ).toBe("Memorized · review today");
  });

  it("names the next recite and mastery when not due", () => {
    expect(
      subtitle(
        passage({
          status: "reviewing",
          learnedVerses: 6,
          hasWorkToday: false,
          nextDueAt: NOW + 3 * DAY_MS,
          masteryFraction: 0.22,
        }),
      ),
    ).toBe("Memorized · next review Thu · mastery 22%");
    expect(
      subtitle(
        passage({
          status: "reviewing",
          hasWorkToday: false,
          nextDueAt: NOW + 20 * DAY_MS,
          masteryFraction: 0.5,
        }),
      ),
    ).toBe("Memorized · next review Nov 1 · mastery 50%");
  });

  it("reads Mastered when mastered", () => {
    expect(subtitle(passage({ status: "mastered", hasWorkToday: false }))).toBe(
      "Mastered",
    );
  });

  it("never mixes learned and memorized into one due figure", () => {
    const line = subtitle(passage({ learnedVerses: 0, verseCount: 6 }));
    expect(line).not.toMatch(/memorized · due today/);
    expect(line).not.toMatch(/Passage ·/);
  });
});

describe("packListSubtitle for packs", () => {
  const member = (
    verseRefId: string,
    status: "new" | "learning" | "reviewing" | "mastered",
    dueAt: number,
  ) => ({ verseRefId, status, dueAt });

  it("keeps learned and mastered separate, plus today's work", () => {
    const summary = packListSummary(
      [
        member("a", "reviewing", NOW - HOUR_MS),
        member("b", "mastered", NOW + 30 * DAY_MS),
        member("c", "learning", NOW - HOUR_MS),
        member("d", "new", NOW),
        member("e", "new", NOW),
        member("f", "new", NOW),
      ],
      NOW,
    );
    // One review, one open learning step, two Up-next verses join today.
    expect(subtitle(summary)).toBe("2 of 6 learned · 1 mastered · 4 today");
  });

  it("drops the today count when there is nothing to do", () => {
    expect(
      subtitle(
        packListSummary([member("a", "reviewing", NOW + 2 * DAY_MS)], NOW),
      ),
    ).toBe("1 of 1 learned · 0 mastered");
  });

  it("says so for an empty pack", () => {
    expect(subtitle(packListSummary([], NOW))).toBe("No verses yet");
  });
});

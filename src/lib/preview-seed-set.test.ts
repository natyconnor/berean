import { describe, expect, it } from "vitest";

import {
  assertPreviewSeedSetAllowed,
  parsePreviewSeedTokens,
  resolvePreviewSeedSet,
} from "./preview-seed-set";

describe("parsePreviewSeedTokens", () => {
  it("splits comma-separated tokens and drops blanks", () => {
    expect(parsePreviewSeedTokens("john-3-16, sample-mix,,")).toEqual([
      "john-3-16",
      "sample-mix",
    ]);
  });

  it.each([undefined, "", " , ", 1, null])(
    "returns undefined for %o",
    (raw) => {
      expect(parsePreviewSeedTokens(raw)).toBeUndefined();
    },
  );
});

describe("resolvePreviewSeedSet", () => {
  it("a verse token brings only that verse, no packs", () => {
    const set = resolvePreviewSeedSet(["john-3-16"]);
    expect([...set.verseIds]).toEqual(["john-3-16"]);
    expect(set.packSlugs.size).toBe(0);
    expect(set.passagePackIds.size).toBe(0);
  });

  it("a verse pack token brings the pack and every verse it needs", () => {
    const set = resolvePreviewSeedSet(["sample-mix"]);
    expect([...set.packSlugs]).toEqual(["sample-mix"]);
    expect([...set.verseIds].sort()).toEqual(
      ["john-11-35", "psalm-23-1", "john-1-1", "john-3-16"].sort(),
    );
  });

  it("knows every verse pack slug", () => {
    const set = resolvePreviewSeedSet([
      "sample-review-queue",
      "sample-learning",
      "sample-mix",
    ]);
    expect(set.packSlugs.size).toBe(3);
  });

  it("knows the base and tester passage pack ids", () => {
    const ids = [
      "passage-ready-psalm-1",
      "passage-building-jude",
      "passage-budget-3-john",
      "passage-review-psalm-23",
      "passage-review-psalm-13",
      "passage-review-psalm-15",
      "passage-review-psalm-100",
      "passage-staleDue-psalm-131",
      "passage-staleNotDue-psalm-133",
      "passage-masteredNotDue-psalm-134",
      "passage-masteredNotDue-psalm-117",
      "passage-section-psalm-112",
      "passage-learning-refresh-psalm-121",
    ];
    const set = resolvePreviewSeedSet(ids);
    expect([...set.passagePackIds]).toEqual(ids);
    expect(set.verseIds.size).toBe(0);
  });

  it("fails on an unknown token, naming it", () => {
    expect(() => resolvePreviewSeedSet(["john-3-16", "john-99-1"])).toThrow(
      /unknown sample items: john-99-1/i,
    );
  });

  it("fails on an empty list", () => {
    expect(() => resolvePreviewSeedSet([])).toThrow();
  });
});

describe("assertPreviewSeedSetAllowed (F31)", () => {
  it("allows a small set only where the preview flag is set", () => {
    expect(() => assertPreviewSeedSetAllowed("1")).not.toThrow();
    expect(() => assertPreviewSeedSetAllowed("true")).not.toThrow();
  });

  it.each([undefined, "", "0", "false"])(
    "rejects production, dev and an unset flag (%o)",
    (flag) => {
      expect(() => assertPreviewSeedSetAllowed(flag)).toThrow(
        /only on preview deployments/i,
      );
    },
  );
});

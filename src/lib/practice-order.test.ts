import { describe, expect, it } from "vitest";

import {
  buildPracticeOrder,
  createSeededRandom,
  nextIndex,
  prevIndex,
} from "./practice-order";

describe("buildPracticeOrder", () => {
  const items = ["a", "b", "c", "d", "e"];

  it("returns the original order (as a copy) in in-order mode", () => {
    const result = buildPracticeOrder(items, "in-order");
    expect(result).toEqual(items);
    expect(result).not.toBe(items);
  });

  it("does not mutate the input array", () => {
    const original = [...items];
    buildPracticeOrder(items, "shuffle", 42);
    expect(items).toEqual(original);
  });

  it("is a permutation of the input in shuffle mode", () => {
    const result = buildPracticeOrder(items, "shuffle", 7);
    expect([...result].sort()).toEqual([...items].sort());
    expect(result).toHaveLength(items.length);
  });

  it("produces the same order for the same seed (determinism)", () => {
    const first = buildPracticeOrder(items, "shuffle", 123);
    const second = buildPracticeOrder(items, "shuffle", 123);
    expect(first).toEqual(second);
  });

  it("produces a different order for a different seed", () => {
    const withSeedA = buildPracticeOrder(items, "shuffle", 1);
    const withSeedB = buildPracticeOrder(items, "shuffle", 999);
    expect(withSeedA).not.toEqual(withSeedB);
  });

  it("handles empty and single-item lists without shuffling", () => {
    expect(buildPracticeOrder([], "shuffle", 5)).toEqual([]);
    expect(buildPracticeOrder(["only"], "shuffle", 5)).toEqual(["only"]);
  });
});

describe("createSeededRandom", () => {
  it("emits the same stream for the same seed", () => {
    const a = createSeededRandom(2024);
    const b = createSeededRandom(2024);
    const drawA = [a(), a(), a()];
    const drawB = [b(), b(), b()];
    expect(drawA).toEqual(drawB);
  });

  it("emits values within [0, 1)", () => {
    const random = createSeededRandom(1);
    for (let i = 0; i < 50; i += 1) {
      const value = random();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });
});

describe("nextIndex / prevIndex", () => {
  it("advances and wraps forward", () => {
    expect(nextIndex(0, 3)).toBe(1);
    expect(nextIndex(1, 3)).toBe(2);
    expect(nextIndex(2, 3)).toBe(0);
  });

  it("retreats and wraps backward", () => {
    expect(prevIndex(2, 3)).toBe(1);
    expect(prevIndex(1, 3)).toBe(0);
    expect(prevIndex(0, 3)).toBe(2);
  });

  it("is safe for empty lists", () => {
    expect(nextIndex(0, 0)).toBe(0);
    expect(prevIndex(0, 0)).toBe(0);
  });
});

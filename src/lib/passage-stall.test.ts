import { describe, expect, it } from "vitest";

import { diffWords } from "./diff-words";
import { repairStartIndex, stallPieceIndex } from "./passage-stall";

describe("stallPieceIndex", () => {
  it("maps the first non-typo error onto the piece that owns that word", () => {
    const actual = "one two three four five six seven eight";
    const typed = "one two three RED five six seven eight";
    const tokens = diffWords(typed, actual);
    expect(stallPieceIndex(tokens, [3, 3, 2])).toBe(1);
  });

  it("ignores typos and maps a later mismatch", () => {
    const actual = "alpha bravo charlie delta echo";
    const typed = "alpha bravvo charlie WRONG echo";
    const tokens = diffWords(typed, actual);
    expect(tokens.some((token) => token.status === "typo")).toBe(true);
    expect(stallPieceIndex(tokens, [2, 3])).toBe(1);
  });

  it("maps a missing word at the start of the second piece", () => {
    const tokens = diffWords("one two four five", "one two three four five");
    expect(stallPieceIndex(tokens, [2, 3])).toBe(1);
  });

  it("returns 0 when every token matches or the window is empty", () => {
    const tokens = diffWords("one two", "one two");
    expect(stallPieceIndex(tokens, [1, 1])).toBe(0);
    expect(stallPieceIndex([], [])).toBe(0);
  });
});

describe("repairStartIndex", () => {
  it("retries from one contiguous rope piece earlier without leaving the window", () => {
    expect(repairStartIndex([4, 5, 6], 0)).toBe(4);
    expect(repairStartIndex([4, 5, 6], 1)).toBe(4);
    expect(repairStartIndex([4, 5, 6], 2)).toBe(5);
  });

  it("retries from one rope piece earlier across a gapped window", () => {
    const gapped = [0, 2, 5];
    expect(repairStartIndex(gapped, 2)).toBe(2);
    expect(repairStartIndex(gapped, 1)).toBe(0);
    expect(repairStartIndex(gapped, 0)).toBe(0);
    expect(repairStartIndex(gapped, 2)).not.toBe(4);
    expect(repairStartIndex(gapped, 2)).not.toBe(1);
  });
});

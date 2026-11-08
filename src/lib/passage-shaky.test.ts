import { describe, expect, it } from "vitest";

import type { PassagePiece } from "./passage-pieces";
import {
  missedPieceIndexes,
  piecesAfterUnhintedTry,
  shakyFirstLettersHint,
} from "./passage-shaky";

function piece(index: number, shaky?: boolean): PassagePiece {
  return {
    index,
    book: "Psalms",
    chapter: 23,
    startVerse: index + 1,
    endVerse: index + 1,
    sectionIndex: 0,
    attachment: "solid",
    learnStage: 3,
    stageReps: 0,
    ...(shaky ? { shaky } : {}),
  };
}

describe("piecesAfterUnhintedTry", () => {
  it("marks each verse under 85% on its own in a counted try", () => {
    const next = piecesAfterUnhintedTry(
      [piece(0), piece(1), piece(2)],
      [100, 84, 59],
      true,
    );
    expect(next.map((item) => item.shaky === true)).toEqual([
      false,
      true,
      true,
    ]);
  });

  it("clears a shaky verse at 85%+ even in a practice-only try", () => {
    const next = piecesAfterUnhintedTry(
      [piece(0, true), piece(1, true)],
      [85, 84],
      false,
    );
    expect(next[0]?.shaky).toBeUndefined();
    expect(next[1]?.shaky).toBe(true);
  });

  it("never marks in a practice-only try", () => {
    const [next] = piecesAfterUnhintedTry([piece(0)], [10], false);
    expect(next?.shaky).toBeUndefined();
  });

  it("leaves a verse without text alone", () => {
    const pieces = [piece(0, true), piece(1)];
    expect(piecesAfterUnhintedTry(pieces, [null, null], true)).toEqual(pieces);
  });
});

describe("missedPieceIndexes", () => {
  it("lists verses under 85%", () => {
    expect([...missedPieceIndexes([100, 85, 84, null, 0])]).toEqual([2, 4]);
  });
});

describe("shakyFirstLettersHint", () => {
  const texts = ["The Lord is", "my shepherd;", "I shall"];

  it("shows first letters on targets only, blanks in place elsewhere", () => {
    expect(shakyFirstLettersHint(texts, new Set([1]))).toEqual([
      "___ ____ __",
      "m_ s_______;",
      "_ _____",
    ]);
  });

  it("reveals nothing when no verse is targeted", () => {
    expect(shakyFirstLettersHint(texts, new Set()).join(" ")).not.toMatch(
      /[a-z]/i,
    );
  });

  it("hints every verse when every verse is targeted", () => {
    expect(shakyFirstLettersHint(texts, new Set([0, 1, 2]))).toEqual([
      "T__ L___ i_",
      "m_ s_______;",
      "I s____",
    ]);
  });
});

import { describe, expect, it } from "vitest";

import { diffWords } from "./diff-words";
import { repairBlankRanges } from "./passage-stall";

/** `count` numbered words, "w0 w1 …", so a range reads off by index. */
function words(count: number, from = 0): string[] {
  return Array.from({ length: count }, (_, index) => `w${from + index}`);
}

function blanksFor(typed: string[], actual: string[]) {
  return repairBlankRanges(diffWords(typed.join(" "), actual.join(" ")));
}

describe("repairBlankRanges", () => {
  const window = words(30);

  it("blanks one missed phrase plus the 6 words before it (F1)", () => {
    const typed = window.map((word, index) =>
      index >= 14 && index < 17 ? "wrong" : word,
    );
    expect(blanksFor(typed, window)).toEqual([[8, 17]]);
  });

  it("blanks two separate spots, each with its own lead-in (F2)", () => {
    const typed = window.filter((_, index) => index !== 10 && index !== 25);
    expect(blanksFor(typed, window)).toEqual([
      [4, 11],
      [19, 26],
    ]);
  });

  it("blanks a whole missed verse plus its lead-in from the verse before (F3)", () => {
    const verse3 = words(10);
    const verse4 = words(8, 10);
    const verse5 = words(10, 18);
    const typed = [...verse3, ...verse5];
    // Verse 4 is words 10–17; its lead-in is the last 6 words of verse 3.
    expect(blanksFor(typed, [...verse3, ...verse4, ...verse5])).toEqual([
      [4, 18],
    ]);
  });

  it("keeps a lead-in inside the window at its start", () => {
    const typed = ["wrong", ...window.slice(3)];
    expect(blanksFor(typed, window)).toEqual([[0, 3]]);
  });

  it("joins spots 6 words apart or closer, and keeps them apart at 7", () => {
    const sixApart = window.map((word, index) =>
      index === 10 || index === 17 ? "wrong" : word,
    );
    expect(blanksFor(sixApart, window)).toEqual([[4, 18]]);
    const sevenApart = window.map((word, index) =>
      index === 10 || index === 18 ? "wrong" : word,
    );
    expect(blanksFor(sevenApart, window)).toEqual([
      [4, 11],
      [12, 19],
    ]);
  });

  it("blanks nothing for small typos or extra words, as grading ignores them", () => {
    const actual = ["shepherd", "pastures", "waters", "restores", "soul"];
    expect(
      blanksFor(["shepherd", "pastrues", "watres", "restores", "soul"], actual),
    ).toEqual([]);
    expect(
      blanksFor([...actual.slice(0, 2), "also", ...actual.slice(2)], actual),
    ).toEqual([]);
  });

  it("blanks nothing for an empty diff", () => {
    expect(repairBlankRanges([])).toEqual([]);
  });
});

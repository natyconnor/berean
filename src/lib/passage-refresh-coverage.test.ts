import { describe, expect, it } from "vitest";

import {
  passageRefreshCoverage,
  selectRefreshPieces,
  windowHintEscalation,
} from "./passage-refresh-coverage";

const pieces = [
  { index: 0, attachment: "solid" as const },
  { index: 1, attachment: "solid" as const },
  { index: 2, attachment: "learning" as const },
];

describe("passageRefreshCoverage", () => {
  it("covers the whole passage after a whole-passage miss or summary row", () => {
    expect(passageRefreshCoverage({ kind: "miss-whole" })).toEqual({
      scope: "all",
    });
    expect(passageRefreshCoverage({ kind: "summary-passage" })).toEqual({
      scope: "all",
    });
  });

  it("covers only the window after a partial test, warm-up, or join", () => {
    expect(
      passageRefreshCoverage({ kind: "miss-window", indexes: [1, 2] }),
    ).toEqual({ scope: "indexes", indexes: [1, 2] });
    expect(
      passageRefreshCoverage({ kind: "warmup-or-join", indexes: [0, 1] }),
    ).toEqual({ scope: "indexes", indexes: [0, 1] });
  });

  it("covers learned verses on a building passage menu Refresh", () => {
    expect(
      passageRefreshCoverage({
        kind: "menu",
        pieces,
        shakyIndexes: [1],
      }),
    ).toEqual({ scope: "indexes", indexes: [0, 1] });
  });

  it("covers shaky verses on a fully learned menu Refresh, or all if none are shaky", () => {
    const learned = pieces.map((piece) => ({
      ...piece,
      attachment: "solid" as const,
    }));
    expect(
      passageRefreshCoverage({
        kind: "menu",
        pieces: learned,
        shakyIndexes: [0, 2],
      }),
    ).toEqual({ scope: "indexes", indexes: [0, 2] });
    expect(
      passageRefreshCoverage({
        kind: "menu",
        pieces: learned,
        shakyIndexes: [],
      }),
    ).toEqual({ scope: "all" });
  });
});

describe("selectRefreshPieces", () => {
  it("falls back to every piece when the wanted indexes miss", () => {
    expect(
      selectRefreshPieces(pieces, { scope: "indexes", indexes: [9] }),
    ).toEqual(pieces);
  });
});

describe("windowHintEscalation", () => {
  it("never repeats the same hint", () => {
    expect(windowHintEscalation(0)).toBe("stage");
    expect(windowHintEscalation(1)).toBe("first-letters");
    expect(windowHintEscalation(2)).toBe("full");
    expect(windowHintEscalation(3)).toBe("full");
  });
});

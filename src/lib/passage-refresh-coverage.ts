import type { PieceAttachment } from "./passage-pieces";

/**
 * Where a passage Refresh starts decides which verses it covers. One table,
 * not a chain of ifs at each entry point.
 */
export type PassageRefreshSource =
  | { kind: "miss-whole" }
  | { kind: "miss-window"; indexes: readonly number[] }
  | { kind: "warmup-or-join"; indexes: readonly number[] }
  | {
      kind: "menu";
      pieces: readonly { attachment: PieceAttachment; index: number }[];
      shakyIndexes: readonly number[];
    }
  | { kind: "summary-passage" };

export type PassageRefreshCoverage =
  { scope: "all" } | { scope: "indexes"; indexes: number[] };

export function passageRefreshCoverage(
  source: PassageRefreshSource,
): PassageRefreshCoverage {
  switch (source.kind) {
    case "miss-whole":
    case "summary-passage":
      return { scope: "all" };
    case "miss-window":
    case "warmup-or-join":
      return { scope: "indexes", indexes: [...source.indexes] };
    case "menu": {
      const learned = source.pieces.filter(
        (piece) => piece.attachment === "solid",
      );
      const building =
        learned.length > 0 && learned.length < source.pieces.length;
      if (building) {
        return {
          scope: "indexes",
          indexes: learned.map((piece) => piece.index),
        };
      }
      if (source.shakyIndexes.length > 0) {
        return { scope: "indexes", indexes: [...source.shakyIndexes] };
      }
      return { scope: "all" };
    }
  }
}

export function selectRefreshPieces<T extends { index: number }>(
  pieces: readonly T[],
  coverage: PassageRefreshCoverage,
): T[] {
  if (coverage.scope === "all") return [...pieces];
  const wanted = new Set(coverage.indexes);
  const selected = pieces.filter((piece) => wanted.has(piece.index));
  return selected.length > 0 ? selected : [...pieces];
}

export type WindowHintEscalation = "stage" | "first-letters" | "full";

/** After the 1st miss, first letters for the whole window. After the 2nd, full words. */
export function windowHintEscalation(missCount: number): WindowHintEscalation {
  if (missCount <= 0) return "stage";
  if (missCount === 1) return "first-letters";
  return "full";
}

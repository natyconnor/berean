import type { PassagePiece } from "./passage-pieces";
import { PASSAGE_PASS_ACCURACY } from "./passage-frontier";
import { maskVerseText } from "./verse-hint";

/**
 * Shaky verses on a Memorized passage. Each verse is scored on its own inside
 * a whole-passage recital: under 85% in a counted try marks it shaky, and 85%+
 * in any later unhinted try clears it. The passage schedule still follows the
 * overall score.
 */

/** Pieces scoring under 85% on their own. */
export function missedPieceIndexes(
  accuracies: readonly (number | null)[],
): Set<number> {
  const missed = new Set<number>();
  accuracies.forEach((accuracy, index) => {
    if (accuracy !== null && accuracy < PASSAGE_PASS_ACCURACY)
      missed.add(index);
  });
  return missed;
}

/**
 * Shaky flags after an unhinted try. 85%+ clears a verse; under 85% marks it
 * only when the try counted as the review.
 */
export function piecesAfterUnhintedTry<T extends PassagePiece>(
  pieces: readonly T[],
  accuracies: readonly (number | null)[],
  counted: boolean,
): T[] {
  return pieces.map((piece, index) => {
    const accuracy = accuracies[index];
    if (accuracy === null || accuracy === undefined) return piece;
    if (accuracy >= PASSAGE_PASS_ACCURACY) return withoutShaky(piece);
    return counted ? { ...piece, shaky: true } : piece;
  });
}

function withoutShaky<T extends PassagePiece>(piece: T): T {
  if (piece.shaky === undefined) return piece;
  const next = { ...piece };
  delete next.shaky;
  return next;
}

/**
 * First letters on `targets` only, every other word blank in place, joined
 * like the passage text. No target means nothing is revealed.
 */
export function shakyFirstLettersHint(
  texts: readonly string[],
  targets: ReadonlySet<number>,
): string[] {
  return texts.map((text, index) =>
    maskVerseText(text, targets.has(index) ? "first-letters" : "hidden")
      .map((token) => token.text)
      .join(""),
  );
}

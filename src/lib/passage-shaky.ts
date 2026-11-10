import { PASSAGE_PASS_ACCURACY } from "./passage-frontier";
import { halfFirstLetters, maskVerseText } from "./verse-hint";

/**
 * Shaky verses on a Memorized passage. Each verse is scored on its own inside
 * a whole-passage recital, even inside a multi-verse learning piece: under 85%
 * in a counted try marks it shaky, and 85%+ in any later unhinted try clears
 * it. The passage schedule still follows the overall score.
 */

/** One verse of a passage. A passage is one book, so chapter + verse is unique. */
export type PassageVerseKey = { chapter: number; verse: number };

/** A verse's own score in one whole-passage try. */
export type PassageVerseScore = PassageVerseKey & { accuracy: number };

function sameVerse(a: PassageVerseKey, b: PassageVerseKey): boolean {
  return a.chapter === b.chapter && a.verse === b.verse;
}

/** Verses scoring under 85% on their own. */
export function missedVerses(
  scores: readonly PassageVerseScore[],
): PassageVerseKey[] {
  return scores
    .filter((score) => score.accuracy < PASSAGE_PASS_ACCURACY)
    .map(({ chapter, verse }) => ({ chapter, verse }));
}

/**
 * Shaky verses after an unhinted try. 85%+ clears a verse; under 85% marks it
 * only when the try counted as the review. Verses the try did not score stay
 * as they were.
 */
export function shakyAfterUnhintedTry(
  shaky: readonly PassageVerseKey[],
  scores: readonly PassageVerseScore[],
  counted: boolean,
): PassageVerseKey[] {
  const kept = shaky.filter(
    (key) =>
      !scores.some(
        (score) =>
          sameVerse(score, key) && score.accuracy >= PASSAGE_PASS_ACCURACY,
      ),
  );
  if (!counted) return kept;
  return [
    ...kept,
    ...missedVerses(scores).filter(
      (key) => !kept.some((other) => sameVerse(other, key)),
    ),
  ];
}

/**
 * First letters on `targets` only, every other word blank in place. One
 * masked text per verse, so a hint never spills onto a neighbouring verse in
 * the same piece. A First letters step is never all blanks: with no target
 * among `verses`, every verse is hinted. With `random`, each hinted verse gets
 * its own random half of first letters ({@link halfFirstLetters}) instead of
 * one on every word.
 */
export function shakyFirstLettersHint(
  verses: ReadonlyArray<PassageVerseKey & { text: string }>,
  targets: readonly PassageVerseKey[],
  random?: () => number,
): string[] {
  const targeted = (verse: PassageVerseKey) =>
    targets.some((key) => sameVerse(key, verse));
  const hintAll = !verses.some(targeted);
  return verses.map((verse) => {
    const tokens = !(hintAll || targeted(verse))
      ? maskVerseText(verse.text, "hidden")
      : random
        ? halfFirstLetters(verse.text, random)
        : maskVerseText(verse.text, "first-letters");
    return tokens.map((token) => token.text).join("");
  });
}

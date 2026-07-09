import {
  MAX_LEARN_STAGE,
  SUPPORT_BANDS,
  type SupportBand,
} from "./memory-scheduler";

export type HintStage = "full" | "first-letters" | "cloze" | "hidden";

export interface HintToken {
  /** Display string for this token at the current stage. */
  text: string;
  /** Whether this token is a maskable word instead of punctuation or space. */
  word: boolean;
  /** True when the word is hidden or partially blanked at this stage. */
  masked: boolean;
}

/** Per-rep controls for how sparse and how shuffled cloze first-letter hints are. */
export interface MaskOptions {
  /** 0..1 fraction of words that keep a first-letter hint. */
  density?: number;
  /** Per-rep seed so the hinted subset differs (deterministically) each rep. */
  seed?: number;
}

const WORD_PATTERN = /[\p{L}\p{N}]+(?:['\u2019][\p{L}\p{N}]+)*/uy;
const TOKEN_PATTERN =
  /[\p{L}\p{N}]+(?:['\u2019][\p{L}\p{N}]+)*|[^\p{L}\p{N}]+/gu;
const BLANK = "_";
const MIN_CLOZE_FIRST_LETTER_PERCENT = 25;
const MAX_CLOZE_FIRST_LETTER_PERCENT = 50;

function isWordToken(token: string): boolean {
  WORD_PATTERN.lastIndex = 0;
  return WORD_PATTERN.test(token);
}

function maskFirstLetters(word: string): string {
  const characters = Array.from(word);
  if (characters.length <= 1) return characters[0] ?? "";
  return `${characters[0]}${BLANK.repeat(characters.length - 1)}`;
}

function stableHash(input: string): number {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/**
 * Default number of first-letter hints when no explicit density is given:
 * a deterministic count between 25% and 50% of the words, keyed off the text.
 */
function defaultClozeTargetCount(text: string, wordCount: number): number {
  const maxCount = Math.floor(
    (wordCount * MAX_CLOZE_FIRST_LETTER_PERCENT) / 100,
  );
  const minCount = Math.min(
    maxCount,
    Math.ceil((wordCount * MIN_CLOZE_FIRST_LETTER_PERCENT) / 100),
  );
  return maxCount === minCount
    ? maxCount
    : minCount + (stableHash(text) % (maxCount - minCount + 1));
}

function getClozeFirstLetterIndices(
  text: string,
  words: ReadonlyArray<string>,
  options?: MaskOptions,
): ReadonlySet<number> {
  const targetCount =
    options?.density === undefined
      ? defaultClozeTargetCount(text, words.length)
      : Math.max(
          0,
          Math.min(words.length, Math.round(options.density * words.length)),
        );

  const seed = options?.seed;

  return new Set(
    words
      .map((word, index) => ({
        index,
        // Default (no seed) keeps the original word-keyed ranking byte-for-byte;
        // a supplied seed reshuffles the subset while staying deterministic.
        rank:
          seed === undefined
            ? stableHash(`${text}\u0000${index}\u0000${word}`)
            : stableHash(`${text}\u0000${index}\u0000${seed}\u0000${word}`),
      }))
      .sort((left, right) => left.rank - right.rank)
      .slice(0, targetCount)
      .map((item) => item.index),
  );
}

/**
 * Like {@link getClozeFirstLetterIndices} but with a minimum-1 guard for the
 * Guided scaffold fade: if `density > 0` and rounding produces an empty set on
 * a very short verse, force-select the top-ranked word so at least one word
 * always gets a first-letter scaffold.
 *
 * This guard is intentionally applied to the `first-letters` stage only; cloze
 * (Challenge) keeps its existing rounding behavior.
 */
function getFirstLetterScaffoldIndices(
  text: string,
  words: ReadonlyArray<string>,
  density: number,
  seed: number | undefined,
): ReadonlySet<number> {
  const indices = getClozeFirstLetterIndices(text, words, { density, seed });
  if (indices.size === 0 && density > 0 && words.length > 0) {
    // Math.round() rounded down to 0 — guarantee at least one scaffold.
    return getClozeFirstLetterIndices(text, words, {
      density: 1 / words.length,
      seed,
    });
  }
  return indices;
}

export function maskVerseText(
  text: string,
  stage: HintStage,
  options?: MaskOptions,
): HintToken[] {
  const matches = text.match(TOKEN_PATTERN) ?? [];
  const wordTokens = matches.filter(isWordToken);
  const clozeFirstLetterIndices =
    stage === "cloze"
      ? getClozeFirstLetterIndices(text, wordTokens, options)
      : new Set<number>();

  // For first-letters with an explicit density below 1.0: only the selected
  // subset gets the first-letter scaffold; unselected words stay fully visible
  // (masked: false). density undefined or >= 1 → all words scaffolded
  // (original byte-for-byte behavior).
  // Inline condition lets TypeScript narrow `options.density` to `number`.
  const firstLetterScaffoldIndices: ReadonlySet<number> =
    stage === "first-letters" &&
    options?.density !== undefined &&
    options.density < 1.0
      ? getFirstLetterScaffoldIndices(
          text,
          wordTokens,
          options.density,
          options.seed,
        )
      : new Set<number>();

  const partialFirstLetters =
    stage === "first-letters" &&
    options?.density !== undefined &&
    options.density < 1.0;

  let wordIndex = 0;

  return matches.map((token) => {
    const word = isWordToken(token);
    if (!word) {
      return { text: token, word: false, masked: false };
    }

    const currentWordIndex = wordIndex;
    wordIndex += 1;

    switch (stage) {
      case "full":
        return { text: token, word: true, masked: false };
      case "first-letters":
        if (partialFirstLetters) {
          return firstLetterScaffoldIndices.has(currentWordIndex)
            ? { text: maskFirstLetters(token), word: true, masked: true }
            : { text: token, word: true, masked: false };
        }
        return { text: maskFirstLetters(token), word: true, masked: true };
      case "cloze": {
        const firstLetterHint = clozeFirstLetterIndices.has(currentWordIndex);
        return {
          text: firstLetterHint
            ? maskFirstLetters(token)
            : BLANK.repeat(Array.from(token).length),
          word: true,
          masked: true,
        };
      }
      case "hidden":
        return {
          text: BLANK.repeat(Array.from(token).length),
          word: true,
          masked: true,
        };
    }
  });
}

/**
 * Lerp density from `densityStart` to `densityEnd` across the band's required
 * reps. A single-rep band (denominator = 0) holds at `densityStart`.
 */
function lerpBandDensity(band: SupportBand, stageReps: number): number {
  const start = band.densityStart ?? 0;
  const end = band.densityEnd ?? 0;
  const denominator = band.requiredReps - 1;
  const progress = denominator <= 0 ? 0 : stageReps / denominator;
  return start + (end - start) * progress;
}

/**
 * Map a learner's position in the learning phase to the hint stage plus the
 * density/seed a rep should use. Bands are the single source of truth
 * ({@link SUPPORT_BANDS}); `learnStage` indexes into them.
 *
 * - `read` (stage 0) -> full text, no hints
 * - `guided` (stage 1) -> first-letter scaffold that fades from `densityStart`
 *   (0.25, mostly visible) to `densityEnd` (1.0, fully scaffolded) across reps;
 *   reshuffled per rep via `seed = stageReps`
 * - `challenge` (stage 2) -> cloze that fades from `densityStart` to
 *   `densityEnd` across the band, reshuffled per rep via `seed = stageReps`
 * - `memory` (stage 3) -> fully hidden
 */
export function hintForProgress(
  learnStage: number,
  stageReps: number,
): { stage: HintStage; density: number; seed: number } {
  const clampedStage = Math.max(0, Math.min(MAX_LEARN_STAGE, learnStage));
  const band = SUPPORT_BANDS[clampedStage];

  switch (band.key) {
    case "read":
      return { stage: "full", density: band.densityStart ?? 0, seed: 0 };
    case "guided": {
      const density = lerpBandDensity(band, stageReps);
      return { stage: "first-letters", density, seed: stageReps };
    }
    case "challenge": {
      const density = lerpBandDensity(band, stageReps);
      return { stage: "cloze", density, seed: stageReps };
    }
    case "memory":
      return { stage: "hidden", density: band.densityStart ?? 0, seed: 0 };
  }
}

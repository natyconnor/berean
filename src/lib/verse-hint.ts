export type HintStage = "full" | "first-letters" | "cloze" | "hidden";

export interface HintToken {
  /** Display string for this token at the current stage. */
  text: string;
  /** Whether this token is a maskable word instead of punctuation or space. */
  word: boolean;
  /** True when the word is hidden or partially blanked at this stage. */
  masked: boolean;
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

function getClozeFirstLetterIndices(
  text: string,
  words: ReadonlyArray<string>,
): ReadonlySet<number> {
  const maxCount = Math.floor(
    (words.length * MAX_CLOZE_FIRST_LETTER_PERCENT) / 100,
  );
  const minCount = Math.min(
    maxCount,
    Math.ceil((words.length * MIN_CLOZE_FIRST_LETTER_PERCENT) / 100),
  );
  const targetCount =
    maxCount === minCount
      ? maxCount
      : minCount + (stableHash(text) % (maxCount - minCount + 1));

  return new Set(
    words
      .map((word, index) => ({
        index,
        rank: stableHash(`${text}\u0000${index}\u0000${word}`),
      }))
      .sort((left, right) => left.rank - right.rank)
      .slice(0, targetCount)
      .map((item) => item.index),
  );
}

export function maskVerseText(text: string, stage: HintStage): HintToken[] {
  const matches = text.match(TOKEN_PATTERN) ?? [];
  const wordTokens = matches.filter(isWordToken);
  const clozeFirstLetterIndices =
    stage === "cloze"
      ? getClozeFirstLetterIndices(text, wordTokens)
      : new Set<number>();
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

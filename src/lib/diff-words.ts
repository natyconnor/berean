export type DiffStatus = "match" | "mismatch" | "missing" | "extra";

export interface DiffToken {
  /** The original visible text from either typed or actual (whichever this token represents). */
  text: string;
  status: DiffStatus;
}

const TRIM_PUNCT_PATTERN =
  /^[.,;:!?"'()[\]\u2018\u2019\u201C\u201D]+|[.,;:!?"'()[\]\u2018\u2019\u201C\u201D]+$/g;

function normalize(word: string): string {
  return word.toLowerCase().replace(TRIM_PUNCT_PATTERN, "");
}

function tokenize(input: string): string[] {
  const trimmed = input.trim();
  if (trimmed.length === 0) return [];
  return trimmed.split(/\s+/);
}

export function diffWords(typed: string, actual: string): DiffToken[] {
  if (typed.trim().length === 0) return [];

  const typedWords = tokenize(typed);
  const actualWords = tokenize(actual);

  const typedNorm: string[] = [];
  for (let i = 0; i < typedWords.length; i++) {
    typedNorm.push(normalize(typedWords[i]));
  }
  const actualNorm: string[] = [];
  for (let j = 0; j < actualWords.length; j++) {
    actualNorm.push(normalize(actualWords[j]));
  }

  if (typedWords.length === actualWords.length) {
    const tokens: DiffToken[] = [];
    for (let i = 0; i < actualWords.length; i++) {
      const status: DiffStatus =
        typedNorm[i] === actualNorm[i] ? "match" : "mismatch";
      tokens.push({ text: actualWords[i], status });
    }
    return tokens;
  }

  const m = typedWords.length;
  const n = actualWords.length;
  const dp: number[][] = [];
  for (let i = 0; i <= m; i++) {
    const row: number[] = [];
    for (let j = 0; j <= n; j++) {
      row.push(0);
    }
    dp.push(row);
  }
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (typedNorm[i - 1] === actualNorm[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  const tokens: DiffToken[] = [];
  let i = 0;
  let j = 0;
  while (i < m && j < n) {
    if (typedNorm[i] === actualNorm[j]) {
      tokens.push({ text: actualWords[j], status: "match" });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      tokens.push({ text: typedWords[i], status: "extra" });
      i++;
    } else {
      tokens.push({ text: actualWords[j], status: "missing" });
      j++;
    }
  }
  while (i < m) {
    tokens.push({ text: typedWords[i], status: "extra" });
    i++;
  }
  while (j < n) {
    tokens.push({ text: actualWords[j], status: "missing" });
    j++;
  }
  return tokens;
}

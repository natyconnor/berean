export type DiffStatus = "match" | "mismatch" | "missing" | "extra";

export interface DiffToken {
  /** The original visible text from whichever side this token represents. */
  text: string;
  /** The expected word when this token represents a typed word that differs. */
  expectedText?: string;
  status: DiffStatus;
}

type AlignmentOperation = DiffStatus | null;

interface AlignmentCell {
  cost: number;
  matches: number;
  operation: AlignmentOperation;
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

function preferCandidate(
  current: AlignmentCell,
  candidate: AlignmentCell,
): AlignmentCell {
  if (candidate.cost < current.cost) return candidate;
  if (candidate.cost > current.cost) return current;
  if (candidate.matches > current.matches) return candidate;
  return current;
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

  const m = typedWords.length;
  const n = actualWords.length;

  const dp: AlignmentCell[][] = [];
  for (let i = 0; i <= m; i++) {
    const row: AlignmentCell[] = [];
    for (let j = 0; j <= n; j++) {
      row.push({ cost: 0, matches: 0, operation: null });
    }
    dp.push(row);
  }

  for (let i = 1; i <= m; i++) {
    dp[i][0] = { cost: i, matches: 0, operation: "extra" };
  }
  for (let j = 1; j <= n; j++) {
    dp[0][j] = { cost: j, matches: 0, operation: "missing" };
  }

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const isMatch = typedNorm[i - 1] === actualNorm[j - 1];
      const diagonal = dp[i - 1][j - 1];
      let best: AlignmentCell = {
        cost: diagonal.cost + (isMatch ? 0 : 2),
        matches: diagonal.matches + (isMatch ? 1 : 0),
        operation: isMatch ? "match" : "mismatch",
      };

      const extra = dp[i - 1][j];
      best = preferCandidate(best, {
        cost: extra.cost + 1,
        matches: extra.matches,
        operation: "extra",
      });

      const missing = dp[i][j - 1];
      best = preferCandidate(best, {
        cost: missing.cost + 1,
        matches: missing.matches,
        operation: "missing",
      });

      dp[i][j] = best;
    }
  }

  const tokens: DiffToken[] = [];
  let i = m;
  let j = n;
  while (i > 0 || j > 0) {
    const operation = dp[i][j].operation;
    if (operation === "match") {
      tokens.push({ text: actualWords[j - 1], status: "match" });
      i--;
      j--;
    } else if (operation === "mismatch") {
      tokens.push({
        text: typedWords[i - 1],
        expectedText: actualWords[j - 1],
        status: "mismatch",
      });
      i--;
      j--;
    } else if (operation === "extra") {
      tokens.push({ text: typedWords[i - 1], status: "extra" });
      i--;
    } else if (operation === "missing") {
      tokens.push({ text: actualWords[j - 1], status: "missing" });
      j--;
    } else {
      break;
    }
  }

  tokens.reverse();
  return tokens;
}

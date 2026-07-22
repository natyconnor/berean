export interface EsvVerse {
  number: number;
  text: string;
  /** Section heading that immediately precedes this verse, when present. */
  heading?: string;
}

export interface EsvChapterData {
  canonical: string;
  verses: EsvVerse[];
  copyright: string;
}

/** Bumped when cached chapter shape changes (e.g. headings). */
const CACHE_PREFIX = "esv_cache_v2_";

function parseStoredJson(value: string): unknown {
  return JSON.parse(value) as unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object";
}

function asNonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function isEsvVerse(value: unknown): value is EsvVerse {
  if (!isRecord(value)) return false;
  if (typeof value.number !== "number" || typeof value.text !== "string") {
    return false;
  }
  if (value.heading !== undefined && typeof value.heading !== "string") {
    return false;
  }
  return true;
}

export function isEsvChapterData(value: unknown): value is EsvChapterData {
  if (!isRecord(value)) return false;
  return (
    typeof value.canonical === "string" &&
    typeof value.copyright === "string" &&
    Array.isArray(value.verses) &&
    value.verses.every(isEsvVerse)
  );
}

export function getCachedPassage(query: string): EsvChapterData | null {
  try {
    const cached = sessionStorage.getItem(`${CACHE_PREFIX}${query}`);
    if (!cached) return null;
    const parsed = parseStoredJson(cached);
    return isEsvChapterData(parsed) ? parsed : null;
  } catch {
    // ignore
  }
  return null;
}

export function setCachedPassage(query: string, data: EsvChapterData): void {
  try {
    sessionStorage.setItem(`${CACHE_PREFIX}${query}`, JSON.stringify(data));
  } catch {
    // ignore — sessionStorage might be full
  }
}

function isPassageReferenceLine(line: string, canonical: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return false;
  const canonicalBase = canonical.replace(/:\d[\d\s:;,-]*$/, "").trim();
  if (
    (canonicalBase.length > 0 && trimmed === canonicalBase) ||
    trimmed === canonical.trim()
  ) {
    return true;
  }
  return /^[1-3]?\s?[A-Za-z]+(?:\s+[A-Za-z]+)*\s+\d+$/.test(trimmed);
}

function looksLikeSectionHeading(block: string): boolean {
  const trimmed = block.trim();
  if (!trimmed || trimmed.length > 120) return false;
  if (trimmed.includes("[")) return false;
  if (/^(Scripture quotations|ESV)/i.test(trimmed)) return false;
  if (/^[a-z]/.test(trimmed)) return false;
  const lines = trimmed.split("\n");
  if (
    lines.some(
      (line) =>
        line.length > 0 && (line.startsWith(" ") || line.startsWith("\t")),
    )
  ) {
    return false;
  }
  return true;
}

function extractTrailingHeading(raw: string): {
  text: string;
  trailingHeading: string | null;
} {
  const trimmedEnd = raw.replace(/\s+$/, "");
  const parts = trimmedEnd.split(/\n\n+/);
  if (parts.length < 2) {
    return { text: trimmedEnd.trim(), trailingHeading: null };
  }
  const last = parts[parts.length - 1] ?? "";
  if (looksLikeSectionHeading(last)) {
    return {
      text: parts.slice(0, -1).join("\n\n").trim(),
      trailingHeading: last.trim(),
    };
  }
  return { text: trimmedEnd.trim(), trailingHeading: null };
}

function extractLeadingHeading(
  interstitial: string,
  canonical: string,
): string | null {
  const lines = interstitial
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  const headingLines: string[] = [];
  for (const line of lines) {
    if (isPassageReferenceLine(line, canonical)) continue;
    if (looksLikeSectionHeading(line)) {
      headingLines.push(line);
    }
  }
  return headingLines.length > 0 ? headingLines.join("\n") : null;
}

export function parsePassageIntoVerses(
  passageText: string,
  canonical = "",
): EsvVerse[] {
  const verses: EsvVerse[] = [];
  const regex = /\[(\d+)\]\s*/g;
  let match: RegExpExecArray | null;
  const positions: Array<{
    number: number;
    index: number;
    matchLength: number;
  }> = [];

  while ((match = regex.exec(passageText)) !== null) {
    positions.push({
      number: parseInt(match[1]),
      index: match.index + match[0].length,
      matchLength: match[0].length,
    });
  }

  let pendingHeading: string | null = null;
  if (positions.length > 0) {
    const first = positions[0];
    const beforeFirst = passageText.substring(
      0,
      first.index - first.matchLength,
    );
    pendingHeading = extractLeadingHeading(beforeFirst, canonical);
  }

  for (let i = 0; i < positions.length; i++) {
    const start = positions[i].index;
    const end =
      i + 1 < positions.length
        ? positions[i + 1].index - positions[i + 1].matchLength
        : passageText.length;
    const { text, trailingHeading } = extractTrailingHeading(
      passageText.substring(start, end),
    );
    const verse: EsvVerse = { number: positions[i].number, text };
    if (pendingHeading) {
      verse.heading = pendingHeading;
    }
    verses.push(verse);
    pendingHeading = trailingHeading;
  }

  return verses;
}

export function parseEsvResponse(raw: unknown): EsvChapterData {
  const value = isRecord(raw) ? raw : {};
  const passages = Array.isArray(value.passages)
    ? value.passages.filter(
        (entry): entry is string => typeof entry === "string",
      )
    : [];
  const passageText = passages[0] ?? "";

  const defaultCopyright =
    "Scripture quotations are from the ESV\u00AE Bible (The Holy Bible, English Standard Version\u00AE), \u00A9 2001 by Crossway, a publishing ministry of Good News Publishers. Used by permission. All rights reserved.";

  const copyrightMatch = passageText.match(
    /\n\n\s*(Scripture quotations.*|ESV.*)$/s,
  );
  const copyright = copyrightMatch?.[1]?.trim() ?? defaultCopyright;

  const textWithoutCopyright = copyrightMatch
    ? passageText.substring(0, copyrightMatch.index).trim()
    : passageText.trim();

  const canonical = asNonEmptyString(value.canonical) ?? "";

  return {
    canonical,
    verses: parsePassageIntoVerses(textWithoutCopyright, canonical),
    copyright,
  };
}

/** Narrow full-chapter ESV data to an inclusive verse range (for previews). */
export function sliceEsvChapterToVerseRange(
  chapter: EsvChapterData,
  startVerse: number,
  endVerse: number,
): EsvChapterData {
  const lo = Math.min(startVerse, endVerse);
  const hi = Math.max(startVerse, endVerse);
  return {
    ...chapter,
    verses: chapter.verses.filter((v) => v.number >= lo && v.number <= hi),
  };
}

export interface EsvVerse {
  number: number;
  text: string;
}

export interface EsvChapterData {
  canonical: string;
  verses: EsvVerse[];
  copyright: string;
}

const CACHE_PREFIX = "esv_cache_";

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
  return typeof value.number === "number" && typeof value.text === "string";
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

export function parsePassageIntoVerses(passageText: string): EsvVerse[] {
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

  for (let i = 0; i < positions.length; i++) {
    const start = positions[i].index;
    const end =
      i + 1 < positions.length
        ? positions[i + 1].index - positions[i + 1].matchLength
        : passageText.length;
    const text = passageText.substring(start, end).trim();
    verses.push({ number: positions[i].number, text });
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

  return {
    canonical: asNonEmptyString(value.canonical) ?? "",
    verses: parsePassageIntoVerses(textWithoutCopyright),
    copyright,
  };
}

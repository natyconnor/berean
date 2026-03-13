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

export function getCachedPassage(query: string): EsvChapterData | null {
  try {
    const cached = sessionStorage.getItem(`${CACHE_PREFIX}${query}`);
    if (cached) return JSON.parse(cached);
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

export function parseEsvResponse(raw: Record<string, unknown>): EsvChapterData {
  const passages = raw.passages as string[] | undefined;
  const passageText = passages?.[0] ?? "";

  const defaultCopyright =
    "Scripture quotations are from the ESV\u00AE Bible (The Holy Bible, English Standard Version\u00AE), \u00A9 2001 by Crossway, a publishing ministry of Good News Publishers. Used by permission. All rights reserved.";

  // The ESV API appends the copyright after double newlines at the end
  const copyrightMatch = passageText.match(
    /\n\n\s*(Scripture quotations.*|ESV.*)$/s,
  );
  const copyright = copyrightMatch?.[1]?.trim() ?? defaultCopyright;

  const textWithoutCopyright = copyrightMatch
    ? passageText.substring(0, copyrightMatch.index).trim()
    : passageText.trim();

  return {
    canonical: (raw.canonical as string) ?? "",
    verses: parsePassageIntoVerses(textWithoutCopyright),
    copyright,
  };
}

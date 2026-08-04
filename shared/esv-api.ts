export interface EsvVerseHeading {
  text: string;
  /** Character offset into the verse's `text` at which the heading is printed. */
  offset: number;
  /**
   * Section headings come from the API's underscore rule; subheadings are the
   * closed Crossway set (Psalm 119 letters, Song speakers) peeled from the text.
   */
  variant?: "section" | "sub";
}

export interface EsvVerse {
  number: number;
  text: string;
  /**
   * Section heading printed immediately before this verse, when present.
   * Multiple stacked headings (e.g. Psalm 1's "Book One") are newline-joined.
   * Identified by the ESV API's underscore rule (`include-heading-horizontal-lines`).
   */
  heading?: string;
  /**
   * ESV "subheading" printed immediately before this verse: Psalm 119's acrostic
   * letters, Song of Solomon speakers, and unmarked psalm titles. These are not
   * marked with the underscore rule in the text API, so they are recognized from
   * Crossway's documented subheading set (and multi-word psalm superscriptions
   * before verse 1). Omitted when absent.
   */
  subheading?: string;
  /**
   * Headings printed partway through this verse: section headings (2 Samuel
   * 12:15) or known subheadings (Song of Solomon speakers). Omitted when none.
   */
  midHeadings?: EsvVerseHeading[];
}

export interface EsvChapterData {
  canonical: string;
  verses: EsvVerse[];
  copyright: string;
}

/** Bumped when cached chapter shape or parsing changes (e.g. headings). */
const CACHE_PREFIX = "esv_cache_v8_";

/**
 * Closed set of ESV subheadings that the text API does not mark with an
 * underscore rule. Matches Crossway's HTML `include-subheadings` examples:
 * Psalm 119 acrostic divisions and Song of Solomon speakers. Exact string match
 * on a whole line only — never a substring of verse text.
 */
const KNOWN_SUBHEADINGS = new Set([
  "Aleph",
  "Beth",
  "Gimel",
  "Daleth",
  "He",
  "Waw",
  "Zayin",
  "Heth",
  "Teth",
  "Yodh",
  "Kaph",
  "Lamedh",
  "Mem",
  "Nun",
  "Samekh",
  "Ayin",
  "Pe",
  "Tsadhe",
  "Qoph",
  "Resh",
  "Shin",
  "Taw",
  "Sin and Shin",
  "She",
  "Others",
]);

function isKnownSubheading(value: string): boolean {
  return KNOWN_SUBHEADINGS.has(value);
}

function parseStoredJson(value: string): unknown {
  return JSON.parse(value) as unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object";
}

function asNonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function isEsvVerseHeading(value: unknown): value is EsvVerseHeading {
  return (
    isRecord(value) &&
    typeof value.text === "string" &&
    typeof value.offset === "number" &&
    (value.variant === undefined ||
      value.variant === "section" ||
      value.variant === "sub")
  );
}

function isEsvVerse(value: unknown): value is EsvVerse {
  if (!isRecord(value)) return false;
  if (typeof value.number !== "number" || typeof value.text !== "string") {
    return false;
  }
  if (value.heading !== undefined && typeof value.heading !== "string") {
    return false;
  }
  if (value.subheading !== undefined && typeof value.subheading !== "string") {
    return false;
  }
  if (
    value.midHeadings !== undefined &&
    !(
      Array.isArray(value.midHeadings) &&
      value.midHeadings.every(isEsvVerseHeading)
    )
  ) {
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

/**
 * A section heading: the rule of underscores the ESV API prints above it because
 * we request `include-heading-horizontal-lines` (see `convex/esv.ts`), followed
 * by the heading itself on the next line. That rule is what identifies a
 * heading, so headings never have to be guessed at from capitalization, length,
 * or indentation. The rule takes on the indentation of a preceding poetry block,
 * and is not always separated from it by a truly empty line, so match it by line
 * rather than by paragraph.
 */
const SECTION_HEADING = /^[ \t]*_{2,}[ \t]*\n[ \t]*([^\n]*)/gm;

type PassageSegment =
  { kind: "text"; value: string } | { kind: "heading"; value: string };

/** Splits a run of passage text into its headings and the text between them. */
function splitOnSectionHeadings(raw: string): PassageSegment[] {
  const segments: PassageSegment[] = [];
  let cursor = 0;

  for (const match of raw.matchAll(SECTION_HEADING)) {
    const before = raw.slice(cursor, match.index);
    if (before.trim().length > 0) {
      segments.push({ kind: "text", value: before });
    }
    const heading = (match[1] ?? "").trim();
    if (heading.length > 0) {
      segments.push({ kind: "heading", value: heading });
    }
    cursor = match.index + match[0].length;
  }

  const tail = raw.slice(cursor);
  if (tail.trim().length > 0) {
    segments.push({ kind: "text", value: tail });
  }
  return segments;
}

interface VerseBlockParts {
  /** Verse text with section headings and known subheadings removed. */
  text: string;
  /** Subheading at the very start of this block (Song speakers after the verse #). */
  leadingSubheading: string | null;
  /**
   * Headings that interrupt this verse — section (`____`) or known sub — each
   * with the offset into `text` where it belongs.
   */
  midHeadings: EsvVerseHeading[];
  /** Section heading ending the block, which introduces the next verse. */
  trailingHeading: string | null;
  /** Known subheading ending the block, which introduces the next verse. */
  trailingSubheading: string | null;
}

/**
 * Splits a run of plain text on whole lines that match the known-subheading
 * allowlist. Spacer lines stay attached to neighboring text so poetry's
 * whitespace-only lines don't invent empty segments.
 */
function splitOnKnownSubheadings(
  raw: string,
): Array<{ kind: "text"; value: string } | { kind: "sub"; value: string }> {
  const lines = raw.split("\n");
  const parts: Array<
    { kind: "text"; value: string } | { kind: "sub"; value: string }
  > = [];
  let buf: string[] = [];

  const flush = () => {
    if (buf.length === 0) return;
    parts.push({ kind: "text", value: buf.join("\n") });
    buf = [];
  };

  for (const line of lines) {
    if (isKnownSubheading(line.trim())) {
      flush();
      parts.push({ kind: "sub", value: line.trim() });
    } else {
      buf.push(line);
    }
  }
  flush();
  return parts;
}

function splitVerseBlock(raw: string): VerseBlockParts {
  type Atom =
    | { kind: "text"; value: string }
    | { kind: "section"; value: string }
    | { kind: "sub"; value: string };

  const atoms: Atom[] = [];
  for (const segment of splitOnSectionHeadings(raw)) {
    if (segment.kind === "heading") {
      atoms.push({ kind: "section", value: segment.value });
      continue;
    }
    for (const part of splitOnKnownSubheadings(segment.value)) {
      atoms.push(part);
    }
  }

  const leadingSubs: string[] = [];
  const midHeadings: EsvVerseHeading[] = [];
  let text = "";
  let pendingSections: string[] = [];
  let pendingSubs: string[] = [];
  let seenText = false;

  const flushPendingsIntoMid = () => {
    if (text.length > 0 && !text.endsWith("\n\n")) {
      text = text.replace(/\s+$/, "") + "\n\n";
    }
    for (const heading of pendingSections) {
      midHeadings.push({
        text: heading,
        offset: text.length,
        variant: "section",
      });
    }
    for (const sub of pendingSubs) {
      midHeadings.push({ text: sub, offset: text.length, variant: "sub" });
    }
    pendingSections = [];
    pendingSubs = [];
  };

  for (const atom of atoms) {
    if (atom.kind === "section") {
      pendingSections.push(atom.value);
      continue;
    }
    if (atom.kind === "sub") {
      if (!seenText) {
        leadingSubs.push(atom.value);
      } else {
        pendingSubs.push(atom.value);
      }
      continue;
    }

    const hasContent = atom.value.trim().length > 0;
    if (!hasContent) {
      // Whitespace-only spacer (common after poetry). Keep pending labels
      // hanging so a following "Beth" still counts as trailing, not mid.
      continue;
    }

    if (seenText) {
      flushPendingsIntoMid();
    } else {
      if (pendingSubs.length > 0) {
        leadingSubs.push(...pendingSubs);
        pendingSubs = [];
      }
      if (pendingSections.length > 0) {
        for (const heading of pendingSections) {
          midHeadings.push({
            text: heading,
            offset: 0,
            variant: "section",
          });
        }
        pendingSections = [];
      }
    }

    const isFirstPart = text.length === 0;
    if (!isFirstPart && !text.endsWith("\n\n")) {
      text += "\n\n";
    }
    const part = atom.value.replace(/\s+$/, "");
    text += isFirstPart
      ? part.replace(/^\s+/, "")
      : part.replace(/^(?:[ \t]*\n)+/, "");
    seenText = true;
  }

  return {
    text,
    leadingSubheading: leadingSubs.length > 0 ? leadingSubs.join("\n") : null,
    midHeadings,
    trailingHeading:
      pendingSections.length > 0 ? pendingSections.join("\n") : null,
    trailingSubheading: pendingSubs.length > 0 ? pendingSubs.join("\n") : null,
  };
}

/**
 * Matter before the first verse number. Marked (`____`) lines are section
 * headings. Unmarked lines are Crossway subheadings: the closed known set
 * (Psalm 119 letters, Song speakers) or multi-word psalm titles. Bracketed
 * textual notes (Mark 16, John 7) are left alone.
 */
function extractLeadingMatter(interstitial: string): {
  heading: string | null;
  subheading: string | null;
} {
  const headings: string[] = [];
  const subheadings: string[] = [];
  for (const segment of splitOnSectionHeadings(interstitial)) {
    if (segment.kind === "heading") {
      headings.push(segment.value);
      continue;
    }
    if (segment.value.includes("[")) continue;
    for (const part of splitOnKnownSubheadings(segment.value)) {
      if (part.kind === "sub") {
        subheadings.push(part.value);
        continue;
      }
      const trimmed = part.value.trim();
      if (trimmed.length === 0) continue;
      if (/\s/.test(trimmed) || isKnownSubheading(trimmed)) {
        subheadings.push(trimmed);
      }
    }
  }
  return {
    heading: headings.length > 0 ? headings.join("\n") : null,
    subheading: subheadings.length > 0 ? subheadings.join("\n") : null,
  };
}

function joinOptional(
  a: string | null | undefined,
  b: string | null | undefined,
): string | null {
  const parts = [a, b].filter((part): part is string => !!part);
  return parts.length > 0 ? parts.join("\n") : null;
}

export function parsePassageIntoVerses(passageText: string): EsvVerse[] {
  const verses: EsvVerse[] = [];
  // The leading `\[*` absorbs the `[[` that opens a disputed passage (Mark 16:9,
  // John 7:53), which otherwise trails the previous verse and hides the heading
  // in between.
  const regex = /\[*\[(\d+)\]\s*/g;
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
  let pendingSubheading: string | null = null;
  if (positions.length > 0) {
    const first = positions[0];
    const beforeFirst = passageText.substring(
      0,
      first.index - first.matchLength,
    );
    const leading = extractLeadingMatter(beforeFirst);
    pendingHeading = leading.heading;
    pendingSubheading = leading.subheading;
  }

  for (let i = 0; i < positions.length; i++) {
    const start = positions[i].index;
    const end =
      i + 1 < positions.length
        ? positions[i + 1].index - positions[i + 1].matchLength
        : passageText.length;
    const block = splitVerseBlock(passageText.substring(start, end));

    const atStart = block.midHeadings.filter(
      (heading) => heading.offset === 0 && heading.variant !== "sub",
    );
    const midOnly = block.midHeadings.filter(
      (heading) => heading.offset > 0 || heading.variant === "sub",
    );

    const heading = joinOptional(
      pendingHeading,
      atStart.length > 0 ? atStart.map((h) => h.text).join("\n") : null,
    );
    const subheading = joinOptional(pendingSubheading, block.leadingSubheading);

    const verse: EsvVerse = { number: positions[i].number, text: block.text };
    if (heading) verse.heading = heading;
    if (subheading) verse.subheading = subheading;
    if (midOnly.length > 0) verse.midHeadings = midOnly;
    verses.push(verse);

    pendingHeading = block.trailingHeading;
    pendingSubheading = block.trailingSubheading;
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
    verses: parsePassageIntoVerses(textWithoutCopyright),
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

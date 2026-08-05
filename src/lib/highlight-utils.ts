export interface HighlightRange {
  highlightId: string;
  startOffset: number;
  endOffset: number;
  color: string;
  createdAt: number;
}

export interface TextSegmentWithHighlight {
  text: string;
  color?: string;
  highlightId?: string;
}

/**
 * Splits a plain text string into segments based on highlight ranges.
 * Overlapping highlights are resolved by giving priority to the most recently created one.
 */
export function splitTextByHighlights(
  text: string,
  highlights: HighlightRange[],
): TextSegmentWithHighlight[] {
  if (highlights.length === 0) {
    return [{ text }];
  }

  const charColors = new Array<{
    color: string;
    highlightId: string;
    createdAt: number;
  } | null>(text.length).fill(null);

  const sorted = [...highlights].sort((a, b) => a.createdAt - b.createdAt);
  for (const hl of sorted) {
    const start = Math.max(0, hl.startOffset);
    const end = Math.min(text.length, hl.endOffset);
    for (let i = start; i < end; i++) {
      charColors[i] = {
        color: hl.color,
        highlightId: hl.highlightId,
        createdAt: hl.createdAt,
      };
    }
  }

  const segments: TextSegmentWithHighlight[] = [];
  let i = 0;
  while (i < text.length) {
    const current = charColors[i];
    let j = i + 1;
    while (
      j < text.length &&
      charColors[j]?.color === current?.color &&
      charColors[j]?.highlightId === current?.highlightId
    ) {
      j++;
    }
    segments.push({
      text: text.slice(i, j),
      ...(current
        ? {
            color: current.color || "yellow",
            highlightId: current.highlightId,
          }
        : {}),
    });
    i = j;
  }

  return segments;
}

export interface VerseHeadingAtOffset {
  text: string;
  offset: number;
  variant?: "section" | "sub";
}

export type VerseContentPart =
  | {
      kind: "text";
      segment: TextSegmentWithHighlight;
      /**
       * The paragraph break a heading stands in: kept in the DOM so selection
       * offsets still match the verse text, but not shown, since the heading
       * supplies the break itself.
       */
      hidden?: boolean;
    }
  | { kind: "heading"; text: string; variant?: "section" | "sub" };

/** The line break at the end of the text a heading interrupts. */
const TRAILING_BREAK = /(?:[ \t]*\n)+[ \t]*$/;

/**
 * Splices section headings that start partway through a verse into its text
 * segments, splitting a segment when a heading falls inside it. Offsets are
 * character positions in the verse text, so headings land between the same words
 * the ESV prints them between.
 */
export function splitSegmentsByHeadings(
  segments: TextSegmentWithHighlight[],
  headings: VerseHeadingAtOffset[],
): VerseContentPart[] {
  if (headings.length === 0) {
    return segments.map((segment) => ({ kind: "text", segment }));
  }

  const ordered = [...headings].sort((a, b) => a.offset - b.offset);
  const parts: VerseContentPart[] = [];
  let next = 0;
  let consumed = 0;

  const pushTextBeforeHeading = (
    segment: TextSegmentWithHighlight,
    text: string,
  ) => {
    const brk = TRAILING_BREAK.exec(text);
    const visible = brk ? text.slice(0, brk.index) : text;
    if (visible.length > 0) {
      parts.push({ kind: "text", segment: { ...segment, text: visible } });
    }
    if (brk) {
      parts.push({
        kind: "text",
        segment: { ...segment, text: brk[0] },
        hidden: true,
      });
    }
  };

  for (const segment of segments) {
    let cut = 0;
    while (
      next < ordered.length &&
      ordered[next].offset < consumed + segment.text.length
    ) {
      const at = Math.max(ordered[next].offset - consumed, cut);
      if (at > cut) {
        pushTextBeforeHeading(segment, segment.text.slice(cut, at));
      }
      parts.push({
        kind: "heading",
        text: ordered[next].text,
        variant: ordered[next].variant,
      });
      cut = at;
      next++;
    }
    if (cut < segment.text.length) {
      parts.push({
        kind: "text",
        segment:
          cut === 0 ? segment : { ...segment, text: segment.text.slice(cut) },
      });
    }
    consumed += segment.text.length;
  }

  for (; next < ordered.length; next++) {
    parts.push({
      kind: "heading",
      text: ordered[next].text,
      variant: ordered[next].variant,
    });
  }

  return parts;
}

/**
 * Marks an element whose text is part of the rendered verse but not of the verse
 * text itself, so it is discounted when measuring selection offsets.
 */
export const VERSE_ASIDE_ATTRIBUTE = "data-verse-aside";

const VERSE_ASIDE_SELECTOR = `[${VERSE_ASIDE_ATTRIBUTE}]`;

/**
 * Length of the heading's text that lies before `range`'s end, so headings
 * rendered inside the verse don't shift the offsets of the text after them.
 */
function asideLengthWithin(range: Range, aside: Element): number {
  const asideRange = document.createRange();
  asideRange.selectNodeContents(aside);

  if (
    range.comparePoint(asideRange.startContainer, asideRange.startOffset) > 0
  ) {
    return 0;
  }
  if (range.comparePoint(asideRange.endContainer, asideRange.endOffset) <= 0) {
    return asideRange.toString().length;
  }

  const clipped = document.createRange();
  clipped.setStart(asideRange.startContainer, asideRange.startOffset);
  clipped.setEnd(range.endContainer, range.endOffset);
  return clipped.toString().length;
}

function verseTextOffset(
  containerEl: HTMLElement,
  node: Node,
  nodeOffset: number,
): number {
  const range = document.createRange();
  range.selectNodeContents(containerEl);
  range.setEnd(node, nodeOffset);

  let length = range.toString().length;
  for (const aside of containerEl.querySelectorAll(VERSE_ASIDE_SELECTOR)) {
    length -= asideLengthWithin(range, aside);
  }
  return Math.max(0, length);
}

/**
 * Computes the character offset within a verse text element based on
 * the Selection API range. Returns null if the selection is outside the element.
 */
export function getSelectionOffsets(
  containerEl: HTMLElement,
): { start: number; end: number } | null {
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
    return null;
  }

  const range = selection.getRangeAt(0);
  if (
    !containerEl.contains(range.startContainer) ||
    !containerEl.contains(range.endContainer)
  ) {
    return null;
  }

  const start = verseTextOffset(
    containerEl,
    range.startContainer,
    range.startOffset,
  );
  const end = verseTextOffset(containerEl, range.endContainer, range.endOffset);

  if (start === end) return null;
  return { start: Math.min(start, end), end: Math.max(start, end) };
}

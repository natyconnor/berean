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

  const preRange = document.createRange();
  preRange.selectNodeContents(containerEl);
  preRange.setEnd(range.startContainer, range.startOffset);
  const start = preRange.toString().length;

  const fullRange = document.createRange();
  fullRange.selectNodeContents(containerEl);
  fullRange.setEnd(range.endContainer, range.endOffset);
  const end = fullRange.toString().length;

  if (start === end) return null;
  return { start: Math.min(start, end), end: Math.max(start, end) };
}

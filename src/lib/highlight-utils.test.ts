import { describe, expect, it } from "vitest";
import {
  getSelectionOffsets,
  splitSegmentsByHeadings,
  splitTextByHighlights,
  VERSE_ASIDE_ATTRIBUTE,
} from "./highlight-utils";

describe("splitSegmentsByHeadings", () => {
  const opening = "Then Nathan went to his house.";
  const rest = "  And the LORD afflicted the child.";
  const text = `${opening}\n\n${rest}`;
  const offset = text.indexOf(rest);

  it("splits an unhighlighted verse at the heading, hiding the break", () => {
    const parts = splitSegmentsByHeadings(
      [{ text }],
      [{ text: "David’s Child Dies", offset }],
    );

    expect(parts).toEqual([
      { kind: "text", segment: { text: opening } },
      { kind: "text", segment: { text: "\n\n" }, hidden: true },
      { kind: "heading", text: "David’s Child Dies" },
      { kind: "text", segment: { text: rest } },
    ]);
  });

  it("splits a highlight that spans the heading, keeping its color", () => {
    const segments = splitTextByHighlights(text, [
      {
        highlightId: "h1",
        startOffset: 0,
        endOffset: text.length,
        color: "yellow",
        createdAt: 1,
      },
    ]);

    const parts = splitSegmentsByHeadings(segments, [
      { text: "David’s Child Dies", offset },
    ]);

    expect(parts.map((part) => part.kind)).toEqual([
      "text",
      "text",
      "heading",
      "text",
    ]);
    for (const part of parts) {
      if (part.kind === "text") {
        expect(part.segment.color).toBe("yellow");
        expect(part.segment.highlightId).toBe("h1");
      }
    }
    expect(
      parts
        .map((part) => (part.kind === "text" ? part.segment.text : ""))
        .join(""),
    ).toBe(text);
  });

  it("keeps the text untouched when there are no headings", () => {
    expect(splitSegmentsByHeadings([{ text }], [])).toEqual([
      { kind: "text", segment: { text } },
    ]);
  });
});

describe("getSelectionOffsets", () => {
  const BREAK = "\n\n";

  /**
   * Mirrors how VerseRowLeft renders a verse whose heading falls mid-verse: the
   * paragraph break stays in the DOM but hidden, and the heading is an aside.
   */
  function renderVerse(
    before: string,
    heading: string,
    after: string,
  ): { container: HTMLElement; beforeNode: Text; afterNode: Text } {
    const container = document.createElement("span");
    const beforeNode = document.createTextNode(before);
    const breakEl = document.createElement("span");
    breakEl.className = "hidden";
    breakEl.textContent = BREAK;
    const headingEl = document.createElement("span");
    headingEl.setAttribute(VERSE_ASIDE_ATTRIBUTE, "");
    headingEl.textContent = heading;
    const afterNode = document.createTextNode(after);

    container.append(beforeNode, breakEl, headingEl, afterNode);
    document.body.append(container);
    return { container, beforeNode, afterNode };
  }

  function select(
    startNode: Node,
    startOffset: number,
    endNode: Node,
    endOffset: number,
  ) {
    const range = document.createRange();
    range.setStart(startNode, startOffset);
    range.setEnd(endNode, endOffset);
    const selection = window.getSelection()!;
    selection.removeAllRanges();
    selection.addRange(range);
  }

  it("counts the hidden break but not the heading after it", () => {
    const before = "Then Nathan went to his house.";
    const after = "  And the LORD afflicted the child.";
    const { container, afterNode } = renderVerse(
      before,
      "David’s Child Dies",
      after,
    );

    select(afterNode, 0, afterNode, "  And the LORD".length);

    const textStart = before.length + BREAK.length;
    expect(getSelectionOffsets(container)).toEqual({
      start: textStart,
      end: textStart + "  And the LORD".length,
    });
  });

  it("ignores heading text for a selection spanning the heading", () => {
    const before = "Then Nathan went to his house.";
    const after = "  And the LORD afflicted the child.";
    const { container, beforeNode, afterNode } = renderVerse(
      before,
      "David’s Child Dies",
      after,
    );

    select(beforeNode, "Then ".length, afterNode, "  And".length);

    expect(getSelectionOffsets(container)).toEqual({
      start: "Then ".length,
      end: before.length + BREAK.length + "  And".length,
    });
  });

  it("measures a plain verse unchanged", () => {
    const container = document.createElement("span");
    const node = document.createTextNode("For God so loved the world.");
    container.append(node);
    document.body.append(container);

    select(node, 4, node, 7);

    expect(getSelectionOffsets(container)).toEqual({ start: 4, end: 7 });
  });
});

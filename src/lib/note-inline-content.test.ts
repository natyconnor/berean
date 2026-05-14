import { describe, expect, it } from "vitest";
import {
  normalizeNoteBody,
  noteBodyHasSubstantiveContent,
  noteBodyToPlainText,
} from "./note-inline-content";

describe("normalizeNoteBody", () => {
  it("preserves internal consecutive line breaks", () => {
    const body = normalizeNoteBody({
      version: 1,
      segments: [
        { type: "text", text: "line one" },
        { type: "lineBreak" },
        { type: "lineBreak" },
        { type: "text", text: "line two" },
      ],
    });

    expect(noteBodyToPlainText(body)).toBe("line one\n\nline two");
  });

  it("preserves leading and trailing whitespace and blank lines", () => {
    const body = normalizeNoteBody({
      version: 1,
      segments: [
        { type: "lineBreak" },
        { type: "text", text: "  line one" },
        { type: "lineBreak" },
        { type: "lineBreak" },
        { type: "text", text: "line two  " },
        { type: "lineBreak" },
      ],
    });

    expect(noteBodyToPlainText(body)).toBe("\n  line one\n\nline two  \n");
  });
});

describe("noteBodyHasSubstantiveContent", () => {
  it("is false for whitespace-only bodies", () => {
    expect(
      noteBodyHasSubstantiveContent({
        version: 1,
        segments: [{ type: "text", text: "  \n\t  " }],
      }),
    ).toBe(false);
  });

  it("is true when there is non-whitespace text", () => {
    expect(
      noteBodyHasSubstantiveContent({
        version: 1,
        segments: [{ type: "text", text: "  hi  " }],
      }),
    ).toBe(true);
  });
});

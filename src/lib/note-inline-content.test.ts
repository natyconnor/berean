import { describe, expect, it } from "vitest";
import {
  extractVerseRefsFromNoteBody,
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

  it("preserves chapter-scoped verse refs", () => {
    const body = normalizeNoteBody({
      version: 1,
      segments: [
        {
          type: "verseRef",
          label: "John 3",
          ref: {
            book: "John",
            chapter: 3,
            startVerse: 1,
            endVerse: 1,
            scope: "chapter",
          },
        },
      ],
    });

    expect(body.segments).toEqual([
      {
        type: "verseRef",
        label: "John 3",
        ref: {
          book: "John",
          chapter: 3,
          startVerse: 1,
          endVerse: 1,
          scope: "chapter",
        },
      },
    ]);
    expect(noteBodyToPlainText(body)).toBe("John 3");
  });
});

describe("extractVerseRefsFromNoteBody", () => {
  it("keeps chapter and verse-1 refs distinct", () => {
    const refs = extractVerseRefsFromNoteBody({
      version: 1,
      segments: [
        {
          type: "verseRef",
          label: "John 3",
          ref: {
            book: "John",
            chapter: 3,
            startVerse: 1,
            endVerse: 1,
            scope: "chapter",
          },
        },
        {
          type: "verseRef",
          label: "John 3:1",
          ref: {
            book: "John",
            chapter: 3,
            startVerse: 1,
            endVerse: 1,
          },
        },
      ],
    });

    expect(refs).toHaveLength(2);
    expect(refs.some((ref) => ref.scope === "chapter")).toBe(true);
    expect(refs.some((ref) => ref.scope === undefined)).toBe(true);
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

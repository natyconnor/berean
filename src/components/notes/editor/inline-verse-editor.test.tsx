import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  EMPTY_NOTE_BODY,
  type NoteBody,
  noteBodyToPlainText,
} from "@/lib/note-inline-content";
import { InlineVerseEditor } from "./inline-verse-editor";

vi.mock("@/hooks/use-esv-reference", () => ({
  useDebouncedEsvReferenceValidation: () => ({
    status: "valid" as const,
    data: null,
  }),
}));

vi.mock("@/hooks/use-verse-link-navigation", () => ({
  useVerseLinkNavigation: () => vi.fn(),
}));

function placeCaretAtEnd(node: Text) {
  const selection = window.getSelection();
  if (!selection) {
    throw new Error("Selection API unavailable");
  }

  const range = document.createRange();
  range.setStart(node, node.data.length);
  range.collapse(true);
  selection.removeAllRanges();
  selection.addRange(range);
}

describe("InlineVerseEditor", () => {
  it("reads a browser-inserted line break between inline and block content", () => {
    let latestBody: NoteBody = EMPTY_NOTE_BODY;

    render(
      <InlineVerseEditor
        initialBody={EMPTY_NOTE_BODY}
        verseRef={{ book: "John", chapter: 3, startVerse: 16, endVerse: 16 }}
        onChange={(body) => {
          latestBody = body;
        }}
      />,
    );

    const editor = screen.getByRole("textbox");
    editor.innerHTML = "Line one<div>Line two</div>";
    act(() => {
      fireEvent.input(editor);
    });

    expect(noteBodyToPlainText(latestBody)).toBe("Line one\nLine two");
  });

  it("preserves consecutive explicit line breaks", () => {
    let latestBody: NoteBody = EMPTY_NOTE_BODY;

    render(
      <InlineVerseEditor
        initialBody={EMPTY_NOTE_BODY}
        verseRef={{ book: "John", chapter: 3, startVerse: 16, endVerse: 16 }}
        onChange={(body) => {
          latestBody = body;
        }}
      />,
    );

    const editor = screen.getByRole("textbox");
    editor.innerHTML = "Line one<br><br>Line two";
    act(() => {
      fireEvent.input(editor);
    });

    expect(noteBodyToPlainText(latestBody)).toBe("Line one\n\nLine two");
  });

  it("inserts a single line break on Enter when @ verse query is not active", () => {
    let latestBody: NoteBody = EMPTY_NOTE_BODY;

    render(
      <InlineVerseEditor
        initialBody={EMPTY_NOTE_BODY}
        verseRef={{ book: "John", chapter: 3, startVerse: 16, endVerse: 16 }}
        onChange={(body) => {
          latestBody = body;
        }}
      />,
    );

    const editor = screen.getByRole("textbox");
    editor.innerHTML = "@John 3:16 and more";
    const textNode = editor.firstChild;
    if (!(textNode instanceof Text)) {
      throw new Error("Expected text node");
    }
    placeCaretAtEnd(textNode);
    act(() => {
      fireEvent.input(editor);
    });

    act(() => {
      fireEvent.keyDown(editor, { key: "Enter" });
    });
    expect(noteBodyToPlainText(latestBody)).toBe("@John 3:16 and more\n");
  });

  it("inserts one line break when pressing Enter after a line of text", () => {
    let latestBody: NoteBody = EMPTY_NOTE_BODY;

    render(
      <InlineVerseEditor
        initialBody={EMPTY_NOTE_BODY}
        verseRef={{ book: "John", chapter: 3, startVerse: 16, endVerse: 16 }}
        onChange={(body) => {
          latestBody = body;
        }}
      />,
    );

    const editor = screen.getByRole("textbox");
    editor.innerHTML = "This is line 1";
    const textNode = editor.firstChild;
    if (!(textNode instanceof Text)) {
      throw new Error("Expected text node");
    }
    placeCaretAtEnd(textNode);
    act(() => {
      fireEvent.input(editor);
    });

    act(() => {
      fireEvent.keyDown(editor, { key: "Enter" });
    });

    expect(noteBodyToPlainText(latestBody)).toBe("This is line 1\n");
  });

  it("adds a layout sentinel break at end without duplicating stored line breaks", () => {
    let latestBody: NoteBody = EMPTY_NOTE_BODY;

    render(
      <InlineVerseEditor
        initialBody={EMPTY_NOTE_BODY}
        verseRef={{ book: "John", chapter: 3, startVerse: 16, endVerse: 16 }}
        onChange={(body) => {
          latestBody = body;
        }}
      />,
    );

    const editor = screen.getByRole("textbox");
    editor.innerHTML = "This is line 1";
    const textNode = editor.firstChild;
    if (!(textNode instanceof Text)) {
      throw new Error("Expected text node");
    }
    placeCaretAtEnd(textNode);
    act(() => {
      fireEvent.input(editor);
    });

    act(() => {
      fireEvent.keyDown(editor, { key: "Enter" });
    });

    expect(noteBodyToPlainText(latestBody)).toBe("This is line 1\n");
    const sentinelBreaks = editor.querySelectorAll(
      "br[data-note-break-sentinel='true']",
    );
    expect(sentinelBreaks.length).toBe(1);
  });

  it("still intercepts Enter for an active verse query", () => {
    const onChange = vi.fn();

    render(
      <InlineVerseEditor
        initialBody={EMPTY_NOTE_BODY}
        verseRef={{ book: "John", chapter: 3, startVerse: 16, endVerse: 16 }}
        onChange={onChange}
      />,
    );

    const editor = screen.getByRole("textbox");
    editor.innerHTML = "@John 3:16";
    const textNode = editor.firstChild;
    if (!(textNode instanceof Text)) {
      throw new Error("Expected text node");
    }
    placeCaretAtEnd(textNode);
    act(() => {
      fireEvent.input(editor);
    });

    const enterEvent = new KeyboardEvent("keydown", {
      key: "Enter",
      bubbles: true,
      cancelable: true,
    });

    let dispatchResult = true;
    act(() => {
      dispatchResult = editor.dispatchEvent(enterEvent);
    });
    expect(dispatchResult).toBe(false);
    expect(enterEvent.defaultPrevented).toBe(true);
  });

  it("inserts a chapter link when Enter is pressed on @John 3", () => {
    let latestBody: NoteBody = EMPTY_NOTE_BODY;

    render(
      <InlineVerseEditor
        initialBody={EMPTY_NOTE_BODY}
        verseRef={{ book: "John", chapter: 3, startVerse: 16, endVerse: 16 }}
        onChange={(body) => {
          latestBody = body;
        }}
      />,
    );

    const editor = screen.getByRole("textbox");
    editor.innerHTML = "@John 3";
    const textNode = editor.firstChild;
    if (!(textNode instanceof Text)) {
      throw new Error("Expected text node");
    }
    placeCaretAtEnd(textNode);
    act(() => {
      fireEvent.input(editor);
    });

    expect(
      screen.getByRole("button", { name: /John 3 is ready to insert/i }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Insert chapter link")).not.toBeInTheDocument();

    act(() => {
      fireEvent.keyDown(editor, { key: "Enter" });
    });

    expect(latestBody.segments).toEqual([
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
        type: "text",
        text: " ",
      },
    ]);
    expect(noteBodyToPlainText(latestBody)).toBe("John 3 ");
  });

  it("inserts a verse link when the ready status is clicked", () => {
    let latestBody: NoteBody = EMPTY_NOTE_BODY;

    render(
      <InlineVerseEditor
        initialBody={EMPTY_NOTE_BODY}
        verseRef={{ book: "John", chapter: 3, startVerse: 16, endVerse: 16 }}
        onChange={(body) => {
          latestBody = body;
        }}
      />,
    );

    const editor = screen.getByRole("textbox");
    editor.innerHTML = "@John 3:16";
    const textNode = editor.firstChild;
    if (!(textNode instanceof Text)) {
      throw new Error("Expected text node");
    }
    placeCaretAtEnd(textNode);
    act(() => {
      fireEvent.input(editor);
    });

    fireEvent.click(
      screen.getByRole("button", { name: /John 3:16 is ready to insert/i }),
    );

    expect(noteBodyToPlainText(latestBody)).toBe("John 3:16 ");
    expect(screen.queryByText("Insert verse link")).not.toBeInTheDocument();
  });

  it("round-trips chapter pill scope through editor DOM", () => {
    let latestBody: NoteBody = EMPTY_NOTE_BODY;
    const initialBody: NoteBody = {
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
    };

    render(
      <InlineVerseEditor
        initialBody={initialBody}
        verseRef={{ book: "John", chapter: 3, startVerse: 16, endVerse: 16 }}
        onChange={(body) => {
          latestBody = body;
        }}
      />,
    );

    const editor = screen.getByRole("textbox");
    const pill = editor.querySelector("[data-note-verse-pill='true']");
    expect(pill).not.toBeNull();
    expect(pill?.getAttribute("data-scope")).toBe("chapter");
    expect(pill?.getAttribute("data-label")).toBe("John 3");

    act(() => {
      fireEvent.input(editor);
    });

    expect(latestBody.segments).toEqual(initialBody.segments);
  });
});

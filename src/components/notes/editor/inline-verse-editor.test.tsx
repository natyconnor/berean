import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  EMPTY_NOTE_BODY,
  noteBodyToPlainText,
} from "@/lib/note-inline-content";
import { InlineVerseEditor } from "./inline-verse-editor";

vi.mock("@/hooks/use-esv-reference", () => ({
  useDebouncedEsvReferenceValidation: () => ({
    status: "idle" as const,
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
    const onChange = vi.fn();

    render(
      <InlineVerseEditor
        initialBody={EMPTY_NOTE_BODY}
        verseRef={{ book: "John", chapter: 3, startVerse: 16, endVerse: 16 }}
        onChange={onChange}
      />
    );

    const editor = screen.getByRole("textbox");
    editor.innerHTML = "Line one<div>Line two</div>";
    act(() => {
      fireEvent.input(editor);
    });

    const latestBody = onChange.mock.calls.at(-1)?.[0];
    expect(noteBodyToPlainText(latestBody)).toBe("Line one\nLine two");
  });

  it("does not intercept Enter once @ text is no longer a verse query", () => {
    const onChange = vi.fn();

    render(
      <InlineVerseEditor
        initialBody={EMPTY_NOTE_BODY}
        verseRef={{ book: "John", chapter: 3, startVerse: 16, endVerse: 16 }}
        onChange={onChange}
      />
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

    const enterEvent = new KeyboardEvent("keydown", {
      key: "Enter",
      bubbles: true,
      cancelable: true,
    });

    let dispatchResult = false;
    act(() => {
      dispatchResult = editor.dispatchEvent(enterEvent);
    });
    expect(dispatchResult).toBe(true);
    expect(enterEvent.defaultPrevented).toBe(false);
  });

  it("still intercepts Enter for an active verse query", () => {
    const onChange = vi.fn();

    render(
      <InlineVerseEditor
        initialBody={EMPTY_NOTE_BODY}
        verseRef={{ book: "John", chapter: 3, startVerse: 16, endVerse: 16 }}
        onChange={onChange}
      />
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
});

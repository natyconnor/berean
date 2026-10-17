import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { BIBLE_BOOKS, displayBookName } from "@/lib/bible-books";
import { getChapterVerseCount } from "@/lib/bible-verse-counts";
import {
  EMPTY_NOTE_BODY,
  type NoteBody,
  noteBodyToPlainText,
} from "@/lib/note-inline-content";
import { formatVerseRef } from "@/lib/verse-ref-utils";
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

function typeAtQuery(editor: HTMLElement, html: string) {
  editor.innerHTML = html;
  const textNode = editor.firstChild;
  if (!(textNode instanceof Text)) {
    throw new Error("Expected text node");
  }
  placeCaretAtEnd(textNode);
  act(() => {
    fireEvent.input(editor);
  });
}

const SINGLE_CHAPTER_BOOKS = BIBLE_BOOKS.filter((book) => book.chapters === 1);

function singleChapterReadyQueries(): Array<[string, RegExp]> {
  const queries: Array<[string, RegExp]> = [];
  for (const book of SINGLE_CHAPTER_BOOKS) {
    const maxVerse = getChapterVerseCount(book.name, 1) ?? 0;
    const verses = [2, 9, 10].filter((verse) => verse <= maxVerse);
    const ranges = [
      [2, 3],
      [1, 3],
      [1, 1],
      [3, 5],
      [10, 12],
      [9, 10],
    ].filter(([, end]) => end <= maxVerse);
    for (const verse of verses) {
      queries.push([
        `@${book.name} ${verse}`,
        new RegExp(
          `${formatVerseRef({
            book: book.name,
            chapter: 1,
            startVerse: verse,
            endVerse: verse,
          })} is ready to insert`,
          "i",
        ),
      ]);
    }
    for (const [start, end] of ranges) {
      queries.push([
        `@${book.name} ${start}-${end}`,
        new RegExp(
          `${formatVerseRef({
            book: book.name,
            chapter: 1,
            startVerse: start,
            endVerse: end,
          })} is ready to insert`,
          "i",
        ),
      ]);
    }
  }
  return queries;
}

function singleChapterPartialRangeQueries(): Array<[string, string]> {
  const queries: Array<[string, string]> = [];
  for (const book of SINGLE_CHAPTER_BOOKS) {
    const maxVerse = getChapterVerseCount(book.name, 1) ?? 0;
    for (const verse of [2, 3, 10, 12].filter((value) => value <= maxVerse)) {
      queries.push([
        `@${book.name} ${verse}-`,
        `Keep typing the end of the range for ${displayBookName(book.name)} 1:${verse}.`,
      ]);
    }
  }
  return queries;
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

  it("inserts a verse link when Enter is pressed on @Jude 2", () => {
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
    editor.innerHTML = "@Jude 2";
    const textNode = editor.firstChild;
    if (!(textNode instanceof Text)) {
      throw new Error("Expected text node");
    }
    placeCaretAtEnd(textNode);
    act(() => {
      fireEvent.input(editor);
    });

    expect(
      screen.getByRole("button", { name: /Jude 1:2 is ready to insert/i }),
    ).toBeInTheDocument();

    act(() => {
      fireEvent.keyDown(editor, { key: "Enter" });
    });

    expect(latestBody.segments).toEqual([
      {
        type: "verseRef",
        label: "Jude 1:2",
        ref: {
          book: "Jude",
          chapter: 1,
          startVerse: 2,
          endVerse: 2,
        },
      },
      {
        type: "text",
        text: " ",
      },
    ]);
    expect(noteBodyToPlainText(latestBody)).toBe("Jude 1:2 ");
  });

  it("inserts a verse link when Enter is pressed on @Jude 1", () => {
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
    typeAtQuery(editor, "@Jude 1");

    expect(
      screen.getByRole("button", { name: /Jude 1:1 is ready to insert/i }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Complete book name")).not.toBeInTheDocument();

    act(() => {
      fireEvent.keyDown(editor, { key: "Enter" });
    });

    expect(latestBody.segments).toEqual([
      {
        type: "verseRef",
        label: "Jude 1:1",
        ref: {
          book: "Jude",
          chapter: 1,
          startVerse: 1,
          endVerse: 1,
        },
      },
      {
        type: "text",
        text: " ",
      },
    ]);
    expect(noteBodyToPlainText(latestBody)).toBe("Jude 1:1 ");
  });

  it("inserts a book-named chapter link when Enter is pressed on exact @Jude", () => {
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
    typeAtQuery(editor, "@Jude");

    expect(
      screen.getByRole("button", { name: /Jude is ready to insert/i }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Complete book name")).not.toBeInTheDocument();

    act(() => {
      fireEvent.keyDown(editor, { key: "Enter" });
    });

    expect(latestBody.segments).toEqual([
      {
        type: "verseRef",
        label: "Jude",
        ref: {
          book: "Jude",
          chapter: 1,
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
    expect(noteBodyToPlainText(latestBody)).toBe("Jude ");
  });

  it("does not turn exact @John into a chapter link", () => {
    render(
      <InlineVerseEditor
        initialBody={EMPTY_NOTE_BODY}
        verseRef={{ book: "John", chapter: 3, startVerse: 16, endVerse: 16 }}
        onChange={() => {}}
      />,
    );

    const editor = screen.getByRole("textbox");
    typeAtQuery(editor, "@John");

    expect(screen.getAllByText("Complete book name").length).toBeGreaterThan(0);
    expect(
      screen.queryByRole("button", { name: /John 1 is ready to insert/i }),
    ).not.toBeInTheDocument();
  });

  it("hints a verse number on a single-chapter chapter link", () => {
    render(
      <InlineVerseEditor
        initialBody={EMPTY_NOTE_BODY}
        verseRef={{ book: "John", chapter: 3, startVerse: 16, endVerse: 16 }}
        onChange={() => {}}
      />,
    );

    const editor = screen.getByRole("textbox");
    typeAtQuery(editor, "@Jude");
    expect(
      screen.getByText(
        "Jude is ready to insert. Keep typing a verse number, like Jude 5.",
      ),
    ).toBeInTheDocument();

    typeAtQuery(editor, "@Philemon");
    expect(
      screen.getByText(
        "Philemon is ready to insert. Keep typing a verse number, like Philemon 5.",
      ),
    ).toBeInTheDocument();
  });

  it("keeps the colon-verse hint on a multi-chapter chapter link", () => {
    render(
      <InlineVerseEditor
        initialBody={EMPTY_NOTE_BODY}
        verseRef={{ book: "John", chapter: 3, startVerse: 16, endVerse: 16 }}
        onChange={() => {}}
      />,
    );

    const editor = screen.getByRole("textbox");
    typeAtQuery(editor, "@John 3");
    expect(
      screen.getByText(
        "John 3 is ready to insert. Keep typing :verse for a specific verse.",
      ),
    ).toBeInTheDocument();
  });

  it.each([
    "@Jude 0",
    "@Philemon 0",
    "@Phlm 0",
    "@Obadiah 0",
    "@2 John 0",
    "@3 John 0",
    "@Jude 0-3",
    "@Jude 3-0",
    "@Jude 1:0",
    "@John 3:0",
    "@John 3:0-4",
    "@John 3:4-0",
  ])("says verses start at 1 for %s", (query) => {
    render(
      <InlineVerseEditor
        initialBody={EMPTY_NOTE_BODY}
        verseRef={{ book: "John", chapter: 3, startVerse: 16, endVerse: 16 }}
        onChange={() => {}}
      />,
    );

    const editor = screen.getByRole("textbox");
    typeAtQuery(editor, query);
    expect(screen.getByText("Verses start at 1.")).toBeInTheDocument();
    expect(
      screen.getByText("Keep typing to correct the reference."),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Keep refining/)).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /ready to insert/i }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/only has \d+ verses/)).not.toBeInTheDocument();
    expect(
      screen.queryByText("Choose a valid chapter to keep creating the link."),
    ).not.toBeInTheDocument();
  });

  it.each(["@Jude 5-3", "@John 3:5-3"])(
    "says the range is backwards for %s",
    (query) => {
      render(
        <InlineVerseEditor
          initialBody={EMPTY_NOTE_BODY}
          verseRef={{ book: "John", chapter: 3, startVerse: 16, endVerse: 16 }}
          onChange={() => {}}
        />,
      );

      const editor = screen.getByRole("textbox");
      typeAtQuery(editor, query);
      expect(screen.getByText("That range is backwards.")).toBeInTheDocument();
      expect(
        screen.getByText("Keep typing to correct the reference."),
      ).toBeInTheDocument();
      expect(screen.queryByText(/Keep refining/)).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: /ready to insert/i }),
      ).not.toBeInTheDocument();
    },
  );

  it.each([
    ["@Jude 1", /Jude 1:1 is ready to insert/i],
    ["@Jude 2-3", /Jude 1:2-3 is ready to insert/i],
    ["@John 3:16", /John 3:16 is ready to insert/i],
  ])("keeps a ready insert for %s", (query, readyName) => {
    render(
      <InlineVerseEditor
        initialBody={EMPTY_NOTE_BODY}
        verseRef={{ book: "John", chapter: 3, startVerse: 16, endVerse: 16 }}
        onChange={() => {}}
      />,
    );

    const editor = screen.getByRole("textbox");
    typeAtQuery(editor, query);
    expect(screen.getByRole("button", { name: readyName })).toBeInTheDocument();
  });

  it("describes an invalid single-chapter Book N as a missing verse", () => {
    render(
      <InlineVerseEditor
        initialBody={EMPTY_NOTE_BODY}
        verseRef={{ book: "John", chapter: 3, startVerse: 16, endVerse: 16 }}
        onChange={() => {}}
      />,
    );

    const editor = screen.getByRole("textbox");
    typeAtQuery(editor, "@Jude 26");
    expect(screen.getByText("Jude only has 25 verses.")).toBeInTheDocument();
    expect(
      screen.getByText("Keep typing to correct the reference."),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Choose a valid chapter to keep creating the link."),
    ).not.toBeInTheDocument();

    typeAtQuery(editor, "@Jude 1-26");
    expect(screen.getByText("Jude only has 25 verses.")).toBeInTheDocument();

    typeAtQuery(editor, "@Philemon 26");
    expect(
      screen.getByText("Philemon only has 25 verses."),
    ).toBeInTheDocument();
  });

  it("keeps book plus chapter when a multi-chapter verse is out of range", () => {
    render(
      <InlineVerseEditor
        initialBody={EMPTY_NOTE_BODY}
        verseRef={{ book: "John", chapter: 3, startVerse: 16, endVerse: 16 }}
        onChange={() => {}}
      />,
    );

    const editor = screen.getByRole("textbox");
    typeAtQuery(editor, "@John 3:37");
    expect(screen.getByText("John 3 only has 36 verses.")).toBeInTheDocument();
  });

  it("keeps chapter errors for John 0 and an explicit Jude chapter", () => {
    render(
      <InlineVerseEditor
        initialBody={EMPTY_NOTE_BODY}
        verseRef={{ book: "John", chapter: 3, startVerse: 16, endVerse: 16 }}
        onChange={() => {}}
      />,
    );

    const editor = screen.getByRole("textbox");
    typeAtQuery(editor, "@John 0");
    expect(screen.getByText("John has 21 chapters.")).toBeInTheDocument();
    expect(
      screen.getByText("Choose a valid chapter to keep creating the link."),
    ).toBeInTheDocument();

    typeAtQuery(editor, "@Jude 2:1");
    expect(screen.getByText("Jude has 1 chapter.")).toBeInTheDocument();
    expect(
      screen.getByText("Choose a valid chapter to keep creating the link."),
    ).toBeInTheDocument();
  });

  it("keeps book-name completion for an inexact Jude prefix", () => {
    render(
      <InlineVerseEditor
        initialBody={EMPTY_NOTE_BODY}
        verseRef={{ book: "John", chapter: 3, startVerse: 16, endVerse: 16 }}
        onChange={() => {}}
      />,
    );

    const editor = screen.getByRole("textbox");
    typeAtQuery(editor, "@Jud");

    expect(screen.getByText("Jude")).toBeInTheDocument();
    expect(screen.getByText("Judges")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /ready to insert/i }),
    ).not.toBeInTheDocument();
  });

  it.each(singleChapterReadyQueries())(
    "hides book suggestions once %s is a ready verse range",
    (html, readyName) => {
      render(
        <InlineVerseEditor
          initialBody={EMPTY_NOTE_BODY}
          verseRef={{ book: "John", chapter: 3, startVerse: 16, endVerse: 16 }}
          onChange={() => {}}
        />,
      );

      const editor = screen.getByRole("textbox");
      typeAtQuery(editor, html);

      expect(
        screen.getByRole("button", { name: readyName }),
      ).toBeInTheDocument();
      expect(screen.queryByText("Complete book name")).not.toBeInTheDocument();
    },
  );

  it("hides book suggestions after typing @Jude 2-3 one character at a time", () => {
    render(
      <InlineVerseEditor
        initialBody={EMPTY_NOTE_BODY}
        verseRef={{ book: "John", chapter: 1, startVerse: 1, endVerse: 1 }}
        onChange={() => {}}
      />,
    );

    const editor = screen.getByRole("textbox");
    const typed = "@Jude 2-3";
    let soFar = "";
    for (const character of typed) {
      soFar += character;
      typeAtQuery(editor, soFar);
    }

    expect(
      screen.getByRole("button", { name: /Jude 1:2-3 is ready to insert/i }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Complete book name")).not.toBeInTheDocument();
  });

  it.each(singleChapterPartialRangeQueries())(
    "keeps the verse popover open for %s without a book suggestion",
    (html, status) => {
      render(
        <InlineVerseEditor
          initialBody={EMPTY_NOTE_BODY}
          verseRef={{ book: "John", chapter: 3, startVerse: 16, endVerse: 16 }}
          onChange={() => {}}
        />,
      );

      const editor = screen.getByRole("textbox");
      typeAtQuery(editor, html);

      expect(screen.getByText(status)).toBeInTheDocument();
      expect(screen.queryByText("Complete book name")).not.toBeInTheDocument();
    },
  );

  it("still hides the popover for a multi-chapter Book N-M query", () => {
    render(
      <InlineVerseEditor
        initialBody={EMPTY_NOTE_BODY}
        verseRef={{ book: "John", chapter: 3, startVerse: 16, endVerse: 16 }}
        onChange={() => {}}
      />,
    );

    const editor = screen.getByRole("textbox");
    editor.innerHTML = "@John 3-5";
    const textNode = editor.firstChild;
    if (!(textNode instanceof Text)) {
      throw new Error("Expected text node");
    }
    placeCaretAtEnd(textNode);
    act(() => {
      fireEvent.input(editor);
    });

    expect(
      screen.queryByRole("button", { name: /ready to insert/i }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Complete book name")).not.toBeInTheDocument();
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

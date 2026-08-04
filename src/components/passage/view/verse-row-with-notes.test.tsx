import type { ComponentProps } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { VerseRowWithNotes } from "./verse-row-with-notes";
import type { HighlightRange } from "@/lib/highlight-utils";
import type { Id } from "../../../../convex/_generated/dataModel";
import { TooltipProvider } from "@/components/ui/tooltip";

const VERSE_TEXT = "In the beginning";

const HIGHLIGHTS: HighlightRange[] = [
  {
    highlightId: "hl_1",
    startOffset: 0,
    endOffset: VERSE_TEXT.length,
    color: "yellow",
    createdAt: 1,
  },
];

function defaultProps() {
  return {
    verseNumber: 1,
    text: VERSE_TEXT,
    viewMode: "compose" as const,
    selectedVerses: new Set<number>(),
    isInSelectionRange: false,
    isPassageSelection: false,
    singleNotes: [] as never[],
    passageNotes: [] as never[],
    passageAnchor: undefined,
    isPassageRangeActive: false,
    isNoteBubbleHovered: false,
    openVerseKeys: new Set<number>(),
    openPassageKeys: new Set<number>(),
    draftsForThisAnchor: [] as never[],
    editingNoteIds: new Set<Id<"notes">>(),
    onAddNote: vi.fn(),
    onMouseDown: vi.fn(),
    onMouseEnter: vi.fn(),
    onMouseLeave: vi.fn(),
    onSingleBubbleMouseEnter: vi.fn(),
    onSingleBubbleMouseLeave: vi.fn(),
    onPassageBubbleMouseEnter: vi.fn(),
    onPassageBubbleMouseLeave: vi.fn(),
    onOpenVerseNotes: vi.fn(),
    onCloseVerseNotes: vi.fn(),
    onOpenPassageNotes: vi.fn(),
    onClosePassageNotes: vi.fn(),
    onEditNote: vi.fn(),
    onDelete: vi.fn().mockResolvedValue(undefined),
    onSaveEdit: vi.fn().mockResolvedValue(undefined),
    onSaveNew: vi.fn().mockResolvedValue(undefined),
    onCancelEditor: vi.fn(),
    onEditorDirtyChange: vi.fn(),
    onEditorFocus: vi.fn(),
    onStartCreatingPassageNote: vi.fn(),
    onNoteDeleteCleanup: vi.fn(),
    highlights: HIGHLIGHTS,
    onCreateHighlight: vi.fn(),
    onDeleteHighlight: vi.fn(),
    onRecolorHighlight: vi.fn(),
  };
}

function getExpandedMark(container: HTMLElement): HTMLElement {
  const mark = container.querySelector('span[aria-hidden="false"] mark');
  if (!mark) throw new Error("Could not find mark in expanded verse text");
  return mark as HTMLElement;
}

function clickMark(mark: HTMLElement) {
  fireEvent.pointerDown(mark, { clientX: 10, clientY: 10 });
  fireEvent.pointerUp(mark, { clientX: 10, clientY: 10 });
}

function renderVerseRow(props: ComponentProps<typeof VerseRowWithNotes>) {
  return render(
    <TooltipProvider>
      <VerseRowWithNotes {...props} />
    </TooltipProvider>,
  );
}

describe("VerseRowWithNotes – highlight interaction", () => {
  it("keeps highlighted verse text readable in dark mode", () => {
    const props = defaultProps();
    props.openVerseKeys = new Set([1]);
    const { container } = renderVerseRow(props);

    expect(getExpandedMark(container)).toHaveClass(
      "text-foreground",
      "dark:bg-yellow-400/30",
    );
  });

  it("opens the popover when clicking a highlight in an expanded verse", () => {
    const props = defaultProps();
    props.openVerseKeys = new Set([1]);
    const { container } = renderVerseRow(props);

    clickMark(getExpandedMark(container));

    expect(screen.getByTitle("Change to Green")).toBeInTheDocument();
    expect(screen.getByTitle("Remove highlight")).toBeInTheDocument();
  });

  it("invokes the recolor callback and closes the popover on color selection", async () => {
    const user = userEvent.setup();
    const props = defaultProps();
    props.openVerseKeys = new Set([1]);
    const { container } = renderVerseRow(props);

    clickMark(getExpandedMark(container));
    await user.click(screen.getByTitle("Change to Green"));

    expect(props.onRecolorHighlight).toHaveBeenCalledWith("hl_1", "green");
  });

  it("invokes the delete callback and closes the popover on delete", async () => {
    const user = userEvent.setup();
    const props = defaultProps();
    props.openVerseKeys = new Set([1]);
    const { container } = renderVerseRow(props);

    clickMark(getExpandedMark(container));
    await user.click(screen.getByTitle("Remove highlight"));

    expect(props.onDeleteHighlight).toHaveBeenCalledWith("hl_1");
  });

  it("supports keyboard activation on popover buttons", async () => {
    const user = userEvent.setup();
    const props = defaultProps();
    props.openVerseKeys = new Set([1]);
    const { container } = renderVerseRow(props);

    clickMark(getExpandedMark(container));

    screen.getByTitle("Change to Yellow").focus();
    await user.keyboard("{Enter}");

    expect(props.onRecolorHighlight).toHaveBeenCalledWith("hl_1", "yellow");
  });

  it("does not open the popover when clicking a collapsed verse with a highlight", () => {
    const props = defaultProps();
    const { container } = renderVerseRow(props);

    const row = container.querySelector('[data-verse-number="1"]')!;
    fireEvent.mouseDown(row);

    expect(props.onMouseDown).toHaveBeenCalledWith(1);
    expect(screen.queryByTitle("Change to Green")).not.toBeInTheDocument();
  });
});

describe("VerseRowWithNotes – mid-verse headings", () => {
  const FIRST = "Then Nathan went to his house.";
  const SECOND = "  And the LORD afflicted the child, and he became sick.";
  const VERSE = `${FIRST}\n\n${SECOND}`;

  function midVerseProps() {
    const props = defaultProps();
    props.text = VERSE;
    props.highlights = [];
    return {
      ...props,
      midHeadings: [
        { text: "David’s Child Dies", offset: VERSE.indexOf(SECOND) },
      ],
    };
  }

  it("renders the heading between the sentences it interrupts", () => {
    const { container } = renderVerseRow(midVerseProps());

    const verseText = container.querySelector('span[aria-hidden="false"]')!;
    const heading = verseText.querySelector("[data-verse-aside]")!;

    expect(heading).toHaveTextContent("David’s Child Dies");
    expect(heading.nextSibling).toHaveTextContent(SECOND.trim());
    // The paragraph break stays in the DOM, hidden, so highlight offsets still
    // line up with the verse text.
    const brk = heading.previousSibling as HTMLElement;
    expect(brk).toHaveClass("hidden");
    expect(brk.textContent).toBe("\n\n");
    expect(verseText.textContent).toBe(
      `${FIRST}\n\nDavid’s Child Dies${SECOND}`,
    );
  });

  it("keeps the paragraph break when section headers are hidden", () => {
    const { container } = renderVerseRow({
      ...midVerseProps(),
      midHeadings: undefined,
    });

    expect(container.querySelector("[data-verse-aside]")).toBeNull();
    expect(
      container.querySelector('span[aria-hidden="false"]')!.textContent,
    ).toBe(VERSE);
  });

  it("renders mid-verse speaker labels distinctly from section titles", () => {
    const { container } = renderVerseRow({
      ...midVerseProps(),
      midHeadings: [
        { text: "Others", offset: VERSE.indexOf(SECOND), variant: "sub" },
      ],
    });

    const label = container.querySelector("[data-verse-aside]")!;
    expect(label).toHaveTextContent("Others");
    expect(label.className).toContain("font-sans");
  });
});

describe("VerseRowWithNotes – leading headings", () => {
  it("keeps editorial headings and subheadings inside the verse card", () => {
    renderVerseRow({
      ...defaultProps(),
      heading: "The Bride Confesses Her Love",
      subheading: "She",
    });

    expect(
      screen.getByRole("heading", { name: "The Bride Confesses Her Love" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "She" })).toBeInTheDocument();
  });
});

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
    onStartCreatingPassageNote: vi.fn(),
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

function renderVerseRow(props: ReturnType<typeof defaultProps>) {
  return render(
    <TooltipProvider>
      <VerseRowWithNotes {...props} />
    </TooltipProvider>,
  );
}

describe("VerseRowWithNotes – highlight interaction", () => {
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

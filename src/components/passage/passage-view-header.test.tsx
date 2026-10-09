import { render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
  NOTES_CHROME_COMPACT_HIDE_CLASS,
  NOTES_CHROME_COMPACT_LABEL_CLASS,
  NOTES_CHROME_COMPACT_SHORT_CLASS,
  PASSAGE_HEADER_CONTAINER_CLASS,
} from "./header-chrome";
import { PassageViewHeader } from "./passage-view-header";

vi.mock("@/components/bible/chapter-header", () => ({
  ChapterHeader: () => <div data-testid="chapter-header" />,
}));

const baseProps = {
  book: "Mark",
  chapter: 9,
  isScrolled: false,
  passageGridClass: "grid-cols-2",
  headerInnerClass: "",
  hasAnyNotes: false,
  noteVisibility: "all" as const,
  chapterNotesCount: 0,
  maxNotesPerVerse: 0,
  setViewModeWithNotesReset: vi.fn(),
  setNoteVisibility: vi.fn(),
  onToggleFocusMode: vi.fn(),
  onToggleSectionHeaders: vi.fn(),
  showSectionHeaders: false,
  isFocusMode: false,
};

function renderHeader(
  overrides: Partial<ComponentProps<typeof PassageViewHeader>> = {},
) {
  return render(
    <TooltipProvider delayDuration={0}>
      <PassageViewHeader
        {...baseProps}
        effectiveViewMode="read"
        isReadMode
        {...overrides}
      />
    </TooltipProvider>,
  );
}

describe("PassageViewHeader compact chrome", () => {
  it("compacts Compose/Read to shortcut chips when the header is tight", () => {
    const { container } = renderHeader();
    expect(
      container.querySelector(`[class*='${PASSAGE_HEADER_CONTAINER_CLASS}']`),
    ).not.toBeNull();

    expect(screen.getByText("Compose").className).toContain(
      NOTES_CHROME_COMPACT_LABEL_CLASS,
    );
    expect(screen.getByText("Read").className).toContain(
      NOTES_CHROME_COMPACT_LABEL_CLASS,
    );
    expect(screen.getByText("C")).toBeInTheDocument();
    expect(screen.getByText("R")).toBeInTheDocument();
  });

  it("shortens the empty-notes copy and verse-visibility labels when compact", () => {
    const { rerender } = renderHeader({ hasAnyNotes: false });
    const emptyMessage = screen.getByText("No notes for this chapter");
    expect(emptyMessage.className).toContain(NOTES_CHROME_COMPACT_HIDE_CLASS);
    expect(screen.getByText("No notes").className).toContain(
      NOTES_CHROME_COMPACT_SHORT_CLASS,
    );

    rerender(
      <TooltipProvider delayDuration={0}>
        <PassageViewHeader
          {...baseProps}
          effectiveViewMode="read"
          isReadMode
          hasAnyNotes
        />
      </TooltipProvider>,
    );

    expect(screen.getByText("All Verses").className).toContain(
      NOTES_CHROME_COMPACT_HIDE_CLASS,
    );
    expect(screen.getByText("All").className).toContain(
      NOTES_CHROME_COMPACT_SHORT_CLASS,
    );
    expect(screen.getByText("Only Verses with Notes").className).toContain(
      NOTES_CHROME_COMPACT_HIDE_CLASS,
    );
    expect(screen.getByText("Noted").className).toContain(
      NOTES_CHROME_COMPACT_SHORT_CLASS,
    );
  });

  it("keeps the Focus shortcut and hides the word in compact chrome", () => {
    renderHeader({
      effectiveViewMode: "compose",
      isReadMode: false,
    });
    expect(screen.getByText("Focus").className).toContain(
      NOTES_CHROME_COMPACT_LABEL_CLASS,
    );
    expect(screen.getByText("F")).toBeInTheDocument();
  });
});

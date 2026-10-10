import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
  NOTES_CHROME_COMPACT_HIDE_CLASS,
  NOTES_CHROME_COMPACT_LABEL_CLASS,
  NOTES_CHROME_COMPACT_SHORT_CLASS,
  NOTES_CHROME_COMPACT_SR_CLASS,
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

    const allVerses = screen.getByText("All Verses");
    const notedLabel = screen.getByText("Only Verses with Notes");
    expect(allVerses.className).toContain(NOTES_CHROME_COMPACT_SR_CLASS);
    expect(allVerses.className).not.toContain(NOTES_CHROME_COMPACT_HIDE_CLASS);
    expect(screen.getByText("All").className).toContain(
      NOTES_CHROME_COMPACT_SHORT_CLASS,
    );
    expect(notedLabel.className).toContain(NOTES_CHROME_COMPACT_SR_CLASS);
    expect(notedLabel.className).not.toContain(NOTES_CHROME_COMPACT_HIDE_CLASS);
    expect(screen.getByText("Noted").className).toContain(
      NOTES_CHROME_COMPACT_SHORT_CLASS,
    );

    const allButton = screen.getByRole("button", { name: /All Verses/ });
    const notedButton = screen.getByRole("button", { name: /Noted/ });
    expect(allButton).not.toHaveAttribute("aria-label");
    expect(notedButton).not.toHaveAttribute("aria-label");
    expect(allButton).toHaveAccessibleName(/All Verses/);
    expect(allButton).toHaveAccessibleName(/\bAll\b/);
    expect(notedButton).toHaveAccessibleName(/Only Verses with Notes/);
    expect(notedButton).toHaveAccessibleName(/Noted/);
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

  it("shows the Focus tooltip when the switch is focused from the keyboard", async () => {
    const user = userEvent.setup();
    renderHeader({
      effectiveViewMode: "compose",
      isReadMode: false,
    });

    const focusSwitch = screen.getByRole("switch", { name: /Focus/ });
    await user.tab();

    expect(focusSwitch).toHaveFocus();
    const tooltip = await screen.findByRole("tooltip", {
      name: "Turn on focus mode",
    });
    expect(focusSwitch.getAttribute("aria-describedby")).toBe(tooltip.id);
  });
});

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
    const notedWide = screen.getByText("Only Verses with Notes");
    const notedCompact = screen.getByText("Noted, Only Verses with Notes");
    expect(allVerses.className).toContain(NOTES_CHROME_COMPACT_SR_CLASS);
    expect(allVerses.className).not.toContain(NOTES_CHROME_COMPACT_HIDE_CLASS);
    const allShort = screen.getByText("All");
    expect(allShort.className).toContain(NOTES_CHROME_COMPACT_SHORT_CLASS);
    expect(allShort).toHaveAttribute("aria-hidden", "true");
    expect(notedWide.parentElement).toHaveClass(NOTES_CHROME_COMPACT_SR_CLASS);
    expect(notedWide.parentElement?.className).not.toContain(
      NOTES_CHROME_COMPACT_HIDE_CLASS,
    );
    // Wide copy drops out of the tree at compact so the name is the phrase
    // that still contains the visible word, not both strings at once.
    expect(notedWide.className).toContain("@max-6xl/passage-header:hidden");
    expect(notedCompact.className).toContain("hidden");
    expect(notedCompact.className).toContain("@max-6xl/passage-header:inline");
    const notedShort = screen.getByText("Noted");
    expect(notedShort.className).toContain(NOTES_CHROME_COMPACT_SHORT_CLASS);
    expect(notedShort).toHaveAttribute("aria-hidden", "true");

    const allButton = screen.getByRole("button", { name: /All Verses/ });
    const notedButton = screen.getByRole("button", { name: /Noted/ });
    expect(allButton).not.toHaveAttribute("aria-label");
    expect(notedButton).not.toHaveAttribute("aria-label");
    // "All Verses" already contains the visible word, so the name is not "All Verses All".
    expect(allButton).toHaveAccessibleName("All Verses");
    // Compact copy leads with the visible word so label-in-name still holds.
    expect(notedButton).toHaveAccessibleName(/Noted, Only Verses with Notes/);
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
    expect(focusSwitch).toHaveAttribute("data-state", "unchecked");
    expect(focusSwitch.closest("[data-slot='tooltip-trigger']")).not.toBe(
      focusSwitch,
    );
  });

  it("dismisses the Focus tooltip on Escape without toggling the switch", async () => {
    const user = userEvent.setup();
    renderHeader({
      effectiveViewMode: "compose",
      isReadMode: false,
    });

    const focusSwitch = screen.getByRole("switch", { name: /Focus/ });
    await user.tab();
    expect(focusSwitch).toHaveFocus();
    expect(
      await screen.findByRole("tooltip", { name: "Turn on focus mode" }),
    ).toBeInTheDocument();

    await user.keyboard("{Escape}");

    expect(
      screen.queryByRole("tooltip", { name: "Turn on focus mode" }),
    ).not.toBeInTheDocument();
    expect(focusSwitch).toHaveAttribute("data-state", "unchecked");
    expect(focusSwitch).toHaveFocus();
  });

  it("dismisses a hovered Focus tooltip on Escape", async () => {
    const user = userEvent.setup();
    renderHeader({
      effectiveViewMode: "compose",
      isReadMode: false,
    });

    await user.hover(screen.getByText("Focus"));
    expect(
      await screen.findByRole("tooltip", { name: "Turn on focus mode" }),
    ).toBeInTheDocument();

    await user.keyboard("{Escape}");

    expect(
      screen.queryByRole("tooltip", { name: "Turn on focus mode" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("switch", { name: /Focus/ })).toHaveAttribute(
      "data-state",
      "unchecked",
    );
  });
});

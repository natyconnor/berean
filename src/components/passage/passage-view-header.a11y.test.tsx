import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import { PassageViewHeader } from "./passage-view-header";

vi.mock("@/lib/use-tabs", () => ({
  useTabs: () => ({
    navigateActiveTab: vi.fn(),
    openTab: vi.fn(),
  }),
}));

function renderHeader() {
  return render(
    <TooltipProvider delayDuration={0}>
      <PassageViewHeader
        book="John"
        chapter={1}
        isScrolled={false}
        passageGridClass=""
        headerInnerClass=""
        effectiveViewMode="compose"
        isReadMode={false}
        isFocusMode={false}
        showSectionHeaders={false}
        hasAnyNotes={false}
        noteVisibility="all"
        chapterNotesCount={0}
        maxNotesPerVerse={0}
        setViewModeWithNotesReset={vi.fn()}
        setNoteVisibility={vi.fn()}
        onToggleFocusMode={vi.fn()}
        onToggleSectionHeaders={vi.fn()}
      />
    </TooltipProvider>,
  );
}

describe("PassageViewHeader switch names", () => {
  it("associates the Headers and Focus switches with their visible labels", () => {
    renderHeader();

    const headers = screen.getByRole("switch", { name: /^Headers/ });
    expect(headers).toHaveAttribute("id", "passage-section-headers");
    expect(headers).not.toHaveAttribute("aria-label");
    expect(screen.getByLabelText(/^Headers/)).toBe(headers);
    expect(
      document.querySelector('label[for="passage-section-headers"]'),
    ).toHaveTextContent("Headers");

    const focus = screen.getByRole("switch", { name: /^Focus/ });
    expect(focus).toHaveAttribute("id", "passage-focus-mode");
    expect(focus).not.toHaveAttribute("aria-label");
    expect(screen.getByLabelText(/^Focus/)).toBe(focus);
    expect(
      document.querySelector('label[for="passage-focus-mode"]'),
    ).toHaveTextContent("Focus");
  });
});

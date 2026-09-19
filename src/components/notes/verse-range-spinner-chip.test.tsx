import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import { VerseRangeSpinnerChip } from "./verse-range-spinner-chip";
import type { VerseRef } from "@/lib/verse-ref-utils";

function renderChip(verseRef: VerseRef, onNudge = vi.fn(), disabled = false) {
  return {
    onNudge,
    ...render(
      <TooltipProvider delayDuration={0}>
        <VerseRangeSpinnerChip
          verseRef={verseRef}
          onNudge={onNudge}
          disabled={disabled}
        />
      </TooltipProvider>,
    ),
  };
}

function revealChip() {
  fireEvent.pointerEnter(screen.getByTestId("verse-range-spinner-chip"));
}

describe("VerseRangeSpinnerChip", () => {
  it("looks like a normal badge until hover reveals the steppers", () => {
    renderChip({
      book: "John",
      chapter: 1,
      startVerse: 16,
      endVerse: 16,
    });

    expect(screen.getByText("John 1:")).toBeInTheDocument();
    expect(screen.getByText("16")).toBeInTheDocument();
    expect(screen.getByTestId("verse-range-spinner-chip")).toHaveAttribute(
      "data-revealed",
      "false",
    );
    expect(
      screen.queryByRole("button", { name: "Add next verse" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Add previous verse" }),
    ).not.toBeInTheDocument();
  });

  it("grows either end of a single verse from the spinner chevrons", async () => {
    const user = userEvent.setup();
    const { onNudge } = renderChip({
      book: "John",
      chapter: 1,
      startVerse: 16,
      endVerse: 16,
    });

    revealChip();
    expect(screen.getByTestId("verse-range-spinner-chip")).toHaveAttribute(
      "data-revealed",
      "true",
    );

    await user.click(screen.getByRole("button", { name: "Add next verse" }));
    expect(onNudge).toHaveBeenCalledWith({
      book: "John",
      chapter: 1,
      startVerse: 16,
      endVerse: 17,
    });

    onNudge.mockClear();
    await user.click(
      screen.getByRole("button", { name: "Add previous verse" }),
    );
    expect(onNudge).toHaveBeenCalledWith({
      book: "John",
      chapter: 1,
      startVerse: 15,
      endVerse: 16,
    });
  });

  it("lets each end of a range step independently", async () => {
    const user = userEvent.setup();
    const { onNudge } = renderChip({
      book: "John",
      chapter: 1,
      startVerse: 15,
      endVerse: 17,
    });

    revealChip();
    await user.click(
      screen.getByRole("button", { name: "Add previous verse" }),
    );
    expect(onNudge).toHaveBeenCalledWith({
      book: "John",
      chapter: 1,
      startVerse: 14,
      endVerse: 17,
    });

    onNudge.mockClear();
    await user.click(screen.getByRole("button", { name: "Remove last verse" }));
    expect(onNudge).toHaveBeenCalledWith({
      book: "John",
      chapter: 1,
      startVerse: 15,
      endVerse: 16,
    });

    onNudge.mockClear();
    await user.click(
      screen.getByRole("button", { name: "Remove first verse" }),
    );
    expect(onNudge).toHaveBeenCalledWith({
      book: "John",
      chapter: 1,
      startVerse: 16,
      endVerse: 17,
    });

    onNudge.mockClear();
    await user.click(screen.getByRole("button", { name: "Add next verse" }));
    expect(onNudge).toHaveBeenCalledWith({
      book: "John",
      chapter: 1,
      startVerse: 15,
      endVerse: 18,
    });
  });

  it("disables grow at chapter bounds on a single verse", () => {
    renderChip({
      book: "John",
      chapter: 1,
      startVerse: 1,
      endVerse: 1,
    });

    revealChip();

    expect(
      screen.getByRole("button", { name: "Add previous verse" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Add next verse" }),
    ).toBeEnabled();
    expect(
      screen.queryByRole("button", { name: "Remove first verse" }),
    ).not.toBeInTheDocument();
  });

  it("pins the steppers on tap when hover is unavailable", async () => {
    const user = userEvent.setup();
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
      onchange: null,
    }));

    renderChip({
      book: "John",
      chapter: 1,
      startVerse: 16,
      endVerse: 16,
    });

    await user.click(screen.getByTestId("verse-range-spinner-chip"));
    expect(screen.getByTestId("verse-range-spinner-chip")).toHaveAttribute(
      "data-revealed",
      "true",
    );
    expect(
      screen.getByRole("button", { name: "Add next verse" }),
    ).toBeInTheDocument();
  });
});

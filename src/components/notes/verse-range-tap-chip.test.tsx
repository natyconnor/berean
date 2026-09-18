import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import { VerseRangeTapChip } from "./verse-range-tap-chip";
import type { VerseRef } from "@/lib/verse-ref-utils";

function renderChip(verseRef: VerseRef, onNudge = vi.fn(), disabled = false) {
  return {
    onNudge,
    ...render(
      <TooltipProvider delayDuration={0}>
        <VerseRangeTapChip
          verseRef={verseRef}
          onNudge={onNudge}
          disabled={disabled}
        />
      </TooltipProvider>,
    ),
  };
}

describe("VerseRangeTapChip", () => {
  it("looks like a normal badge until a verse number is tapped", () => {
    renderChip({
      book: "John",
      chapter: 1,
      startVerse: 16,
      endVerse: 16,
    });

    expect(screen.getByText("John 1:")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Verse 16, tap to adjust" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Add next verse" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByTestId("armed-verse-number")).not.toBeInTheDocument();
  });

  it("arms a single verse and grows either end from inside the number box", async () => {
    const user = userEvent.setup();
    const { onNudge } = renderChip({
      book: "John",
      chapter: 1,
      startVerse: 16,
      endVerse: 16,
    });

    await user.click(
      screen.getByRole("button", { name: "Verse 16, tap to adjust" }),
    );

    expect(screen.getByTestId("armed-verse-number")).toBeInTheDocument();
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

  it("lets each end of a range be armed independently", async () => {
    const user = userEvent.setup();
    const { onNudge } = renderChip({
      book: "John",
      chapter: 1,
      startVerse: 15,
      endVerse: 17,
    });

    await user.click(
      screen.getByRole("button", {
        name: "Starting verse 15, tap to adjust",
      }),
    );
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
    await user.click(
      screen.getByRole("button", { name: "Ending verse 17, tap to adjust" }),
    );
    await user.click(screen.getByRole("button", { name: "Remove last verse" }));
    expect(onNudge).toHaveBeenCalledWith({
      book: "John",
      chapter: 1,
      startVerse: 15,
      endVerse: 16,
    });
  });

  it("disables shrink on a single verse and grow at chapter bounds", async () => {
    const user = userEvent.setup();
    const { onNudge } = renderChip({
      book: "John",
      chapter: 1,
      startVerse: 1,
      endVerse: 1,
    });

    await user.click(
      screen.getByRole("button", { name: "Verse 1, tap to adjust" }),
    );

    expect(
      screen.getByRole("button", { name: "Add previous verse" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Add next verse" }),
    ).toBeEnabled();
    expect(
      screen.queryByRole("button", { name: "Remove first verse" }),
    ).not.toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: "Add previous verse" }),
    );
    expect(onNudge).not.toHaveBeenCalled();
  });
});

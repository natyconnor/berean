import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { TooltipProvider } from "@/components/ui/tooltip";

import { StudyScopeBookPicker } from "./study-scope-book-picker";
import { useScopeForm } from "./use-scope-form";

function PickerHarness({
  emptyChapterSelection = false,
}: {
  emptyChapterSelection?: boolean;
}) {
  const form = useScopeForm({
    requireChapterSelection: emptyChapterSelection,
  });
  return (
    <TooltipProvider delayDuration={0}>
      <StudyScopeBookPicker
        selectedBooks={form.selectedBooks}
        chapterRanges={form.chapterRanges}
        onToggleBook={form.onToggleBook}
        onSetBooks={form.onSetBooks}
        onSetChapterRange={form.onSetChapterRange}
        emptyChapterSelection={emptyChapterSelection}
      />
    </TooltipProvider>
  );
}

describe("StudyScopeBookPicker", () => {
  it("highlights every chapter of a selected book by default", async () => {
    render(<PickerHarness />);

    await userEvent.click(screen.getByRole("button", { name: /Genesis/ }));

    expect(screen.getByText(/All 50 chapters/)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Select all" }),
    ).not.toBeInTheDocument();
  });

  it("starts with no chapters selected in pack-builder mode", async () => {
    render(<PickerHarness emptyChapterSelection />);

    await userEvent.click(screen.getByRole("button", { name: /Genesis/ }));

    expect(screen.getByText(/No chapters selected/)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Select all" }),
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "1" }));
    expect(screen.getByText(/Chapter 1/)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Select all" }),
    ).not.toBeInTheDocument();

    await userEvent.click(
      screen.getByRole("button", { name: "Clear selection" }),
    );
    expect(screen.getByText(/No chapters selected/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Select all" }));
    expect(screen.getByText(/All 50 chapters/)).toBeInTheDocument();
  });
});

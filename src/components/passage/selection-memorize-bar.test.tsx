import type { ComponentProps } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { TooltipProvider } from "@/components/ui/tooltip";

import { SelectionMemorizeBar } from "./selection-memorize-bar";

function renderBar(
  overrides: Partial<ComponentProps<typeof SelectionMemorizeBar>> = {},
) {
  const props = {
    reference: "Psalm 1:5–6",
    hearted: false,
    stopsMemorizing: false,
    onToggleHeart: vi.fn(),
    onOfferChoices: vi.fn(),
    onClear: vi.fn(),
    ...overrides,
  };
  render(
    <TooltipProvider>
      <SelectionMemorizeBar {...props} />
    </TooltipProvider>,
  );
  return props;
}

describe("SelectionMemorizeBar", () => {
  it("shows the range with Heart and clear, and no Memorize", async () => {
    const user = userEvent.setup();
    const props = renderBar();

    const toolbar = screen.getByRole("toolbar", {
      name: "Selected verses, Psalm 1:5–6",
    });
    expect(toolbar).toHaveTextContent("Psalm 1:5–6");
    expect(
      screen.queryByRole("button", { name: "Memorize" }),
    ).not.toBeInTheDocument();

    const heart = screen.getByRole("button", { name: "Heart Verses" });
    expect(heart).toHaveTextContent("Heart Verses");
    expect(heart).toHaveAccessibleName("Heart Verses");
    expect(heart).toHaveAttribute("aria-pressed", "false");
    await user.click(heart);
    expect(props.onToggleHeart).toHaveBeenCalledWith(heart);
    expect(props.onOfferChoices).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Clear selection" }));
    expect(props.onClear).toHaveBeenCalledOnce();
  });

  it("offers Memorize or Unheart when Hearted is clicked", async () => {
    const user = userEvent.setup();
    const props = renderBar({ hearted: true });

    const heart = screen.getByRole("button", {
      name: "Hearted. Memorize or unheart",
    });
    expect(heart).toHaveAttribute("aria-pressed", "true");
    expect(heart).toHaveTextContent("Hearted");
    await user.click(heart);

    expect(props.onOfferChoices).toHaveBeenCalledWith(heart);
    expect(props.onToggleHeart).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("unhearts right away when it offers no choices", async () => {
    const user = userEvent.setup();
    const props = renderBar({ hearted: true, onOfferChoices: undefined });

    const heart = screen.getByRole("button", { name: "Hearted" });
    await user.click(heart);
    expect(props.onToggleHeart).toHaveBeenCalledWith(heart);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("asks the memorizing confirm when unhearting stops memorizing", async () => {
    const user = userEvent.setup();
    const props = renderBar({ hearted: true, stopsMemorizing: true });

    const heart = screen.getByRole("button", { name: "Hearted" });
    await user.click(heart);
    const dialog = screen.getByRole("alertdialog", {
      name: "Unheart Psalm 1:5–6?",
    });
    expect(dialog).toHaveTextContent("Unhearting also stops memorizing it.");
    expect(props.onOfferChoices).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Keep" }));
    expect(props.onToggleHeart).not.toHaveBeenCalled();
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();

    await user.click(heart);
    await user.click(screen.getByRole("button", { name: "Unheart and stop" }));
    expect(props.onToggleHeart).toHaveBeenCalledWith(heart);
  });

  it("labels a multi-verse heart Heart Verses and has no tooltip", async () => {
    const user = userEvent.setup();
    renderBar();

    const heart = screen.getByRole("button", { name: "Heart Verses" });
    expect(heart).toHaveTextContent("Heart Verses");
    expect(heart).toHaveAccessibleName("Heart Verses");
    await user.hover(heart);
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("uses 44px targets when pinned for touch", () => {
    renderBar({ pinned: true });
    expect(screen.getByRole("button", { name: "Heart Verses" })).toHaveClass(
      "h-11",
    );
    expect(screen.getByRole("button", { name: "Clear selection" })).toHaveClass(
      "size-11",
    );
  });
});

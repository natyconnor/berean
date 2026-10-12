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
    startVerse: 5,
    endVerse: 6,
    hearted: false,
    stopsMemorizing: false,
    onToggleHeart: vi.fn(),
    onMemorize: vi.fn(),
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
  it("shows the range with Heart, Memorize and clear", async () => {
    const user = userEvent.setup();
    const props = renderBar();

    const toolbar = screen.getByRole("toolbar", {
      name: "Selected verses, Psalm 1:5–6",
    });
    expect(toolbar).toHaveTextContent("Psalm 1:5–6");

    const heart = screen.getByRole("button", { name: "Heart" });
    expect(heart).toHaveAttribute("aria-pressed", "false");
    await user.click(heart);
    expect(props.onToggleHeart).toHaveBeenCalledWith(heart);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    const memorize = screen.getByRole("button", { name: "Memorize" });
    await user.click(memorize);
    expect(props.onMemorize).toHaveBeenCalledWith(memorize);

    await user.click(screen.getByRole("button", { name: "Clear selection" }));
    expect(props.onClear).toHaveBeenCalledOnce();
  });

  it("asks the plain passage confirm before unhearting a hearted range", async () => {
    const user = userEvent.setup();
    const props = renderBar({ hearted: true });

    const heart = screen.getByRole("button", { name: "Hearted" });
    expect(heart).toHaveAttribute("aria-pressed", "true");
    await user.click(heart);

    expect(
      screen.getByRole("dialog", { name: "Remove this passage?" }),
    ).toBeInTheDocument();
    expect(props.onToggleHeart).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Unheart passage" }));
    expect(props.onToggleHeart).toHaveBeenCalledWith(heart);
  });

  it("asks the memorizing confirm only when unhearting stops memorizing", async () => {
    const user = userEvent.setup();
    const props = renderBar({ hearted: true, stopsMemorizing: true });

    await user.click(screen.getByRole("button", { name: "Hearted" }));
    const dialog = screen.getByRole("alertdialog", {
      name: "Unheart Psalm 1:5–6?",
    });
    expect(dialog).toHaveTextContent("Unhearting also stops memorizing it.");

    await user.click(screen.getByRole("button", { name: "Keep" }));
    expect(props.onToggleHeart).not.toHaveBeenCalled();
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Hearted" }));
    await user.click(screen.getByRole("button", { name: "Unheart and stop" }));
    expect(props.onToggleHeart).toHaveBeenCalledOnce();
  });

  it("uses 44px targets when pinned for touch", () => {
    renderBar({ pinned: true });
    expect(screen.getByRole("button", { name: "Heart" })).toHaveClass("h-11");
    expect(screen.getByRole("button", { name: "Memorize" })).toHaveClass(
      "h-11",
    );
    expect(screen.getByRole("button", { name: "Clear selection" })).toHaveClass(
      "size-11",
    );
  });
});

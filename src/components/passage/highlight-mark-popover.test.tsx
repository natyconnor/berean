import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { HighlightMarkPopover } from "./highlight-mark-popover";

const anchorRect = {
  top: 120,
  left: 160,
  bottom: 140,
  right: 220,
  width: 60,
  height: 20,
  x: 160,
  y: 120,
  toJSON: () => ({}),
} satisfies DOMRect;

describe("HighlightMarkPopover", () => {
  it("recolors a highlight on click", async () => {
    const user = userEvent.setup();
    const onRecolor = vi.fn();

    render(
      <HighlightMarkPopover
        anchorRect={anchorRect}
        highlightId="hl_123"
        currentColor="yellow"
        onDelete={() => {}}
        onRecolor={onRecolor}
        onClose={() => {}}
      />,
    );

    await user.click(screen.getByTitle("Change to Green"));

    expect(onRecolor).toHaveBeenCalledWith("green");
  });

  it("deletes a highlight on click", async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn();

    render(
      <HighlightMarkPopover
        anchorRect={anchorRect}
        highlightId="hl_123"
        currentColor="yellow"
        onDelete={onDelete}
        onRecolor={() => {}}
        onClose={() => {}}
      />,
    );

    await user.click(screen.getByTitle("Remove highlight"));

    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it("supports keyboard activation for recolor", async () => {
    const user = userEvent.setup();
    const onRecolor = vi.fn();

    render(
      <HighlightMarkPopover
        anchorRect={anchorRect}
        highlightId="hl_123"
        currentColor="yellow"
        onDelete={() => {}}
        onRecolor={onRecolor}
        onClose={() => {}}
      />,
    );

    await user.tab();
    await user.keyboard("{Enter}");

    expect(onRecolor).toHaveBeenCalledWith("yellow");
  });

  it("supports keyboard activation for delete", async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn();

    render(
      <HighlightMarkPopover
        anchorRect={anchorRect}
        highlightId="hl_123"
        currentColor="yellow"
        onDelete={onDelete}
        onRecolor={() => {}}
        onClose={() => {}}
      />,
    );

    const deleteButton = screen.getByTitle("Remove highlight");
    deleteButton.focus();
    await user.keyboard("{Enter}");

    expect(onDelete).toHaveBeenCalledTimes(1);
  });
});

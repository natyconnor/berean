import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { TooltipProvider } from "@/components/ui/tooltip";

import {
  PassageRailGutter,
  PassageRailPastHeadings,
  type PassageRailHeart,
  type PassageRailMark,
} from "./passage-heart-rail";

function heart(overrides: Partial<PassageRailHeart> = {}): PassageRailHeart {
  return {
    learnedFraction: 4 / 11,
    tooltip: "Psalm 16 · memorizing · 4 of 11 learned",
    ariaLabel:
      "Psalm 16, hearted. Memorizing: 4 of 11 verses learned. Remove heart",
    title: "Psalm 16",
    startVerse: 1,
    endVerse: 11,
    stopsMemorizing: true,
    onUnheart: vi.fn(),
    ...overrides,
  };
}

function renderGutter(mark: PassageRailMark) {
  return render(
    <TooltipProvider delayDuration={0}>
      <div className="relative">
        <PassageRailGutter mark={mark} />
      </div>
    </TooltipProvider>,
  );
}

describe("PassageRailGutter", () => {
  it("draws the passage heart with a partial ring and its tooltip", async () => {
    const user = userEvent.setup();
    renderGutter({ stroke: "solid", heart: heart() });

    const button = screen.getByRole("button", {
      name: "Psalm 16, hearted. Memorizing: 4 of 11 verses learned. Remove heart",
    });
    const progress = button.querySelector("[data-ring-progress]");
    expect(progress).not.toBeNull();
    const dash = Number(progress?.getAttribute("stroke-dasharray"));
    const offset = Number(progress?.getAttribute("stroke-dashoffset"));
    expect(1 - offset / dash).toBeCloseTo(4 / 11);

    await user.hover(button);
    expect(
      await screen.findByRole("tooltip", {
        name: "Psalm 16 · memorizing · 4 of 11 learned",
      }),
    ).toBeInTheDocument();
  });

  it("asks before unhearting, and Keep changes nothing", async () => {
    const user = userEvent.setup();
    const onUnheart = vi.fn();
    renderGutter({ stroke: "solid", heart: heart({ onUnheart }) });

    const button = screen.getByRole("button", { name: /Psalm 16, hearted/ });
    await user.click(button);
    const dialog = screen.getByRole("alertdialog", {
      name: "Unheart Psalm 16?",
    });
    expect(dialog).toHaveTextContent("Unhearting also stops memorizing it.");
    await user.click(screen.getByRole("button", { name: "Keep" }));
    expect(onUnheart).not.toHaveBeenCalled();

    await user.click(button);
    await user.click(screen.getByRole("button", { name: "Unheart and stop" }));
    expect(onUnheart).toHaveBeenCalledTimes(1);
  });

  it("highlights the passage's verses while the heart is hovered", async () => {
    const user = userEvent.setup();
    const onHoverChange = vi.fn();
    renderGutter({ stroke: "solid", heart: heart({ onHoverChange }) });

    const button = screen.getByRole("button", { name: /Psalm 16, hearted/ });
    await user.hover(button);
    expect(onHoverChange).toHaveBeenLastCalledWith(true);
    await user.unhover(button);
    expect(onHoverChange).toHaveBeenLastCalledWith(false);
  });

  it("draws a plain segment, with nothing across the rail's end", () => {
    const { container } = renderGutter({ stroke: "dashed", heart: null });
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    const lane = container.querySelector("[data-passage-rail]");
    expect(lane).toHaveAttribute("data-passage-rail", "dashed");
    expect(lane?.children).toHaveLength(1);
  });
});

describe("PassageRailPastHeadings", () => {
  it("adds a rail beside headings only when the rail runs past them", () => {
    const { container, rerender } = render(
      <PassageRailPastHeadings stroke="faint">
        <h2>Heading</h2>
      </PassageRailPastHeadings>,
    );
    expect(screen.getByRole("heading", { name: "Heading" })).toBeVisible();
    expect(container.querySelector("[data-passage-rail]")).toHaveAttribute(
      "data-passage-rail",
      "faint",
    );

    rerender(
      <PassageRailPastHeadings stroke={null}>
        <h2>Heading</h2>
      </PassageRailPastHeadings>,
    );
    expect(screen.getByRole("heading", { name: "Heading" })).toBeVisible();
    expect(container.querySelector("[data-passage-rail]")).toBeNull();
  });
});

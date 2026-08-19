import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import { HEATMAP_FUTURE_WEEKS } from "@/lib/practice-heatmap";
import { PracticeHeatmap } from "./practice-heatmap";

function localDay(year: number, monthIndex: number, day: number): number {
  return new Date(year, monthIndex, day).getTime();
}

describe("PracticeHeatmap", () => {
  it("keeps cells a fixed size and pads through two future weeks", () => {
    const wednesday = localDay(2024, 0, 10);
    render(
      <TooltipProvider delayDuration={0}>
        <PracticeHeatmap data={[{ dayStart: wednesday, count: 3 }]} />
      </TooltipProvider>,
    );

    const today = screen.getByRole("button", { name: /Jan 10/ });
    expect(today).toHaveClass("size-3");
    expect(today).not.toHaveClass("w-full");

    // Rest of the current week (Thu–Sat) plus two future weeks ending Sat 27.
    expect(
      screen.getByRole("button", { name: /Jan 13.*0 practices/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Jan 27.*0 practices/ }),
    ).toBeInTheDocument();

    expect(screen.getAllByRole("button")).toHaveLength(
      1 + 3 + HEATMAP_FUTURE_WEEKS * 7,
    );
  });
});

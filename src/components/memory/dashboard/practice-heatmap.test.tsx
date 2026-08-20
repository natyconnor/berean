import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import { PracticeHeatmap } from "./practice-heatmap";

function localDay(year: number, monthIndex: number, day: number): number {
  return new Date(year, monthIndex, day).getTime();
}

describe("PracticeHeatmap", () => {
  it("keeps cells a fixed size and ends on today without future days", () => {
    const wednesday = localDay(2024, 0, 10);
    render(
      <TooltipProvider delayDuration={0}>
        <PracticeHeatmap data={[{ dayStart: wednesday, count: 3 }]} />
      </TooltipProvider>,
    );

    const today = screen.getByRole("button", { name: /Jan 10/ });
    expect(today).toHaveClass("size-3");
    expect(today).not.toHaveClass("w-full");
    expect(screen.getAllByRole("button")).toHaveLength(1);
    expect(
      screen.queryByRole("button", { name: /Jan 11.*0 practices/ }),
    ).not.toBeInTheDocument();
  });
});

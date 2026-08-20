import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AccuracyTrend } from "./accuracy-trend";

const DAY_MS = 86_400_000;

function mockSvgRect(svg: Element) {
  vi.spyOn(svg, "getBoundingClientRect").mockReturnValue({
    x: 0,
    y: 0,
    top: 0,
    left: 0,
    bottom: 96,
    right: 300,
    width: 300,
    height: 96,
    toJSON: () => ({}),
  });
}

describe("AccuracyTrend", () => {
  const start = Date.UTC(2024, 6, 20);
  const data = [
    { dayStart: start, average: 100, count: 1 },
    { dayStart: start + DAY_MS, average: null, count: 0 },
    { dayStart: start + 2 * DAY_MS, average: 87.5, count: 2 },
  ];

  it("shows the exact daily percent and attempt count on hover", () => {
    render(<AccuracyTrend data={data} />);

    const svg = screen.getByRole("img", { name: /Accuracy trend/ });
    mockSvgRect(svg);
    fireEvent.pointerMove(svg, { clientX: 300, clientY: 20 });

    const tooltip = screen.getByRole("tooltip");
    expect(tooltip).toHaveTextContent("87.5%");
    expect(tooltip).toHaveTextContent("2 attempts");
  });

  it("shows an empty-day tooltip when hovering a day with no attempts", () => {
    render(<AccuracyTrend data={data} />);

    const svg = screen.getByRole("img", { name: /Accuracy trend/ });
    mockSvgRect(svg);
    fireEvent.pointerMove(svg, { clientX: 150, clientY: 20 });

    expect(screen.getByRole("tooltip")).toHaveTextContent("No attempts");
  });

  it("hides the tooltip when the pointer leaves the chart", () => {
    render(<AccuracyTrend data={data} />);

    const svg = screen.getByRole("img", { name: /Accuracy trend/ });
    mockSvgRect(svg);
    fireEvent.pointerMove(svg, { clientX: 300, clientY: 20 });
    expect(screen.getByRole("tooltip")).toBeInTheDocument();

    fireEvent.pointerLeave(svg);
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });
});

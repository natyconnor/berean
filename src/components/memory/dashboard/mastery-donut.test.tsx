import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MasteryDonut, type MasteryDistribution } from "./mastery-donut";

const unstarted: MasteryDistribution = {
  new: 31,
  learning: 0,
  reviewing: 0,
  mastered: 0,
  total: 31,
};

const mixed: MasteryDistribution = {
  new: 21,
  learning: 5,
  reviewing: 6,
  mastered: 3,
  total: 35,
};

describe("MasteryDonut", () => {
  it("ignores unstarted verses in the empty state", () => {
    render(<MasteryDonut data={unstarted} />);

    expect(screen.getByText("0 started")).toBeInTheDocument();
    expect(
      screen.getByText(
        "No verses started. Start learning a hearted verse to see mastery.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText("New")).not.toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("charts only started verses and omits New from the legend", () => {
    render(<MasteryDonut data={mixed} />);

    expect(screen.getByText("14 started")).toBeInTheDocument();
    expect(screen.queryByText("New")).not.toBeInTheDocument();

    expect(screen.getByText("Learning")).toBeInTheDocument();
    expect(screen.getByText("Reviewing")).toBeInTheDocument();
    expect(screen.getByText("Mastered")).toBeInTheDocument();
    expect(screen.getByText("5")).toBeInTheDocument();
    expect(screen.getByText("6")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();

    expect(screen.getByRole("img")).toHaveAttribute(
      "aria-label",
      "Mastery distribution: 5 learning, 6 reviewing, 3 mastered.",
    );
  });

  it("shows the mastered share of started verses in the middle", () => {
    render(<MasteryDonut data={mixed} />);

    // 3 of 14 started, not 3 of 35 hearted.
    expect(screen.getByText("21%")).toBeInTheDocument();
    expect(screen.getByText("mastered")).toBeInTheDocument();
  });

  it("draws one arc per non-empty status, laid end to end", () => {
    const { container } = render(<MasteryDonut data={mixed} />);

    const arcs = container.querySelectorAll("circle[stroke-dasharray]");
    expect(arcs).toHaveLength(3);

    // Learning starts at 12 o'clock; each arc begins where the last ended.
    expect(arcs[0]).toHaveAttribute("stroke-dashoffset", "0");
    expect(arcs[1]).toHaveAttribute(
      "stroke-dashoffset",
      `${-((5 / 14) * 100)}`,
    );
    expect(arcs[2]).toHaveAttribute(
      "stroke-dashoffset",
      `${-((11 / 14) * 100)}`,
    );
  });

  it("draws a single unbroken arc when every started verse shares a status", () => {
    const { container } = render(
      <MasteryDonut
        data={{ new: 0, learning: 4, reviewing: 0, mastered: 0, total: 4 }}
      />,
    );

    const arcs = container.querySelectorAll("circle[stroke-dasharray]");
    expect(arcs).toHaveLength(1);
    expect(arcs[0]).toHaveAttribute("stroke-dasharray", "100 0");
  });
});

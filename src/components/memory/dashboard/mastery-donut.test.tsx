import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  largestStartedStatus,
  MasteryDonut,
  type MasteryDistribution,
} from "./mastery-donut";

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

describe("largestStartedStatus", () => {
  it("picks the status with the most started verses", () => {
    expect(largestStartedStatus(mixed)).toBe("reviewing");
  });

  it("keeps the earlier lifecycle step when counts tie", () => {
    expect(
      largestStartedStatus({
        new: 0,
        learning: 4,
        reviewing: 4,
        mastered: 0,
        total: 8,
      }),
    ).toBe("learning");
  });
});

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

  it("shows the largest share in the middle when nothing is hovered", () => {
    render(<MasteryDonut data={mixed} />);

    // 6 of 14 started are reviewing, the biggest bucket.
    expect(screen.getByText("43%")).toBeInTheDocument();
    expect(screen.getByText("reviewing")).toBeInTheDocument();
  });

  it("shows the hovered arc's share in the middle", () => {
    const { container } = render(<MasteryDonut data={mixed} />);
    const learningArc = container.querySelector(
      'circle[data-status="learning"]',
    );
    expect(learningArc).not.toBeNull();

    fireEvent.pointerEnter(learningArc!);
    expect(screen.getByText("36%")).toBeInTheDocument();
    expect(screen.getByText("learning")).toBeInTheDocument();
    expect(screen.queryByText("43%")).not.toBeInTheDocument();

    fireEvent.pointerLeave(learningArc!);
    expect(screen.getByText("43%")).toBeInTheDocument();
    expect(screen.getByText("reviewing")).toBeInTheDocument();
  });

  it("shows the hovered legend row's share in the middle", () => {
    render(<MasteryDonut data={mixed} />);

    const masteredLegend = screen.getByText("Mastered").closest("li");
    expect(masteredLegend).not.toBeNull();
    fireEvent.pointerEnter(masteredLegend!);
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
    expect(screen.getByText("100%")).toBeInTheDocument();
    expect(screen.getByText("learning")).toBeInTheDocument();
  });
});

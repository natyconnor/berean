import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MasteryBar, type MasteryDistribution } from "./mastery-bar";

const unstarted: MasteryDistribution = {
  new: 31,
  learning: 0,
  reviewing: 0,
  mastered: 0,
  total: 31,
};

const mixed: MasteryDistribution = {
  new: 31,
  learning: 1,
  reviewing: 3,
  mastered: 0,
  total: 35,
};

describe("MasteryBar", () => {
  it("ignores unstarted verses in the empty state", () => {
    render(<MasteryBar data={unstarted} />);

    expect(screen.getByText("0 verses")).toBeInTheDocument();
    expect(
      screen.getByText(
        "No verses started. Start learning a hearted verse to see mastery.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText("New")).not.toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("charts only started verses and omits New from the legend", () => {
    render(<MasteryBar data={mixed} />);

    expect(screen.getByText("4 verses")).toBeInTheDocument();
    expect(screen.queryByText("35 verses")).not.toBeInTheDocument();
    expect(screen.queryByText("New")).not.toBeInTheDocument();

    expect(screen.getByText("Learning")).toBeInTheDocument();
    expect(screen.getByText("Reviewing")).toBeInTheDocument();
    expect(screen.getByText("Mastered")).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("0")).toBeInTheDocument();

    expect(screen.getByRole("img")).toHaveAttribute(
      "aria-label",
      "Mastery distribution: 1 learning, 3 reviewing.",
    );
  });
});

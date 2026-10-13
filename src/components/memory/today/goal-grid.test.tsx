import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { TodayGoal } from "@/hooks/use-today-model";

import { GoalGrid } from "./goal-grid";

vi.mock("./goal-card", () => ({
  GoalCard: ({ goal }: { goal: TodayGoal }) => (
    <a href={`#${goal.title}`}>{goal.title}</a>
  ),
}));

const NOW = Date.UTC(2026, 9, 12, 18);

function goals(count: number): TodayGoal[] {
  return Array.from(
    { length: count },
    (_, index) =>
      ({
        kind: "pack",
        packId: `pack-${index + 1}`,
        title: `Goal ${index + 1}`,
      }) as unknown as TodayGoal,
  );
}

function renderGrid(count: number) {
  return render(<GoalGrid goals={goals(count)} now={NOW} timeZone="UTC" />);
}

function cardTitles(): string[] {
  return within(screen.getByRole("list"))
    .getAllByRole("link")
    .map((link) => link.textContent ?? "");
}

describe("GoalGrid", () => {
  it("shows every goal and the count, with no toggle, up to six", () => {
    renderGrid(6);

    expect(
      screen.getByRole("heading", { name: "What you're memorizing · 6" }),
    ).toBeInTheDocument();
    expect(cardTitles()).toHaveLength(6);
    expect(
      screen.queryByRole("button", { name: /^Show/ }),
    ).not.toBeInTheDocument();
  });

  it("shows six of nine, then all of them in place, then six again", async () => {
    renderGrid(9);

    expect(
      screen.getByRole("heading", { name: "What you're memorizing · 9" }),
    ).toBeInTheDocument();
    expect(cardTitles()).toEqual([
      "Goal 1",
      "Goal 2",
      "Goal 3",
      "Goal 4",
      "Goal 5",
      "Goal 6",
    ]);

    const showAll = screen.getByRole("button", { name: "Show all 9" });
    expect(showAll).toHaveAttribute("aria-expanded", "false");
    expect(showAll).toHaveAttribute(
      "aria-controls",
      screen.getByRole("list").id,
    );

    await userEvent.click(showAll);
    expect(cardTitles()).toHaveLength(9);
    expect(screen.getByRole("link", { name: "Goal 7" })).toHaveFocus();

    const showFewer = screen.getByRole("button", { name: "Show fewer" });
    expect(showFewer).toHaveAttribute("aria-expanded", "true");

    await userEvent.click(showFewer);
    expect(cardTitles()).toHaveLength(6);
    expect(screen.getByRole("button", { name: "Show all 9" })).toHaveFocus();
  });

  it("renders nothing with no goals", () => {
    const { container } = renderGrid(0);
    expect(container).toBeEmptyDOMElement();
  });
});

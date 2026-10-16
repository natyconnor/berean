import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { TodayGoal } from "@/hooks/use-today-model";
import type { GoalLayout } from "@/lib/today-goal-layout";

import { GoalGrid } from "./goal-grid";

vi.mock("./goal-card", () => ({
  GoalCard: ({ goal }: { goal: TodayGoal }) => (
    <a href={`#${goal.title}`}>{goal.title}</a>
  ),
}));

vi.mock("./goal-row", () => ({
  GoalRow: ({ goal }: { goal: TodayGoal }) => (
    <a href={`#row-${goal.title}`}>{goal.title}</a>
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

function renderGrid(count: number, layout: GoalLayout) {
  return render(
    <GoalGrid goals={goals(count)} now={NOW} timeZone="UTC" layout={layout} />,
  );
}

function titles(list: HTMLElement): string[] {
  return within(list)
    .getAllByRole("link")
    .map((link) => link.textContent ?? "");
}

function rowsList(): HTMLElement | null {
  return screen.queryByRole("list", { name: "More you're memorizing" });
}

describe("GoalGrid", () => {
  it("shows every goal as a card beside the rail, with no toggle", () => {
    renderGrid(9, { kind: "rail" });

    expect(
      screen.getByRole("heading", { name: "What you're memorizing · 9" }),
    ).toBeInTheDocument();
    expect(titles(screen.getByRole("list"))).toHaveLength(9);
    expect(rowsList()).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /^Show/ }),
    ).not.toBeInTheDocument();
  });

  it("shows two rows of cards in the grid, then the rest as rows", () => {
    renderGrid(9, { kind: "grid", columns: 3 });

    const [cards] = screen.getAllByRole("list");
    expect(titles(cards)).toEqual([
      "Goal 1",
      "Goal 2",
      "Goal 3",
      "Goal 4",
      "Goal 5",
      "Goal 6",
    ]);
    const rows = rowsList();
    expect(rows).not.toBeNull();
    expect(titles(rows as HTMLElement)).toEqual(["Goal 7", "Goal 8", "Goal 9"]);
    expect(
      screen.queryByRole("button", { name: /^Show/ }),
    ).not.toBeInTheDocument();
  });

  it("fits four cards in two columns and needs no rows for four goals", () => {
    const { unmount } = renderGrid(5, { kind: "grid", columns: 2 });
    expect(titles(screen.getAllByRole("list")[0])).toHaveLength(4);
    expect(titles(rowsList() as HTMLElement)).toEqual(["Goal 5"]);
    unmount();

    renderGrid(4, { kind: "grid", columns: 2 });
    expect(rowsList()).not.toBeInTheDocument();
  });

  it("puts every goal in one sideways row on a narrow page", () => {
    renderGrid(9, { kind: "shelf" });

    const list = screen.getByRole("list");
    expect(titles(list)).toHaveLength(9);
    expect(list).toHaveClass("overflow-x-auto", "snap-x");
    expect(rowsList()).not.toBeInTheDocument();
  });

  it("renders nothing with no goals", () => {
    const { container } = renderGrid(0, { kind: "rail" });
    expect(container).toBeEmptyDOMElement();
  });
});

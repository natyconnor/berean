import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import {
  planTodaySession,
  todayQueueGroups,
  todaySessionCounts,
} from "@/lib/memory-today-session";

import { TodayQueueOverview, TodayQueueRail } from "./today-queue-rail";

const SEGMENTS = planTodaySession({
  passages: [{ packId: "psalm1", packName: "Psalm 1", dueAt: 0 }],
  learningVerses: 2,
  reviews: 14,
});
const LEARNING = [
  { id: "jn1", label: "John 1:1" },
  { id: "jn2", label: "John 1:2" },
];
const REVIEWS = Array.from({ length: 14 }, (_, index) => ({
  id: `r${index}`,
  label: `Luke 9:${index + 1}`,
}));

function groupsAt(completed: number, current: number | null) {
  return todayQueueGroups({
    segments: SEGMENTS,
    learning: LEARNING,
    reviews: REVIEWS,
    completed,
    current,
  });
}

function row(name: string): HTMLElement {
  const item = screen.getByText(name).closest("li");
  expect(item).not.toBeNull();
  return item as HTMLElement;
}

describe("TodayQueueRail", () => {
  it("lists every part of today with done, current, and upcoming marks", () => {
    render(
      <TodayQueueRail
        groups={groupsAt(1, 1)}
        counts={todaySessionCounts(SEGMENTS, 1)}
      />,
    );

    const rail = screen.getByRole("region", { name: "Today's queue" });
    expect(within(rail).getByText("1 of 17 done")).toBeInTheDocument();
    expect(within(rail).getByText("Passages")).toBeInTheDocument();
    expect(within(rail).getByText("Verses to learn")).toBeInTheDocument();
    expect(within(rail).getByText("Reviews")).toBeInTheDocument();

    expect(row("Psalm 1")).toHaveAttribute("data-state", "done");
    expect(row("Psalm 1")).toHaveTextContent(", done");
    expect(row("John 1:1")).toHaveAttribute("data-state", "current");
    expect(row("John 1:1")).toHaveAttribute("aria-current", "step");
    expect(row("Luke 9:1")).toHaveAttribute("data-state", "upcoming");
    expect(row("Luke 9:1")).not.toHaveAttribute("aria-current");
  });

  it("folds long review lists into +N more", () => {
    render(
      <TodayQueueRail
        groups={groupsAt(0, 0)}
        counts={todaySessionCounts(SEGMENTS, 0)}
      />,
    );

    expect(screen.getByText("Luke 9:12")).toBeInTheDocument();
    expect(screen.queryByText("Luke 9:13")).not.toBeInTheDocument();
    expect(screen.getByText("+2 more")).toBeInTheDocument();
  });

  it("opens and closes the list on small screens", async () => {
    render(
      <TodayQueueRail
        groups={groupsAt(0, 0)}
        counts={todaySessionCounts(SEGMENTS, 0)}
      />,
    );

    const toggle = screen.getByRole("button", { name: /Show the queue/ });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    const list = document.getElementById(
      toggle.getAttribute("aria-controls") ?? "",
    );
    expect(list).toHaveClass("max-md:hidden");

    await userEvent.click(toggle);
    expect(
      screen.getByRole("button", { name: /Hide the queue/ }),
    ).toHaveAttribute("aria-expanded", "true");
    expect(list).not.toHaveClass("max-md:hidden");
  });
});

describe("TodayQueueOverview", () => {
  it("names each part of today and which one is underway", () => {
    render(<TodayQueueOverview groups={groupsAt(1, 1)} />);

    const overview = screen.getByRole("region", { name: "Today" });
    const parts = within(overview).getAllByRole("listitem");
    expect(parts.map((part) => part.dataset.state)).toEqual([
      "done",
      "current",
      "upcoming",
    ]);
    expect(parts[0]).toHaveTextContent("Passages, done");
    expect(parts[1]).toHaveTextContent("Verses to learn(now)");
    expect(parts[1]).toHaveAttribute("aria-current", "step");
    expect(parts[2]).toHaveTextContent("Reviews14");
  });
});

import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { TooltipProvider } from "@/components/ui/tooltip";
import {
  planTodaySession,
  todayDoneItems,
  todayQueueGroups,
  todaySessionCounts,
  type TodayQueueItem,
} from "@/lib/memory-today-session";

import { TodayQueueRail } from "./today-queue-rail";

const SEGMENTS = planTodaySession({
  passages: [
    { packId: "psalm1", packName: "Psalm 1", dueAt: 0 },
    { packId: "psalm3", packName: "Psalm 3", dueAt: 1 },
  ],
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

function progress(done: number[], spent: string[] = []) {
  return {
    segments: SEGMENTS,
    learning: LEARNING,
    reviews: REVIEWS,
    done: new Set(done),
    spent: new Set(spent),
  };
}

function groupsAt(
  done: number[],
  current: number | null,
  {
    spent = [],
    reopenable = [],
  }: { spent?: string[]; reopenable?: string[] } = {},
) {
  return todayQueueGroups({
    ...progress(done, spent),
    reopenable: new Set(reopenable),
    current,
  });
}

function countsAt(done: number[], spent: string[] = []) {
  return todaySessionCounts(SEGMENTS, todayDoneItems(progress(done, spent)));
}

function row(name: string): HTMLElement {
  const item = screen.getByText(name).closest("li");
  expect(item).not.toBeNull();
  return item as HTMLElement;
}

describe("TodayQueueRail", () => {
  it("lists every part of today with done, current, and upcoming marks", () => {
    render(
      <TodayQueueRail groups={groupsAt([0, 1], 2)} counts={countsAt([0, 1])} />,
    );

    const rail = screen.getByRole("region", { name: "Today's queue" });
    expect(within(rail).getByText("2 of 18 done")).toBeInTheDocument();
    expect(within(rail).getByText("Passages")).toBeInTheDocument();
    expect(within(rail).getByText("Verses to learn")).toBeInTheDocument();
    expect(within(rail).getByText("Reviews")).toBeInTheDocument();

    expect(row("Psalm 1")).toHaveAttribute("data-state", "done");
    expect(row("Psalm 1")).toHaveTextContent(", done");
    expect(row("John 1:1")).toHaveAttribute("data-state", "current");
    expect(row("John 1:1")).toHaveAttribute("aria-current", "step");
    expect(row("Luke 9:1")).toHaveAttribute("data-state", "upcoming");
    expect(row("Luke 9:1")).not.toHaveAttribute("aria-current");
    // Informational only without a handler.
    expect(within(rail).queryByRole("button", { name: /^Go/ })).toBeNull();
  });

  it("folds long review lists into +N more", () => {
    render(<TodayQueueRail groups={groupsAt([], 0)} counts={countsAt([])} />);

    expect(screen.getByText("Luke 9:12")).toBeInTheDocument();
    expect(screen.queryByText("Luke 9:13")).not.toBeInTheDocument();
    expect(screen.getByText("+2 more")).toBeInTheDocument();
  });

  it("opens and closes the list on small screens", async () => {
    render(<TodayQueueRail groups={groupsAt([], 0)} counts={countsAt([])} />);

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

  it("jumps to anything still to come, but not to what's underway", async () => {
    const onSelect = vi.fn<(item: TodayQueueItem) => void>();
    render(
      <TodayQueueRail
        groups={groupsAt([], 0)}
        counts={countsAt([])}
        onSelect={onSelect}
      />,
    );

    expect(
      screen.queryByRole("button", { name: /Psalm 1\b/ }),
    ).not.toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", { name: "Go to Psalm 3" }),
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Go to John 1:2" }),
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Go to Luke 9:4" }),
    );

    expect(
      onSelect.mock.calls.map(([item]) => [item.id, item.segment]),
    ).toEqual([
      ["psalm3", 1],
      ["jn2", 2],
      ["r3", 3],
    ]);
  });

  it("keeps the mobile list's open state when the parent holds it, and collapses after a tap", async () => {
    const onOpenChange = vi.fn();
    const onSelect = vi.fn();
    const { rerender } = render(
      <TodayQueueRail
        groups={groupsAt([], 0)}
        counts={countsAt([])}
        open={true}
        onOpenChange={onOpenChange}
        onSelect={onSelect}
      />,
    );

    expect(
      screen.getByRole("button", { name: /Hide the queue/ }),
    ).toHaveAttribute("aria-expanded", "true");
    rerender(
      <TodayQueueRail
        groups={groupsAt([], 1)}
        counts={countsAt([])}
        open={true}
        onOpenChange={onOpenChange}
        onSelect={onSelect}
      />,
    );
    expect(
      screen.getByRole("button", { name: /Hide the queue/ }),
    ).toHaveAttribute("aria-expanded", "true");

    await userEvent.click(
      screen.getByRole("button", { name: "Go to John 1:1" }),
    );
    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({ id: "jn1" }),
    );
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("toggles shuffle next to the done count without adding a Progress or Order block", async () => {
    const onToggleOrder = vi.fn();
    render(
      <TooltipProvider delayDuration={0}>
        <TodayQueueRail
          groups={groupsAt([], 0)}
          counts={countsAt([])}
          order="in-order"
          onToggleOrder={onToggleOrder}
        />
      </TooltipProvider>,
    );

    const toggle = screen.getByRole("button", { name: "Shuffle verses" });
    expect(toggle).toHaveAttribute("aria-pressed", "false");
    expect(screen.queryByText("Order")).not.toBeInTheDocument();
    expect(screen.queryByText("Progress")).not.toBeInTheDocument();
    await userEvent.hover(toggle);
    expect(await screen.findByRole("tooltip")).toHaveTextContent(
      "Shuffle verses",
    );
    await userEvent.click(toggle);
    expect(onToggleOrder).toHaveBeenCalledTimes(1);
  });

  it("names the pressed toggle for putting verses back in order", async () => {
    render(
      <TooltipProvider delayDuration={0}>
        <TodayQueueRail
          groups={groupsAt([], 0)}
          counts={countsAt([])}
          order="shuffle"
          onToggleOrder={() => {}}
        />
      </TooltipProvider>,
    );

    const toggle = screen.getByRole("button", { name: "Shuffle verses" });
    expect(toggle).toHaveAttribute("aria-pressed", "true");
    await userEvent.hover(toggle);
    expect(await screen.findByRole("tooltip")).toHaveTextContent(
      "Put verses in order",
    );
  });

  it("keeps finished items in place, reopening a passage with work left", async () => {
    const onSelect = vi.fn();
    render(
      <TooltipProvider delayDuration={0}>
        <TodayQueueRail
          groups={groupsAt([0, 1], null, {
            spent: ["jn1"],
            reopenable: ["psalm3"],
          })}
          counts={countsAt([0, 1], ["jn1"])}
          onSelect={onSelect}
        />
      </TooltipProvider>,
    );

    const finished = screen.getByRole("button", {
      name: "Psalm 1, done for today",
    });
    expect(finished).toHaveAttribute("aria-disabled", "true");
    await userEvent.click(finished);
    const spent = screen.getByRole("button", {
      name: "John 1:1, done for today",
    });
    await userEvent.hover(spent);
    expect(await screen.findByRole("tooltip")).toHaveTextContent(
      "Done for today",
    );
    await userEvent.click(spent);
    expect(onSelect).not.toHaveBeenCalled();

    await userEvent.click(
      screen.getByRole("button", { name: "Go back to Psalm 3" }),
    );
    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({ id: "psalm3", segment: 1 }),
    );
  });
});

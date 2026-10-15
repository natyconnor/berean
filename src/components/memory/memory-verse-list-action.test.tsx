import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";

import { TooltipProvider } from "@/components/ui/tooltip";
import { DAY_MS, MIN_LEARNING_LOCK_MS } from "@/lib/memory-scheduler";

import { MemoryVerseListAction } from "./memory-verse-list-action";
import type { PracticeVerse } from "./practice/practice-board";

const NOW = 1_700_000_000_000;

function verse(
  status: PracticeVerse["status"],
  dueAt: number,
  learnStage = 3,
): PracticeVerse {
  return {
    reference: {
      book: "Romans",
      chapter: 5,
      startVerse: 6,
      endVerse: 8,
    },
    learnStage,
    stageReps: 0,
    status,
    dueAt,
  };
}

function renderAction(
  props: Pick<ComponentProps<typeof MemoryVerseListAction>, "status" | "verse">,
) {
  const handlers = {
    onLearn: vi.fn(),
    onReview: vi.fn(),
    onPractice: vi.fn(),
  };
  const view = render(
    <TooltipProvider delayDuration={0}>
      <MemoryVerseListAction {...props} now={NOW} {...handlers} />
    </TooltipProvider>,
  );
  return { ...view, ...handlers };
}

describe("MemoryVerseListAction", () => {
  it("shows no button while today's step is done", () => {
    const { container } = renderAction({
      status: "learning",
      verse: {
        ...verse("learning", NOW + MIN_LEARNING_LOCK_MS, 2),
        lastReviewedAt: NOW,
      },
    });

    expect(container).toBeEmptyDOMElement();
  });

  it("continues an open learning step and learns an Up next verse", async () => {
    const learning = renderAction({
      status: "learning",
      verse: verse("learning", NOW, 2),
    });
    await userEvent.click(
      screen.getByRole("button", { name: "Continue learning Romans 5:6–8" }),
    );
    expect(learning.onLearn).toHaveBeenCalledTimes(1);
    learning.unmount();

    const upNext = renderAction({ status: "new", verse: verse("new", NOW, 0) });
    await userEvent.click(
      screen.getByRole("button", { name: "Learn Romans 5:6–8" }),
    );
    expect(upNext.onLearn).toHaveBeenCalledTimes(1);
  });

  it("reviews a due graduated verse", async () => {
    const { onReview, onPractice } = renderAction({
      status: "reviewing",
      verse: verse("reviewing", NOW),
    });

    await userEvent.click(
      screen.getByRole("button", { name: "Review Romans 5:6–8" }),
    );
    expect(onReview).toHaveBeenCalledTimes(1);
    expect(onPractice).not.toHaveBeenCalled();
  });

  it("practices a graduated verse that is not due yet, with the honest tooltip", async () => {
    const { onReview, onPractice } = renderAction({
      status: "reviewing",
      verse: verse("reviewing", NOW + 4 * DAY_MS),
    });

    expect(
      screen.queryByRole("button", { name: /^Review/ }),
    ).not.toBeInTheDocument();
    const practice = screen.getByRole("button", {
      name: "Practice Romans 5:6–8",
    });
    await userEvent.hover(practice);
    expect(await screen.findByRole("tooltip")).toHaveTextContent(
      "Go over anything you've memorized, any time.",
    );
    await userEvent.click(practice);
    expect(onPractice).toHaveBeenCalledTimes(1);
    expect(onReview).not.toHaveBeenCalled();
  });
});

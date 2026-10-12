import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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

describe("MemoryVerseListAction", () => {
  it("shows a waiting verse as Up next tomorrow with tomorrow's step", async () => {
    const onLearn = vi.fn();
    render(
      <TooltipProvider delayDuration={0}>
        <MemoryVerseListAction
          status="learning"
          verse={{
            ...verse("learning", NOW + MIN_LEARNING_LOCK_MS, 2),
            lastReviewedAt: NOW,
          }}
          now={NOW}
          onLearn={onLearn}
          onReview={vi.fn()}
          onPractice={vi.fn()}
        />
      </TooltipProvider>,
    );

    const button = screen.getByRole("button", {
      name: "Up next tomorrow. Nice. Tomorrow you'll try it with blanks.",
    });
    expect(button).toBeDisabled();
    expect(button).toHaveTextContent("Up next tomorrow");
    // Narrow rows swap in the short label; CSS decides which one shows.
    expect(button).toHaveTextContent("Tomorrow");

    await userEvent.hover(button.parentElement!);
    expect(await screen.findByRole("tooltip")).toHaveTextContent(
      "Nice. Tomorrow you'll try it with blanks.",
    );
    expect(onLearn).not.toHaveBeenCalled();
  });

  it("reviews a due graduated verse", async () => {
    const onReview = vi.fn();
    const onPractice = vi.fn();
    render(
      <MemoryVerseListAction
        status="reviewing"
        verse={verse("reviewing", NOW)}
        now={NOW}
        onLearn={vi.fn()}
        onReview={onReview}
        onPractice={onPractice}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Review" }));
    expect(onReview).toHaveBeenCalledTimes(1);
    expect(onPractice).not.toHaveBeenCalled();
  });

  it("practices a graduated verse that is not due yet", async () => {
    const onReview = vi.fn();
    const onPractice = vi.fn();
    render(
      <MemoryVerseListAction
        status="reviewing"
        verse={verse("reviewing", NOW + 4 * DAY_MS)}
        now={NOW}
        onLearn={vi.fn()}
        onReview={onReview}
        onPractice={onPractice}
      />,
    );

    expect(
      screen.queryByRole("button", { name: "Review" }),
    ).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Practice" }));
    expect(onPractice).toHaveBeenCalledTimes(1);
    expect(onReview).not.toHaveBeenCalled();
  });
});

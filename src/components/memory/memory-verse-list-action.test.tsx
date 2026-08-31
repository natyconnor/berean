import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { DAY_MS } from "@/lib/memory-scheduler";

import { MemoryVerseListAction } from "./memory-verse-list-action";
import type { PracticeVerse } from "./practice/practice-board";

const NOW = 1_700_000_000_000;

function verse(status: PracticeVerse["status"], dueAt: number): PracticeVerse {
  return {
    reference: {
      book: "Romans",
      chapter: 5,
      startVerse: 6,
      endVerse: 8,
    },
    learnStage: 3,
    stageReps: 0,
    status,
    dueAt,
  };
}

describe("MemoryVerseListAction", () => {
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

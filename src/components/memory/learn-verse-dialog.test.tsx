import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TooltipProvider } from "@/components/ui/tooltip";

import type { Id } from "../../../convex/_generated/dataModel";
import { LearnVerseDialog } from "./learn-verse-dialog";
import type { HeartedVerse, PackableVerse } from "./packs/pack-verse-types";

const NOW = 1_700_000_000_000;

const mocks = vi.hoisted(() => ({
  savedVerses: [] as unknown[],
  memorize: vi.fn(),
}));

vi.mock("convex/react", () => ({
  useMutation: () => mocks.memorize,
}));

vi.mock("convex-helpers/react/cache", () => ({
  useQuery: (_query: unknown, args: unknown) =>
    args === "skip" ? undefined : mocks.savedVerses,
}));

vi.mock("../../../convex/_generated/api", () => ({
  api: {
    savedVerses: { listAll: "savedVerses.listAll" },
    verseMemory: { memorize: "verseMemory.memorize" },
  },
}));

vi.mock("./packs/pack-verse-picker", () => ({
  PackVersePicker: ({
    heartedVerses,
    onSelect,
  }: {
    heartedVerses: HeartedVerse[];
    onSelect: (verse: PackableVerse) => void;
  }) => (
    <div>
      <ul>
        {heartedVerses.map((verse) => (
          <li key={verse.verseRefId}>
            {verse.book} {verse.memory ? verse.memory.status : "no schedule"}
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={() =>
          onSelect({ book: "Romans", chapter: 8, startVerse: 28, endVerse: 28 })
        }
      >
        Pick Romans 8:28
      </button>
      <button
        type="button"
        onClick={() =>
          onSelect({
            book: "Psalms",
            chapter: 46,
            startVerse: 10,
            endVerse: 10,
          })
        }
      >
        Pick Psalm 46:10
      </button>
    </div>
  ),
}));

function heartedRow(
  book: string,
  chapter: number,
  verse: number,
  memory?: {
    status: "new" | "learning" | "reviewing" | "mastered";
    inMemory: boolean;
    dueAt: number;
  },
) {
  return {
    _id: `sv_${book}` as Id<"savedVerses">,
    verseRefId: `vr_${book}` as Id<"verseRefs">,
    book,
    chapter,
    startVerse: verse,
    endVerse: verse,
    createdAt: 1,
    memory: memory
      ? {
          status: memory.status,
          learnStage: memory.status === "reviewing" ? 3 : 0,
          stageReps: 0,
          intervalDays: memory.status === "reviewing" ? 4 : 0,
          dueAt: memory.dueAt,
          inMemory: memory.inMemory,
        }
      : undefined,
  };
}

function renderDialog() {
  const handlers = {
    onOpenChange: vi.fn(),
    onLearnVerse: vi.fn(),
    onReviewVerse: vi.fn(),
    onPracticeVerse: vi.fn(),
  };
  render(
    <TooltipProvider delayDuration={0}>
      <LearnVerseDialog open now={NOW} {...handlers} />
    </TooltipProvider>,
  );
  return handlers;
}

describe("LearnVerseDialog", () => {
  beforeEach(() => {
    mocks.savedVerses = [];
    mocks.memorize.mockReset();
    mocks.memorize.mockResolvedValue({
      added: 1,
      alreadyMemorizing: 0,
      verseRefIds: ["vr_new" as Id<"verseRefs">],
    });
  });

  it("explains that a verse does not need a heart first", () => {
    renderDialog();
    expect(
      screen.getByText(
        "Pick a verse to memorize. You don't need to heart it first.",
      ),
    ).toBeInTheDocument();
  });

  it("memorizes an unhearted verse, then opens Learn for it", async () => {
    const handlers = renderDialog();

    await userEvent.click(
      screen.getByRole("button", { name: "Pick Romans 8:28" }),
    );

    await waitFor(() => expect(handlers.onLearnVerse).toHaveBeenCalled());
    expect(mocks.memorize).toHaveBeenCalledWith({
      spans: [{ book: "Romans", chapter: 8, startVerse: 28, endVerse: 28 }],
      now: NOW,
    });
    expect(handlers.onLearnVerse).toHaveBeenCalledWith(
      expect.objectContaining({
        verseRefId: "vr_new",
        reference: { book: "Romans", chapter: 8, startVerse: 28, endVerse: 28 },
      }),
    );
    expect(handlers.onOpenChange).toHaveBeenCalledWith(false);
  });

  it("resumes a stopped review-phase verse and routes it to Review", async () => {
    mocks.savedVerses = [
      heartedRow("Psalms", 46, 10, {
        status: "reviewing",
        inMemory: false,
        dueAt: NOW - 1,
      }),
    ];
    mocks.memorize.mockResolvedValue({
      added: 1,
      alreadyMemorizing: 0,
      verseRefIds: ["vr_Psalms" as Id<"verseRefs">],
    });
    const handlers = renderDialog();

    await userEvent.click(
      screen.getByRole("button", { name: "Pick Psalm 46:10" }),
    );

    await waitFor(() => expect(handlers.onReviewVerse).toHaveBeenCalled());
    expect(mocks.memorize).toHaveBeenCalledTimes(1);
    expect(handlers.onLearnVerse).not.toHaveBeenCalled();
  });

  it("shows a schedule only for hearted verses that are in Memory", () => {
    mocks.savedVerses = [
      heartedRow("Psalms", 46, 10, {
        status: "learning",
        inMemory: true,
        dueAt: NOW,
      }),
      heartedRow("Romans", 8, 28, {
        status: "new",
        inMemory: false,
        dueAt: NOW,
      }),
    ];
    renderDialog();

    expect(screen.getByText("Psalms learning")).toBeInTheDocument();
    expect(screen.getByText("Romans no schedule")).toBeInTheDocument();
  });

  it("keeps the dialog open with an error when memorizing fails", async () => {
    mocks.memorize.mockRejectedValue(new Error("offline"));
    const handlers = renderDialog();

    await userEvent.click(
      screen.getByRole("button", { name: "Pick Romans 8:28" }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Couldn't start that verse. Please try again.",
    );
    expect(handlers.onOpenChange).not.toHaveBeenCalled();
    expect(handlers.onLearnVerse).not.toHaveBeenCalled();
  });
});

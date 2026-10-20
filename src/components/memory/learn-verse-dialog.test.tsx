import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TooltipProvider } from "@/components/ui/tooltip";

import type { Id } from "../../../convex/_generated/dataModel";
import { LearnVerseDialog } from "./learn-verse-dialog";
import type { HeartedVerse, PackableVerse } from "./packs/pack-verse-types";

const mocks = vi.hoisted(() => ({
  savedVerses: [] as unknown[],
  pickerProps: null as { confirmLabel?: string } | null,
}));

vi.mock("convex-helpers/react/cache", () => ({
  useQuery: (_query: unknown, args: unknown) =>
    args === "skip" ? undefined : mocks.savedVerses,
}));

vi.mock("../../../convex/_generated/api", () => ({
  api: { savedVerses: { listAll: "savedVerses.listAll" } },
}));

vi.mock("./packs/pack-verse-picker", () => ({
  PackVersePicker: ({
    heartedVerses,
    confirmLabel,
    onSelect,
  }: {
    heartedVerses: HeartedVerse[];
    confirmLabel?: string;
    onSelect: (verse: PackableVerse) => void;
  }) => {
    mocks.pickerProps = { confirmLabel };
    return (
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
            onSelect({
              verseRefId: "vr_Romans" as Id<"verseRefs">,
              book: "Romans",
              chapter: 8,
              startVerse: 28,
              endVerse: 28,
            })
          }
        >
          Pick Romans 8:28
        </button>
      </div>
    );
  },
}));

function heartedRow(
  book: string,
  chapter: number,
  verse: number,
  memory?: {
    status: "new" | "learning" | "reviewing" | "mastered";
    inMemory: boolean;
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
          learnStage: 0,
          stageReps: 0,
          intervalDays: 0,
          dueAt: 1,
          inMemory: memory.inMemory,
        }
      : undefined,
  };
}

function renderDialog() {
  const handlers = { onOpenChange: vi.fn(), onPick: vi.fn() };
  render(
    <TooltipProvider delayDuration={0}>
      <LearnVerseDialog open {...handlers} />
    </TooltipProvider>,
  );
  return handlers;
}

describe("LearnVerseDialog", () => {
  beforeEach(() => {
    mocks.savedVerses = [];
    mocks.pickerProps = null;
  });

  it("asks for a verse to memorize, no heart needed", () => {
    renderDialog();
    expect(
      screen.getByRole("heading", { name: "Memorize a verse" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Pick a verse to memorize. You don't need to heart it first.",
      ),
    ).toBeInTheDocument();
    expect(mocks.pickerProps?.confirmLabel).toBe("Memorize");
  });

  it("closes and hands the picked span to the Memorize sheet", async () => {
    const handlers = renderDialog();

    await userEvent.click(
      screen.getByRole("button", { name: "Pick Romans 8:28" }),
    );

    expect(handlers.onOpenChange).toHaveBeenCalledWith(false);
    expect(handlers.onPick).toHaveBeenCalledWith({
      book: "Romans",
      chapter: 8,
      startVerse: 28,
      endVerse: 28,
    });
  });

  it("shows a schedule only for hearted verses that are in Memory", () => {
    mocks.savedVerses = [
      heartedRow("Psalms", 46, 10, { status: "learning", inMemory: true }),
      heartedRow("Romans", 8, 28, { status: "new", inMemory: false }),
    ];
    renderDialog();

    expect(screen.getByText("Psalms learning")).toBeInTheDocument();
    expect(screen.getByText("Romans no schedule")).toBeInTheDocument();
  });
});

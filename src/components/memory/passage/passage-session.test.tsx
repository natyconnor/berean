import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TooltipProvider } from "@/components/ui/tooltip";
import { getSessionNow } from "@/hooks/use-live-now";
import { DAY_MS } from "@/lib/memory-scheduler";
import type { PassagePiece } from "@/lib/passage-pieces";
import type { EsvChapterData } from "../../../../shared/esv-api";
import type { Id } from "../../../../convex/_generated/dataModel";

import {
  CONNECT_COPY,
  CONNECT_RECITE_LABEL,
  CONNECT_TITLE,
  DONE_FOR_NOW_LABEL,
  FRONTIER_LOCKED_COPY,
  NEXT_VERSE_PROMPT_COPY,
  SECTION_COMPLETE_COPY,
  SECTION_RECITE_LABEL,
} from "./passage-session-model";
import { PassageSession } from "./passage-session";
import type { PassageView } from "./passage-session-types";

const { mutationMocks, fetchChaptersBatchMock } = vi.hoisted(() => ({
  mutationMocks: new Map<string, ReturnType<typeof vi.fn>>(),
  fetchChaptersBatchMock: vi.fn(),
}));

function mutationMock(name: string) {
  const existing = mutationMocks.get(name);
  if (existing) return existing;
  const created = vi.fn().mockResolvedValue(undefined);
  mutationMocks.set(name, created);
  return created;
}

vi.mock("convex/react", () => ({
  useMutation: (name: string) => mutationMock(name),
  useAction: (name: string) =>
    name === "esv.getChaptersBatch" ? fetchChaptersBatchMock : vi.fn(),
}));

vi.mock("../../../../convex/_generated/api", () => ({
  api: {
    esv: {
      getChaptersBatch: "esv.getChaptersBatch",
      getPassage: "esv.getPassage",
    },
    passageMemory: {
      introduceNext: "passageMemory.introduceNext",
      recordAttempt: "passageMemory.recordAttempt",
    },
  },
}));

const PACK_ID = "pack_1" as Id<"packs">;
const PASSAGE_ONE = "The Lord is my shepherd; I shall not want.";
const PASSAGE_TWO = "He makes me lie down in green pastures.";

const psalm23: EsvChapterData = {
  canonical: "Psalm 23",
  copyright: "test",
  verses: [
    { number: 1, text: PASSAGE_ONE },
    { number: 2, text: PASSAGE_TWO },
  ],
};

function piece(
  index: number,
  attachment: PassagePiece["attachment"],
  extra?: Partial<PassagePiece>,
): PassagePiece {
  return {
    index,
    book: "Psalms",
    chapter: 23,
    startVerse: index + 1,
    endVerse: index + 1,
    sectionIndex: extra?.sectionIndex ?? 0,
    attachment,
    learnStage: extra?.learnStage ?? 0,
    stageReps: extra?.stageReps ?? 0,
    ...extra,
  };
}

function passageView(
  pieces: PassagePiece[],
  extra?: Partial<PassageView>,
): PassageView {
  const now = getSessionNow();
  const ropePieceIndexes = pieces
    .map((item, index) =>
      item.attachment === "attached" || item.attachment === "solid"
        ? index
        : -1,
    )
    .filter((index) => index >= 0);
  const frontierIndex = pieces.findIndex((item) => item.attachment !== "solid");
  return {
    _id: "passage_1" as Id<"passageMemory">,
    packId: PACK_ID,
    status: "building",
    pieces,
    addsOnDay: 0,
    ease: 2.3,
    intervalDays: 0,
    dueAt: now,
    consecutiveCorrect: 0,
    lapses: 0,
    stageReps: 0,
    createdAt: now,
    updatedAt: now,
    remainingIntroduces: 5,
    frontierIndex: frontierIndex === -1 ? pieces.length : frontierIndex,
    rehearsalStartIndex: ropePieceIndexes[0] ?? 0,
    ropePieceIndexes,
    ...extra,
  };
}

function renderSession(view: PassageView, onExit: () => void = () => {}) {
  return render(
    <TooltipProvider delayDuration={0}>
      <PassageSession
        packId={PACK_ID}
        view={view}
        packName="Psalm 23"
        onExit={onExit}
      />
    </TooltipProvider>,
  );
}

describe("PassageSession", () => {
  beforeEach(() => {
    mutationMocks.clear();
    sessionStorage.clear();
    fetchChaptersBatchMock.mockReset();
    fetchChaptersBatchMock.mockResolvedValue([{ chapter: 23, data: psalm23 }]);
    mutationMock("passageMemory.introduceNext").mockResolvedValue(
      passageView([piece(0, "learning"), piece(1, "unreached")], {
        addsOnDay: 1,
        remainingIntroduces: 4,
        frontierIndex: 0,
      }),
    );
    mutationMock("passageMemory.recordAttempt").mockResolvedValue(
      passageView([piece(0, "attached", { learnStage: 2 })], {
        updatedAt: getSessionNow() + 1,
      }),
    );
  });

  it("jumps into a due verse instead of a mixed recitation", async () => {
    renderSession(
      passageView([
        piece(0, "attached", { learnStage: 2 }),
        piece(1, "learning", { learnStage: 0 }),
      ]),
    );

    expect(
      screen.getByRole("status", { name: "Session phase: Challenge" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("status", { name: "Session phase: Rope" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("status", { name: "Session phase: Frontier" }),
    ).not.toBeInTheDocument();
    expect(
      await screen.findByText("Type what you remember"),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Your recalled verse")).toBeInTheDocument();
    expect(
      screen.queryByLabelText("Your recited passage"),
    ).not.toBeInTheDocument();
  });

  it("auto-starts the first verse instead of an introduce screen", async () => {
    renderSession(passageView([piece(0, "unreached"), piece(1, "unreached")]));

    expect(
      screen.getByLabelText("Starting the first verse"),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/introduced a new piece/i),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /introduce/i }),
    ).not.toBeInTheDocument();

    await waitFor(() => {
      expect(mutationMock("passageMemory.introduceNext")).toHaveBeenCalled();
    });
    const [args] = mutationMock("passageMemory.introduceNext").mock
      .calls[0] as [{ packId: string; now: number; tzOffsetMinutes: number }];
    expect(args.packId).toBe(PACK_ID);
    expect(args.now).toEqual(expect.any(Number));
    expect(args.tzOffsetMinutes).toEqual(expect.any(Number));
    expect(mutationMock("passageMemory.recordAttempt")).not.toHaveBeenCalled();

    expect(
      await screen.findByText("Read it through, then continue"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("status", { name: "Session phase: Read" }),
    ).toBeInTheDocument();
  });

  it("lets the learner retry when auto-start fails", async () => {
    mutationMock("passageMemory.introduceNext").mockRejectedValue(
      new Error("ConvexError"),
    );
    renderSession(passageView([piece(0, "unreached"), piece(1, "unreached")]));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /couldn't start the next verse/i,
    );
    expect(
      screen.queryByText("Read it through, then continue"),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Start Psalm 23:1" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: DONE_FOR_NOW_LABEL }),
    ).toBeInTheDocument();
    expect(mutationMock("passageMemory.recordAttempt")).not.toHaveBeenCalled();
  });

  it("prompts the next verse without a recitation box after today's work", async () => {
    const onExit = vi.fn();
    renderSession(
      passageView([
        piece(0, "attached", {
          learnStage: 2,
          dueAt: getSessionNow() + DAY_MS,
        }),
        piece(1, "unreached"),
      ]),
      onExit,
    );

    expect(screen.getByText("Psalm 23:1")).toBeInTheDocument();
    expect(screen.getByText(NEXT_VERSE_PROMPT_COPY)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Start Psalm 23:2" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: DONE_FOR_NOW_LABEL }),
    ).toBeInTheDocument();
    expect(
      screen.queryByLabelText("Your recited passage"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByLabelText("Your recalled verse"),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/rope/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/frontier/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/mixed-support/i)).not.toBeInTheDocument();

    await userEvent.click(
      screen.getByRole("button", { name: DONE_FOR_NOW_LABEL }),
    );
    expect(onExit).toHaveBeenCalledTimes(1);
    expect(mutationMock("passageMemory.introduceNext")).not.toHaveBeenCalled();
  });

  it("does not render a blank Learn screen when the current verse is locked", () => {
    renderSession(
      passageView([
        piece(0, "attached", {
          learnStage: 2,
          dueAt: getSessionNow() + DAY_MS,
        }),
      ]),
    );

    expect(screen.getByText(FRONTIER_LOCKED_COPY)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: DONE_FOR_NOW_LABEL }),
    ).toBeInTheDocument();
    expect(
      screen.queryByLabelText("Your recalled verse"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByLabelText("Your recited passage"),
    ).not.toBeInTheDocument();
  });

  it("sends the verse word count with a frontier attempt", async () => {
    renderSession(
      passageView([piece(0, "learning", { learnStage: 0, stageReps: 0 })]),
    );

    expect(
      await screen.findByText("Read it through, then continue"),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Continue" }));

    await waitFor(() => {
      expect(mutationMock("passageMemory.recordAttempt")).toHaveBeenCalled();
    });
    const [args] = mutationMock("passageMemory.recordAttempt").mock
      .calls[0] as [{ kind: string; wordCount?: number }];
    expect(args.kind).toBe("frontier");
    expect(args.wordCount).toBeGreaterThan(0);
  });

  it("uses plain language for the remaining session copy", () => {
    expect(DONE_FOR_NOW_LABEL).toBe("That's enough for today");
    expect(FRONTIER_LOCKED_COPY).toMatch(/down for the day/);
    expect(FRONTIER_LOCKED_COPY).not.toMatch(/rope|set for today/i);
    expect(NEXT_VERSE_PROMPT_COPY).toMatch(/down for the day/);
    expect(NEXT_VERSE_PROMPT_COPY).not.toMatch(/rope|frontier|introduce/i);
    expect(CONNECT_TITLE).toBe("Connect these verses");
    expect(CONNECT_COPY).toMatch(/Link the verse you just learned/);
    expect(CONNECT_RECITE_LABEL).toBe("Recite together");
    expect(SECTION_COMPLETE_COPY).toMatch(/finished this section/);
    expect(SECTION_RECITE_LABEL).toBe("Recite this section");
  });
});

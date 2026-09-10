import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TooltipProvider } from "@/components/ui/tooltip";
import { getSessionNow } from "@/hooks/use-live-now";
import { DAY_MS } from "@/lib/memory-scheduler";
import { compositeHintForWindow } from "@/lib/passage-frontier";
import type { PassagePiece } from "@/lib/passage-pieces";
import type { EsvChapterData } from "../../../../shared/esv-api";
import type { Id } from "../../../../convex/_generated/dataModel";

import {
  DONE_FOR_NOW_LABEL,
  FRONTIER_LOCKED_COPY,
  INTRODUCE_ANOTHER_LABEL,
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

  it("starts on rope, not frontier, when attached pieces exist", async () => {
    renderSession(
      passageView([
        piece(0, "attached", { learnStage: 2 }),
        piece(1, "learning", { learnStage: 0 }),
      ]),
    );

    expect(
      screen.getByRole("status", { name: "Session phase: Rope" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("status", { name: "Session phase: Frontier" }),
    ).not.toBeInTheDocument();
    expect(
      await screen.findByLabelText("Your recited passage"),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Read it through, then continue"),
    ).not.toBeInTheDocument();
  });

  it("shows a per-piece composite hint on the rope", async () => {
    const pieces = [
      piece(0, "solid", { learnStage: 3 }),
      piece(1, "attached", { learnStage: 2, stageReps: 0 }),
    ];
    renderSession(passageView(pieces));

    const hint = await screen.findByLabelText("Rope hint");
    const expected = compositeHintForWindow(pieces, 0, 2, [
      PASSAGE_ONE,
      PASSAGE_TWO,
    ]);
    expect(hint).toHaveTextContent(expected);
    expect(hint.textContent).not.toContain("Lord");
    expect(hint.textContent).not.toContain("Blessed");
  });

  it("calls introduceNext from the introduce phase", async () => {
    renderSession(passageView([piece(0, "unreached"), piece(1, "unreached")]));

    expect(
      screen.getByRole("status", { name: "Session phase: Introduce" }),
    ).toBeInTheDocument();

    await userEvent.click(
      screen.getByRole("button", { name: INTRODUCE_ANOTHER_LABEL }),
    );

    await waitFor(() => {
      expect(mutationMock("passageMemory.introduceNext")).toHaveBeenCalled();
    });
    const [args] = mutationMock("passageMemory.introduceNext").mock
      .calls[0] as [{ packId: string; now: number; tzOffsetMinutes: number }];
    expect(args.packId).toBe(PACK_ID);
    expect(args.now).toEqual(expect.any(Number));
    expect(args.tzOffsetMinutes).toEqual(expect.any(Number));
    expect(mutationMock("passageMemory.recordAttempt")).not.toHaveBeenCalled();
  });

  it("does not show a frontier drill when introduceNext fails", async () => {
    mutationMock("passageMemory.introduceNext").mockRejectedValue(
      new Error("ConvexError"),
    );
    renderSession(passageView([piece(0, "unreached"), piece(1, "unreached")]));

    expect(
      screen.getByRole("status", { name: "Session phase: Introduce" }),
    ).toBeInTheDocument();

    await userEvent.click(
      screen.getByRole("button", { name: INTRODUCE_ANOTHER_LABEL }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /couldn't introduce the next piece/i,
    );
    expect(
      screen.getByRole("status", { name: "Session phase: Introduce" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("status", { name: "Session phase: Frontier" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText("Read it through, then continue"),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: INTRODUCE_ANOTHER_LABEL }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: DONE_FOR_NOW_LABEL }),
    ).toBeInTheDocument();
    expect(mutationMock("passageMemory.recordAttempt")).not.toHaveBeenCalled();
  });

  it("keeps the rope phase when recordAttempt fails", async () => {
    mutationMock("passageMemory.recordAttempt").mockRejectedValue(
      new Error("ConvexError"),
    );
    renderSession(
      passageView([
        piece(0, "solid", { learnStage: 3 }),
        piece(1, "attached", { learnStage: 2 }),
      ]),
    );

    const answer = await screen.findByLabelText("Your recited passage");
    await screen.findByLabelText("Rope hint");
    await userEvent.click(answer);
    await userEvent.paste(`${PASSAGE_ONE} WRONG`);

    const check = screen.getByRole("button", { name: /Check answer/ });
    await waitFor(() => {
      expect(check).toBeEnabled();
    });
    await userEvent.click(check);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /couldn't save that attempt/i,
    );
    expect(
      screen.getByRole("status", { name: "Session phase: Rope" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("status", { name: "Session phase: Stall repair" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByLabelText("Previous-piece cue"),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Check answer/ }),
    ).toBeInTheDocument();
  });

  it("maps a rope fail onto stall repair with a previous-piece cue", async () => {
    renderSession(
      passageView([
        piece(0, "solid", { learnStage: 3 }),
        piece(1, "attached", { learnStage: 2 }),
      ]),
    );

    const answer = await screen.findByLabelText("Your recited passage");
    await screen.findByLabelText("Rope hint");
    await userEvent.click(answer);
    await userEvent.paste(`${PASSAGE_ONE} WRONG`);

    const check = screen.getByRole("button", { name: /Check answer/ });
    await waitFor(() => {
      expect(check).toBeEnabled();
    });
    await userEvent.click(check);

    expect(
      await screen.findByRole("status", {
        name: "Session phase: Stall repair",
      }),
    ).toBeInTheDocument();
    const cue = await screen.findByLabelText("Previous-piece cue");
    expect(cue).toHaveTextContent(/shall not want/i);
    expect(cue.textContent).toMatch(/H/);

    await waitFor(() => {
      expect(mutationMock("passageMemory.recordAttempt")).toHaveBeenCalled();
    });
    const [args] = mutationMock("passageMemory.recordAttempt").mock
      .calls[0] as [{ kind: string; packId: string; accuracy: number }];
    expect(args.kind).toBe("rope");
    expect(args.packId).toBe(PACK_ID);
    expect(args.accuracy).toBeLessThan(85);
  });

  it("keeps Done for now as an exit from the introduce offer", async () => {
    const onExit = vi.fn();
    renderSession(
      passageView([piece(0, "unreached"), piece(1, "unreached")]),
      onExit,
    );

    await userEvent.click(
      screen.getByRole("button", { name: DONE_FOR_NOW_LABEL }),
    );
    expect(onExit).toHaveBeenCalledTimes(1);
    expect(mutationMock("passageMemory.introduceNext")).not.toHaveBeenCalled();
  });

  it("shows frontier-locked copy while the rope is still available", async () => {
    renderSession(
      passageView([
        piece(0, "attached", {
          learnStage: 2,
          dueAt: getSessionNow() + DAY_MS,
        }),
        piece(1, "unreached"),
      ]),
    );

    expect(screen.getByText(FRONTIER_LOCKED_COPY)).toBeInTheDocument();
    expect(
      await screen.findByLabelText("Your recited passage"),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: INTRODUCE_ANOTHER_LABEL }),
    ).not.toBeInTheDocument();
  });

  it("nudges introduce after a rope-only session without blocking the rope or exit", async () => {
    const onExit = vi.fn();
    const pieces = [
      piece(0, "attached", {
        learnStage: 2,
        dueAt: getSessionNow() + DAY_MS,
      }),
      piece(1, "unreached"),
    ];
    mutationMock("passageMemory.recordAttempt").mockResolvedValue(
      passageView(pieces, { addsOnDay: 0, remainingIntroduces: 5 }),
    );
    renderSession(passageView(pieces, { addsOnDay: 0 }), onExit);

    const answer = await screen.findByLabelText("Your recited passage");
    await screen.findByLabelText("Rope hint");
    await userEvent.click(answer);
    await userEvent.paste(PASSAGE_ONE);

    const check = screen.getByRole("button", { name: /Check answer/ });
    await waitFor(() => {
      expect(check).toBeEnabled();
    });
    await userEvent.click(check);

    await userEvent.click(
      await screen.findByRole("button", { name: "Continue" }),
    );

    expect(
      screen.getByRole("status", { name: "Session phase: Introduce" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: INTRODUCE_ANOTHER_LABEL }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: DONE_FOR_NOW_LABEL }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/haven't introduced a new piece yet today/),
    ).toBeInTheDocument();
    expect(screen.getByText(FRONTIER_LOCKED_COPY)).toBeInTheDocument();
    expect(screen.getByLabelText("Your recited passage")).toBeInTheDocument();

    await userEvent.click(
      screen.getByRole("button", { name: DONE_FOR_NOW_LABEL }),
    );
    expect(onExit).toHaveBeenCalledTimes(1);
  });

  it("keeps the planned section-complete and introduce labels", () => {
    expect(INTRODUCE_ANOTHER_LABEL).toBe("Introduce another piece");
    expect(DONE_FOR_NOW_LABEL).toBe("Done for now");
    expect(FRONTIER_LOCKED_COPY).toMatch(
      /Come back tomorrow for this piece — you can still practice the rope/,
    );
    expect(SECTION_COMPLETE_COPY).toMatch(/This section is solid/);
    expect(SECTION_RECITE_LABEL).toBe("Recite this section");
  });
});

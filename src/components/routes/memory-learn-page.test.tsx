import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TooltipProvider } from "@/components/ui/tooltip";
import { getSessionNow } from "@/hooks/use-live-now";
import {
  dismissLearnPackForToday,
  learnDismissDayKey,
} from "@/lib/learn-dismissed-packs";
import { DAY_MS } from "@/lib/memory-scheduler";
import type { PassagePiece } from "@/lib/passage-pieces";
import {
  BUDGET_EXHAUSTED_COPY,
  DONE_FOR_NOW_LABEL,
  FRONTIER_LOCKED_COPY,
  NEXT_VERSE_PROMPT_COPY,
} from "@/components/memory/passage/passage-session-model";
import type { PassageView } from "@/components/memory/passage/passage-session-types";
import type { EsvChapterData } from "../../../shared/esv-api";

import { MemoryLearnPage } from "./memory-learn-page";
import type { Id } from "../../../convex/_generated/dataModel";

const { queryResults, actionMocks, mutationMocks, onExitHome } = vi.hoisted(
  () => ({
    queryResults: new Map<string, unknown>(),
    actionMocks: new Map<string, ReturnType<typeof vi.fn>>(),
    mutationMocks: new Map<string, ReturnType<typeof vi.fn>>(),
    onExitHome: vi.fn(),
  }),
);

function actionMock(name: string) {
  const existing = actionMocks.get(name);
  if (existing) return existing;
  const created = vi.fn().mockResolvedValue(undefined);
  actionMocks.set(name, created);
  return created;
}

function mutationMock(name: string) {
  const existing = mutationMocks.get(name);
  if (existing) return existing;
  const created = vi.fn().mockResolvedValue(undefined);
  mutationMocks.set(name, created);
  return created;
}

vi.mock("convex/react", () => ({
  useMutation: (name: string) => mutationMock(name),
  useAction: (name: string) => actionMock(name),
}));

vi.mock("convex-helpers/react/cache", () => ({
  useQuery: (name: string, args: unknown) => {
    if (args === "skip") return undefined;
    if (
      name === "passageMemory.getForPack" &&
      args &&
      typeof args === "object" &&
      "packId" in args &&
      typeof args.packId === "string"
    ) {
      const byPack = `passageMemory.getForPack:${args.packId}`;
      if (queryResults.has(byPack)) return queryResults.get(byPack);
    }
    return queryResults.get(name);
  },
}));

vi.mock("@/hooks/use-memory-back", () => ({
  useMemoryBack: () => onExitHome,
}));

vi.mock("@/routes/memory/learn", () => ({
  Route: { useSearch: () => ({}) },
}));

vi.mock("../../../convex/_generated/api", () => ({
  api: {
    esv: {
      getChaptersBatch: "esv.getChaptersBatch",
      getPassage: "esv.getPassage",
    },
    savedVerses: {
      listAll: "savedVerses.listAll",
      listRecordingIds: "savedVerses.listRecordingIds",
    },
    packs: {
      recordUnifiedReview: "packs.recordUnifiedReview",
      acceptRetryHold: "packs.acceptRetryHold",
    },
    verseMemory: {
      recordAttempt: "verseMemory.recordAttempt",
      acceptRetryHold: "verseMemory.acceptRetryHold",
    },
    passageMemory: {
      dueForLearning: "passageMemory.dueForLearning",
      getForPack: "passageMemory.getForPack",
      introduceNext: "passageMemory.introduceNext",
      recordAttempt: "passageMemory.recordAttempt",
      acceptRetryHold: "passageMemory.acceptRetryHold",
    },
  },
}));

const JUDE = "Sample · Jude (building)";
const THIRD_JOHN = "Sample · 3 John (budget used)";
const PACK_JUDE = "pack_jude" as Id<"packs">;
const PACK_3JOHN = "pack_3john" as Id<"packs">;

const psalm23: EsvChapterData = {
  canonical: "Psalm 23",
  copyright: "test",
  verses: [
    { number: 1, text: "The Lord is my shepherd; I shall not want." },
    { number: 2, text: "He makes me lie down in green pastures." },
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
    sectionIndex: 0,
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
  return {
    _id: "passage_1" as Id<"passageMemory">,
    packId: PACK_JUDE,
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
    frontierIndex: 0,
    rehearsalStartIndex: 0,
    ropePieceIndexes: [],
    ...extra,
  };
}

const DEFAULT_DUE_PACKS = [
  { packId: PACK_JUDE, packName: JUDE },
  { packId: PACK_3JOHN, packName: THIRD_JOHN },
];

function renderLearn(
  view: PassageView,
  options?: {
    passages?: ReadonlyArray<{ packId: Id<"packs">; packName: string }>;
    savedVerses?: unknown[];
    missingPackIds?: ReadonlyArray<Id<"packs">>;
  },
) {
  queryResults.set("savedVerses.listAll", options?.savedVerses ?? []);
  queryResults.set(
    "passageMemory.dueForLearning",
    options?.passages ?? DEFAULT_DUE_PACKS,
  );
  queryResults.set("passageMemory.getForPack", view);
  for (const packId of options?.missingPackIds ?? []) {
    queryResults.set(`passageMemory.getForPack:${packId}`, null);
  }

  return render(
    <TooltipProvider delayDuration={0}>
      <MemoryLearnPage />
    </TooltipProvider>,
  );
}

function nextVerseView(): PassageView {
  return passageView([
    piece(0, "attached", {
      learnStage: 2,
      dueAt: getSessionNow() + DAY_MS,
    }),
    piece(1, "unreached"),
  ]);
}

describe("MemoryLearnPage", () => {
  beforeEach(() => {
    queryResults.clear();
    actionMocks.clear();
    mutationMocks.clear();
    onExitHome.mockReset();
    localStorage.clear();
    sessionStorage.clear();
    actionMock("esv.getChaptersBatch").mockResolvedValue([
      { chapter: 23, data: psalm23 },
    ]);
    mutationMock("passageMemory.introduceNext").mockResolvedValue(
      passageView([piece(0, "learning"), piece(1, "unreached")], {
        addsOnDay: 1,
        remainingIntroduces: 4,
      }),
    );
  });

  it.each([
    {
      name: "next verse",
      copy: NEXT_VERSE_PROMPT_COPY,
      view: passageView([
        piece(0, "attached", {
          learnStage: 2,
          dueAt: getSessionNow() + DAY_MS,
        }),
        piece(1, "unreached"),
      ]),
    },
    {
      name: "last verse locked",
      copy: FRONTIER_LOCKED_COPY,
      view: passageView([
        piece(0, "learning", {
          learnStage: 2,
          dueAt: getSessionNow() + DAY_MS,
        }),
      ]),
    },
    {
      name: "budget reached",
      copy: BUDGET_EXHAUSTED_COPY,
      view: passageView(
        [piece(0, "solid", { learnStage: 3 }), piece(1, "unreached")],
        { remainingIntroduces: 0, addsOnDay: 5 },
      ),
    },
  ])(
    "returns home from $name instead of starting the next pack",
    async ({ copy, view }) => {
      renderLearn(view);

      expect(await screen.findByText(JUDE)).toBeInTheDocument();
      expect(screen.getByText(copy)).toBeInTheDocument();
      expect(screen.queryByText(THIRD_JOHN)).not.toBeInTheDocument();

      await userEvent.click(
        screen.getByRole("button", { name: DONE_FOR_NOW_LABEL }),
      );

      expect(onExitHome).toHaveBeenCalledTimes(1);
      expect(screen.getByText(JUDE)).toBeInTheDocument();
      expect(screen.queryByText(THIRD_JOHN)).not.toBeInTheDocument();
      expect(screen.queryByText(/Warm up/i)).not.toBeInTheDocument();
      expect(
        mutationMock("passageMemory.introduceNext"),
      ).not.toHaveBeenCalled();
    },
  );

  it("keeps Start next verse on the current pack", async () => {
    renderLearn(nextVerseView());

    await userEvent.click(
      await screen.findByRole("button", { name: "Start Psalm 23:2" }),
    );

    await waitFor(() => {
      expect(mutationMock("passageMemory.introduceNext")).toHaveBeenCalled();
    });
    expect(onExitHome).not.toHaveBeenCalled();
    expect(screen.getByText(JUDE)).toBeInTheDocument();
    expect(screen.queryByText(THIRD_JOHN)).not.toBeInTheDocument();
  });

  it("returns home from the retry panel instead of starting the next pack", async () => {
    mutationMock("passageMemory.introduceNext").mockRejectedValue(
      new Error("ConvexError"),
    );
    renderLearn(passageView([piece(0, "unreached"), piece(1, "unreached")]));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /couldn't start the next verse/i,
    );
    expect(screen.getByText(JUDE)).toBeInTheDocument();
    expect(screen.queryByText(THIRD_JOHN)).not.toBeInTheDocument();

    await userEvent.click(
      screen.getByRole("button", { name: DONE_FOR_NOW_LABEL }),
    );

    expect(onExitHome).toHaveBeenCalledTimes(1);
    expect(screen.getByText(JUDE)).toBeInTheDocument();
    expect(screen.queryByText(THIRD_JOHN)).not.toBeInTheDocument();
    expect(screen.queryByText(/Warm up/i)).not.toBeInTheDocument();
    expect(mutationMock("passageMemory.introduceNext")).toHaveBeenCalledTimes(
      1,
    );
  });

  it("opens the next due pack on a later visit after That's enough for today", async () => {
    const first = renderLearn(nextVerseView());

    expect(await screen.findByText(JUDE)).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", { name: DONE_FOR_NOW_LABEL }),
    );
    expect(onExitHome).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(THIRD_JOHN)).not.toBeInTheDocument();
    expect(localStorage.getItem("berean:learn-dismissed-packs")).toContain(
      PACK_JUDE,
    );
    expect(sessionStorage.getItem("berean:learn-dismissed-packs")).toBeNull();
    sessionStorage.clear();

    first.unmount();
    onExitHome.mockClear();
    renderLearn(nextVerseView());

    expect(await screen.findByText(THIRD_JOHN)).toBeInTheDocument();
    expect(screen.queryByText(JUDE)).not.toBeInTheDocument();
    expect(screen.getByText(NEXT_VERSE_PROMPT_COPY)).toBeInTheDocument();
    expect(onExitHome).not.toHaveBeenCalled();
  });

  it("opens the verse session on a later visit when the only due pack was dismissed", async () => {
    const savedVerses = [
      {
        verseRefId: "verse_john316" as Id<"verseRefs">,
        book: "John",
        chapter: 3,
        startVerse: 16,
        endVerse: 16,
        memory: {
          status: "learning" as const,
          learnStage: 1,
          stageReps: 0,
          dueAt: getSessionNow(),
        },
      },
    ];
    const passages = [{ packId: PACK_JUDE, packName: JUDE }];
    const first = renderLearn(nextVerseView(), { passages, savedVerses });

    expect(await screen.findByText(JUDE)).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", { name: DONE_FOR_NOW_LABEL }),
    );
    first.unmount();

    renderLearn(nextVerseView(), { passages, savedVerses });

    expect(await screen.findByText("Today's learning")).toBeInTheDocument();
    expect(screen.queryByText(JUDE)).not.toBeInTheDocument();
    expect(screen.queryByText(DONE_FOR_NOW_LABEL)).not.toBeInTheDocument();
  });

  it("opens the same pack again after Back", async () => {
    const first = renderLearn(nextVerseView());

    await userEvent.click(await screen.findByRole("button", { name: "Back" }));
    expect(onExitHome).toHaveBeenCalledTimes(1);

    first.unmount();
    onExitHome.mockClear();
    renderLearn(nextVerseView());

    expect(await screen.findByText(JUDE)).toBeInTheDocument();
    expect(screen.queryByText(THIRD_JOHN)).not.toBeInTheDocument();
  });

  it("still opens a pack dismissed on an earlier local day", async () => {
    dismissLearnPackForToday(
      PACK_JUDE,
      learnDismissDayKey(getSessionNow()) - 1,
    );
    renderLearn(nextVerseView());

    expect(await screen.findByText(JUDE)).toBeInTheDocument();
    expect(screen.queryByText(THIRD_JOHN)).not.toBeInTheDocument();
  });

  it("drops a missing passage on Back and opens the next pack next visit", async () => {
    const first = renderLearn(nextVerseView(), {
      missingPackIds: [PACK_JUDE],
    });

    expect(await screen.findByText("Passage not found")).toBeInTheDocument();
    expect(screen.queryByText(JUDE)).not.toBeInTheDocument();
    expect(screen.queryByText(THIRD_JOHN)).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Back" }));

    expect(onExitHome).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Passage not found")).toBeInTheDocument();
    expect(screen.queryByText(THIRD_JOHN)).not.toBeInTheDocument();

    first.unmount();
    onExitHome.mockClear();
    renderLearn(nextVerseView(), { missingPackIds: [PACK_JUDE] });

    expect(await screen.findByText(THIRD_JOHN)).toBeInTheDocument();
    expect(screen.queryByText("Passage not found")).not.toBeInTheDocument();
    expect(screen.queryByText(JUDE)).not.toBeInTheDocument();
  });
});

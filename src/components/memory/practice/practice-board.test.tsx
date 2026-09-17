import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TooltipProvider } from "@/components/ui/tooltip";
import { getSessionNow } from "@/hooks/use-live-now";
import type { Id } from "../../../../convex/_generated/dataModel";
import type { EsvChapterData } from "../../../../shared/esv-api";

import { PracticeBoard, type PracticeVerse } from "./practice-board";

const {
  queryResults,
  mutationMocks,
  navigateMock,
  fetchChaptersBatchMock,
  getPassageMock,
} = vi.hoisted(() => ({
  queryResults: new Map<string, unknown>(),
  mutationMocks: new Map<string, ReturnType<typeof vi.fn>>(),
  navigateMock: vi.fn(),
  fetchChaptersBatchMock: vi.fn(),
  getPassageMock: vi.fn(),
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
    name === "esv.getChaptersBatch" ? fetchChaptersBatchMock : getPassageMock,
}));

vi.mock("convex-helpers/react/cache", () => ({
  useQuery: (name: string) => queryResults.get(name),
}));

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => navigateMock,
}));

vi.mock("../../../../convex/_generated/api", () => ({
  api: {
    esv: {
      getChaptersBatch: "esv.getChaptersBatch",
      getPassage: "esv.getPassage",
    },
    packs: { recordUnifiedReview: "packs.recordUnifiedReview" },
    passageMemory: { recordAttempt: "passageMemory.recordAttempt" },
    savedVerses: { listAll: "savedVerses.listAll" },
    verseMemory: { recordAttempt: "verseMemory.recordAttempt" },
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

function span(startVerse: number, endVerse: number) {
  return { book: "Psalms", chapter: 23, startVerse, endVerse };
}

const compositeVerse: PracticeVerse = {
  reference: span(1, 1),
  learnStage: 3,
  stageReps: 0,
  status: "reviewing",
  dueAt: getSessionNow() - 1000,
  ease: 2.3,
  intervalDays: 1,
  consecutiveCorrect: 1,
  lapses: 0,
  earlyReviewApplied: false,
  composite: {
    packId: PACK_ID,
    members: [span(1, 1), span(2, 2)],
  },
};

function renderComposite() {
  return render(
    <TooltipProvider delayDuration={0}>
      <PracticeBoard
        kind="review"
        verses={[compositeVerse]}
        scopeLabel="Psalm 23"
        onExit={() => {}}
        exitLabel="Back to pack"
        // Live value once the recitation has been graded: the whole pack now
        // shares one future due date, so nothing is left due today.
        remainingDue={0}
      />
    </TooltipProvider>,
  );
}

describe("PracticeBoard composite recitation", () => {
  beforeEach(() => {
    queryResults.clear();
    mutationMocks.clear();
    navigateMock.mockReset();
    sessionStorage.clear();
    queryResults.set("savedVerses.listAll", []);
    fetchChaptersBatchMock.mockReset();
    fetchChaptersBatchMock.mockResolvedValue([{ chapter: 23, data: psalm23 }]);
    getPassageMock.mockReset();
    getPassageMock.mockResolvedValue(psalm23);
    mutationMock("packs.recordUnifiedReview").mockResolvedValue({
      status: "reviewing",
      learnStage: 3,
      stageReps: 0,
      ease: 2.35,
      intervalDays: 2.3,
      dueAt: getSessionNow() + 2 * 24 * 60 * 60 * 1000,
      consecutiveCorrect: 2,
      lapses: 0,
      earlyReviewApplied: false,
    });
  });

  it("recites the pack as one card and grades it through recordUnifiedReview", async () => {
    const { container } = renderComposite();

    // Verse numbers are never typed: the concatenated text is the answer.
    const answer = await screen.findByLabelText("Your recited passage");
    await userEvent.click(answer);
    await userEvent.paste(`${PASSAGE_ONE} ${PASSAGE_TWO}`);

    const check = screen.getByRole("button", { name: /Check answer/ });
    await waitFor(() => {
      expect(check).toBeEnabled();
    });

    // Pack name as the title, a quiet verse-count subtitle, one rail row, and
    // no order toggle — it is a single passage in passage order.
    expect(
      container.querySelector('[data-slot="card-title"]'),
    ).toHaveTextContent("Psalm 23");
    expect(screen.getByText("2 verses · one recitation")).toBeInTheDocument();
    expect(
      screen.getByText("Recite the whole passage from memory"),
    ).toBeInTheDocument();
    expect(screen.getByText("Passage")).toBeVisible();
    expect(
      screen.queryByRole("button", { name: /Shuffle/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.getAllByRole("button", {
        name: /^Psalm 23 \(From Memory band\)$/,
      }),
    ).toHaveLength(1);

    await userEvent.click(check);

    const recordUnified = mutationMock("packs.recordUnifiedReview");
    await waitFor(() => {
      expect(recordUnified).toHaveBeenCalledTimes(1);
    });
    const [args] = recordUnified.mock.calls[0] as [
      { id: string; quality: string; accuracy: number; wordCount: number },
    ];
    expect(args.id).toBe(PACK_ID);
    expect(args.quality).toBe("exact");
    expect(args.accuracy).toBe(100);
    // The whole passage drives the long-verse rep curve, not one span: 9
    // words from the first unit plus 8 from the second.
    expect(args.wordCount).toBe(17);

    // The composite grade never touches the per-verse mutation.
    expect(mutationMock("verseMemory.recordAttempt")).not.toHaveBeenCalled();
    expect(mutationMock("passageMemory.recordAttempt")).not.toHaveBeenCalled();

    expect(await screen.findByText("100% recalled.")).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: /Continue/ }));

    // One summary, one accuracy, labeled with the pack — and no per-verse
    // practice shortcut into a single span.
    const summary = await screen.findByRole("heading", {
      name: /All caught up/,
    });
    expect(summary).toBeVisible();
    expect(screen.getByText("100%")).toBeVisible();
    const row = within(screen.getByRole("listitem"));
    expect(row.getByText("Psalm 23")).toBeVisible();
    expect(
      row.queryByRole("button", { name: "Practice" }),
    ).not.toBeInTheDocument();
  });

  it("grades a reviewing passage through passageMemory, not unified review", async () => {
    mutationMock("passageMemory.recordAttempt").mockResolvedValue({
      status: "reviewing",
      stageReps: 0,
      ease: 2.35,
      intervalDays: 2.3,
      dueAt: getSessionNow() + 2 * 24 * 60 * 60 * 1000,
      consecutiveCorrect: 2,
      lapses: 0,
      earlyReviewApplied: false,
    });
    render(
      <TooltipProvider delayDuration={0}>
        <PracticeBoard
          kind="review"
          verses={[
            {
              ...compositeVerse,
              composite: {
                ...compositeVerse.composite!,
                passageStatus: "reviewing",
              },
            },
          ]}
          scopeLabel="Psalm 23"
          onExit={() => {}}
          remainingDue={0}
        />
      </TooltipProvider>,
    );

    const answer = await screen.findByLabelText("Your recited passage");
    await userEvent.click(answer);
    await userEvent.paste(`${PASSAGE_ONE} ${PASSAGE_TWO}`);
    const check = screen.getByRole("button", { name: /Check answer/ });
    await waitFor(() => {
      expect(check).toBeEnabled();
    });
    await userEvent.click(check);

    const recordPassage = mutationMock("passageMemory.recordAttempt");
    await waitFor(() => {
      expect(recordPassage).toHaveBeenCalledTimes(1);
    });
    const [args] = recordPassage.mock.calls[0] as [
      { packId: string; kind: string; quality: string; accuracy: number },
    ];
    expect(args.packId).toBe(PACK_ID);
    expect(args.kind).toBe("review");
    expect(args.quality).toBe("exact");
    expect(mutationMock("packs.recordUnifiedReview")).not.toHaveBeenCalled();
    expect(mutationMock("verseMemory.recordAttempt")).not.toHaveBeenCalled();
  });

  it("offers retry when the composite passage fails to load", async () => {
    fetchChaptersBatchMock.mockRejectedValue(new Error("ESV is down"));
    renderComposite();

    expect(
      await screen.findByText("Could not load verse text."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
    fetchChaptersBatchMock.mockResolvedValue([{ chapter: 23, data: psalm23 }]);
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(
      await screen.findByLabelText("Your recited passage"),
    ).toBeInTheDocument();
  });
});

const VERSE_REF_ID = "vr_ps23_1" as Id<"verseRefs">;

const learningVerse: PracticeVerse = {
  reference: span(1, 1),
  learnStage: 0,
  stageReps: 0,
  status: "learning",
  dueAt: getSessionNow() - 1000,
};

describe("PracticeBoard learning Read prime", () => {
  beforeEach(() => {
    queryResults.clear();
    mutationMocks.clear();
    navigateMock.mockReset();
    sessionStorage.clear();
    queryResults.set("savedVerses.listAll", [
      {
        verseRefId: VERSE_REF_ID,
        book: "Psalms",
        chapter: 23,
        startVerse: 1,
        endVerse: 1,
      },
    ]);
    fetchChaptersBatchMock.mockReset();
    getPassageMock.mockReset();
    getPassageMock.mockResolvedValue(psalm23);
    mutationMock("verseMemory.recordAttempt").mockResolvedValue({
      status: "learning",
      learnStage: 1,
      stageReps: 0,
      ease: 2.3,
      intervalDays: 0,
      dueAt: getSessionNow() + 1000,
      consecutiveCorrect: 1,
      lapses: 0,
      earlyReviewApplied: false,
    });
  });

  it("advances from Read when Enter is pressed", async () => {
    const user = userEvent.setup();
    render(
      <TooltipProvider delayDuration={0}>
        <PracticeBoard
          kind="learning"
          verses={[learningVerse]}
          scopeLabel="Memory"
          onExit={() => {}}
        />
      </TooltipProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText("Read it through, then continue")).toBeVisible();
    });
    const continueButton = await screen.findByRole("button", {
      name: /Continue/,
    });
    await waitFor(() => {
      expect(continueButton).toBeEnabled();
    });

    await user.keyboard("{Enter}");

    await waitFor(() => {
      expect(mutationMock("verseMemory.recordAttempt")).toHaveBeenCalledTimes(
        1,
      );
    });
    const [args] = mutationMock("verseMemory.recordAttempt").mock.calls[0] as [
      { verseRefId: string; mode: string; stage: number; quality: string },
    ];
    expect(args.verseRefId).toBe(VERSE_REF_ID);
    expect(args.mode).toBe("learn");
    expect(args.stage).toBe(0);
    expect(args.quality).toBe("exact");

    expect(
      await screen.findByText("Type what you remember"),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Read it through, then continue"),
    ).not.toBeInTheDocument();
  });
});

const guidedVerse: PracticeVerse = {
  ...learningVerse,
  learnStage: 1,
};

describe("PracticeBoard recall submit loading", () => {
  beforeEach(() => {
    queryResults.clear();
    mutationMocks.clear();
    navigateMock.mockReset();
    sessionStorage.clear();
    queryResults.set("savedVerses.listAll", [
      {
        verseRefId: VERSE_REF_ID,
        book: "Psalms",
        chapter: 23,
        startVerse: 1,
        endVerse: 1,
      },
    ]);
    fetchChaptersBatchMock.mockReset();
    getPassageMock.mockReset();
    getPassageMock.mockResolvedValue(psalm23);
  });

  it("shows a spinner on Continue while the recall is saving", async () => {
    let resolveRecord!: (value: unknown) => void;
    const pendingRecord = new Promise((resolve) => {
      resolveRecord = resolve;
    });
    mutationMock("verseMemory.recordAttempt").mockReturnValue(pendingRecord);

    render(
      <TooltipProvider delayDuration={0}>
        <PracticeBoard
          kind="learning"
          verses={[guidedVerse]}
          scopeLabel="Memory"
          onExit={() => {}}
        />
      </TooltipProvider>,
    );

    const answer = await screen.findByLabelText("Your recalled verse");
    await userEvent.click(answer);
    await userEvent.paste(PASSAGE_ONE);

    const check = screen.getByRole("button", { name: /Check answer/ });
    await waitFor(() => {
      expect(check).toBeEnabled();
    });

    await userEvent.click(check);

    expect(await screen.findByText("100% recalled.")).toBeVisible();
    const continueButton = screen.getByRole("button", { name: /Continue/ });
    expect(continueButton).toBeDisabled();
    expect(continueButton).toHaveAttribute("aria-busy", "true");
    expect(continueButton.querySelector("[data-icon=spinner]")).not.toBeNull();

    resolveRecord({
      status: "learning",
      learnStage: 1,
      stageReps: 1,
      ease: 2.3,
      intervalDays: 0,
      dueAt: getSessionNow() + 1000,
      consecutiveCorrect: 1,
      lapses: 0,
      earlyReviewApplied: false,
    });

    await waitFor(() => {
      expect(continueButton).toBeEnabled();
      expect(continueButton).not.toHaveAttribute("aria-busy");
    });
    expect(continueButton.querySelector("[data-icon=spinner]")).toBeNull();
  });
});

function learningRef(
  book: string,
  chapter: number,
  startVerse: number,
  endVerse = startVerse,
): PracticeVerse {
  return {
    reference: { book, chapter, startVerse, endVerse },
    learnStage: 1,
    stageReps: 0,
    status: "learning",
    dueAt: getSessionNow() - 1000,
  };
}

const psalm8: EsvChapterData = {
  canonical: "Psalm 8",
  copyright: "test",
  verses: [
    { number: 2, text: "Out of the mouth of babies and infants." },
    { number: 3, text: "When I look at your heavens." },
    { number: 4, text: "What is man that you are mindful of him." },
    {
      number: 5,
      text: "Yet you have made him a little lower than the heavenly beings.",
    },
  ],
};

const luke9: EsvChapterData = {
  canonical: "Luke 9",
  copyright: "test",
  verses: [
    { number: 23, text: "And he said to all, If anyone would come after me." },
    { number: 24, text: "For whoever would save his life will lose it." },
  ],
};

function verseRailLabels(): string[] {
  return screen
    .getAllByRole("button", { name: /band/ })
    .map((button) => button.textContent?.replace(/\s+/g, " ").trim() ?? "");
}

describe("PracticeBoard in-order Scripture sequence", () => {
  beforeEach(() => {
    queryResults.clear();
    mutationMocks.clear();
    navigateMock.mockReset();
    sessionStorage.clear();
    queryResults.set("savedVerses.listAll", []);
    fetchChaptersBatchMock.mockReset();
    getPassageMock.mockReset();
    getPassageMock.mockImplementation(({ query }: { query: string }) =>
      Promise.resolve(query === "Luke 9" ? luke9 : psalm8),
    );
  });

  it("keeps a mixed Continue Learning queue in Bible order with chapter groups", async () => {
    render(
      <TooltipProvider delayDuration={0}>
        <PracticeBoard
          kind="learning"
          verses={[
            learningRef("Luke", 9, 23, 24),
            learningRef("Psalms", 8, 5),
            learningRef("Psalms", 8, 3, 4),
            learningRef("Psalms", 8, 2),
          ]}
          scopeLabel="Today's learning"
          onExit={() => {}}
        />
      </TooltipProvider>,
    );

    expect(
      await screen.findByRole("button", { name: /Psalm 8:2 \(Guided band\)/ }),
    ).toBeVisible();
    expect(screen.getByText("Psalm 8")).toBeVisible();
    expect(screen.getByText("Luke 9")).toBeVisible();
    expect(
      screen.getByText(
        "Scripture order. Verses from the same chapter stay together.",
      ),
    ).toBeVisible();
    expect(verseRailLabels()).toEqual([
      "Psalm 8:2",
      "Psalm 8:3-4",
      "Psalm 8:5",
      "Luke 9:23-24",
    ]);

    await userEvent.click(screen.getByRole("button", { name: "Shuffle" }));
    expect(screen.getByText("Psalm 8")).toBeVisible();
    expect(screen.getByText("Luke 9")).toBeVisible();
    expect(
      screen.getByText("Sets stay together. Only the set order is random."),
    ).toBeVisible();
    const shuffled = verseRailLabels();
    expect(shuffled).toContain("Psalm 8:2");
    expect(
      shuffled.slice(
        shuffled.indexOf("Psalm 8:2"),
        shuffled.indexOf("Psalm 8:2") + 3,
      ),
    ).toEqual(["Psalm 8:2", "Psalm 8:3-4", "Psalm 8:5"]);
    expect(
      shuffled.join() === "Luke 9:23-24,Psalm 8:2,Psalm 8:3-4,Psalm 8:5" ||
        shuffled.join() === "Psalm 8:2,Psalm 8:3-4,Psalm 8:5,Luke 9:23-24",
    ).toBe(true);

    await userEvent.click(screen.getByRole("button", { name: "In order" }));
    expect(verseRailLabels()).toEqual([
      "Psalm 8:2",
      "Psalm 8:3-4",
      "Psalm 8:5",
      "Luke 9:23-24",
    ]);
    expect(screen.getByText("Psalm 8")).toBeVisible();
    expect(screen.getByText("Luke 9")).toBeVisible();
  });

  it("hides Shuffle when the queue is a single chapter set", async () => {
    render(
      <TooltipProvider delayDuration={0}>
        <PracticeBoard
          kind="learning"
          verses={[
            learningRef("Psalms", 8, 5),
            learningRef("Psalms", 8, 3, 4),
            learningRef("Psalms", 8, 2),
          ]}
          scopeLabel="Psalm 8"
          onExit={() => {}}
        />
      </TooltipProvider>,
    );

    expect(
      await screen.findByRole("button", { name: /Psalm 8:2 \(Guided band\)/ }),
    ).toBeVisible();
    expect(verseRailLabels()).toEqual([
      "Psalm 8:2",
      "Psalm 8:3-4",
      "Psalm 8:5",
    ]);
    expect(
      screen.queryByRole("button", { name: "Shuffle" }),
    ).not.toBeInTheDocument();
  });
});

class MockSpeechRecognition {
  continuous = false;
  interimResults = false;
  lang = "";
  grammars: unknown = undefined;
  onresult:
    ((event: { results: unknown; resultIndex: number }) => void) | null = null;
  onerror: ((event: { error: string }) => void) | null = null;
  onend: (() => void) | null = null;
  onspeechstart: (() => void) | null = null;
  start(): void {}
  stop(): void {
    this.onend?.();
  }
  abort(): void {
    this.onend?.();
  }
  emit(items: Array<{ transcript: string; isFinal: boolean }>): void {
    const results = items.map((item) => {
      const alternative = { transcript: item.transcript, confidence: 1 };
      return Object.assign([alternative], {
        isFinal: item.isFinal,
        item: () => alternative,
      });
    });
    this.onresult?.({
      resultIndex: 0,
      results: Object.assign(results, {
        item: (index: number) => results[index],
      }),
    });
  }
}

const speechInstances: MockSpeechRecognition[] = [];

function installSpeechMock() {
  const speechWindow = window as Window & {
    SpeechRecognition?: new () => MockSpeechRecognition;
  };
  speechWindow.SpeechRecognition = class extends MockSpeechRecognition {
    constructor() {
      super();
      speechInstances.push(this);
    }
  };
}

function lastSpeech(): MockSpeechRecognition {
  const recognition = speechInstances.at(-1);
  if (!recognition) throw new Error("expected SpeechRecognition");
  return recognition;
}

describe("PracticeBoard Web Speech dictation", () => {
  beforeEach(() => {
    queryResults.clear();
    mutationMocks.clear();
    navigateMock.mockReset();
    sessionStorage.clear();
    window.localStorage.removeItem("berean:hideSpeech");
    window.localStorage.removeItem("berean:mockSpeech");
    speechInstances.length = 0;
    queryResults.set("savedVerses.listAll", [
      {
        verseRefId: VERSE_REF_ID,
        book: "Psalms",
        chapter: 23,
        startVerse: 1,
        endVerse: 1,
      },
    ]);
    fetchChaptersBatchMock.mockReset();
    getPassageMock.mockReset();
    getPassageMock.mockResolvedValue(psalm23);
    mutationMock("verseMemory.recordAttempt").mockResolvedValue({
      status: "learning",
      learnStage: 1,
      stageReps: 1,
      ease: 2.3,
      intervalDays: 0,
      dueAt: getSessionNow() + 1000,
      consecutiveCorrect: 1,
      lapses: 0,
      earlyReviewApplied: false,
    });
  });

  afterEach(() => {
    const speechWindow = window as Window & {
      SpeechRecognition?: unknown;
      webkitSpeechRecognition?: unknown;
    };
    delete speechWindow.SpeechRecognition;
    delete speechWindow.webkitSpeechRecognition;
  });

  function renderGuided() {
    return render(
      <TooltipProvider delayDuration={0}>
        <PracticeBoard
          kind="learning"
          verses={[guidedVerse]}
          scopeLabel="Memory"
          onExit={() => {}}
        />
      </TooltipProvider>,
    );
  }

  it("hides the mic when the Web Speech API is missing", async () => {
    renderGuided();
    await screen.findByLabelText("Your recalled verse");
    expect(
      screen.queryByRole("button", { name: "Dictate verse" }),
    ).not.toBeInTheDocument();
  });

  it("places a prominent mic under the recall box and streams words into it", async () => {
    installSpeechMock();
    const user = userEvent.setup();
    renderGuided();
    const answer = await screen.findByLabelText("Your recalled verse");
    const mic = await screen.findByRole("button", { name: "Dictate verse" });
    expect(
      mic.compareDocumentPosition(answer) & Node.DOCUMENT_POSITION_PRECEDING,
    ).toBeTruthy();

    await user.click(mic);
    expect(
      screen.getByRole("button", { name: "Stop dictation" }),
    ).toBeVisible();
    expect(
      document.querySelector('[data-slot="dictation-waveform"]'),
    ).not.toBeNull();

    act(() => {
      lastSpeech().emit([{ transcript: PASSAGE_ONE, isFinal: false }]);
    });
    expect(answer).toHaveValue(PASSAGE_ONE);
    expect(mutationMock("verseMemory.recordAttempt")).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Stop dictation" }));
    const check = screen.getByRole("button", { name: /Check answer/ });
    await waitFor(() => {
      expect(check).toBeEnabled();
    });
    await user.click(check);
    await waitFor(() => {
      expect(mutationMock("verseMemory.recordAttempt")).toHaveBeenCalledTimes(
        1,
      );
    });
    expect(await screen.findByText("100% recalled.")).toBeVisible();
  });

  it("DEV insert sample fills the recall box without auto-Check", async () => {
    window.localStorage.setItem("berean:mockSpeech", "1");
    const user = userEvent.setup();
    renderGuided();
    const answer = await screen.findByLabelText("Your recalled verse");
    await user.click(
      await screen.findByRole("button", { name: "Dictate verse" }),
    );
    await user.click(
      screen.getByRole("button", { name: "Insert spoken sample" }),
    );
    expect(answer).toHaveValue("The Lord is my shepherd; I shall not want");
    expect(mutationMock("verseMemory.recordAttempt")).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /Check answer/ })).toBeEnabled();
  });

  it("toggles the mic with Space when the box is empty, and inserts a space once it has text", async () => {
    installSpeechMock();
    const user = userEvent.setup();
    renderGuided();
    const answer = await screen.findByLabelText("Your recalled verse");
    await user.click(answer);
    await user.keyboard(" ");
    expect(answer).toHaveValue("");
    expect(
      screen.getByRole("button", { name: "Stop dictation" }),
    ).toBeVisible();
    expect(speechInstances).toHaveLength(1);

    await user.keyboard(" ");
    expect(screen.getByRole("button", { name: "Dictate verse" })).toBeVisible();

    await user.type(answer, "hello");
    await user.keyboard(" ");
    expect(answer).toHaveValue("hello ");
    expect(speechInstances).toHaveLength(1);
  });

  it("does not show the mic on Read prime cards", async () => {
    installSpeechMock();
    render(
      <TooltipProvider delayDuration={0}>
        <PracticeBoard
          kind="learning"
          verses={[learningVerse]}
          scopeLabel="Memory"
          onExit={() => {}}
        />
      </TooltipProvider>,
    );
    await waitFor(() => {
      expect(screen.getByText("Read it through, then continue")).toBeVisible();
    });
    expect(
      screen.queryByRole("button", { name: "Dictate verse" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByLabelText("Your recalled verse"),
    ).not.toBeInTheDocument();
  });
});

import type { AnchorHTMLAttributes, ReactNode } from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  MemoryPanelHost,
  MemoryPanelPage,
} from "@/components/memory/drawer/memory-panel-host";
import { TooltipProvider } from "@/components/ui/tooltip";
import { DAY_MS } from "@/lib/memory-scheduler";
import { localDayIndex } from "@/lib/passage-frontier";
import type { PassagePiece } from "@/lib/passage-pieces";

const HOUR_MS = 60 * 60 * 1000;
/** Monday, Oct 12, 2026. */
const NOW = Date.UTC(2026, 9, 12, 18);

const mocks = vi.hoisted(() => ({
  queryResults: new Map<string, unknown>(),
  queryByArgs: new Map<string, (args: unknown) => unknown>(),
  mutations: new Map<string, ReturnType<typeof vi.fn>>(),
  navigate: vi.fn(),
  startPassage: vi.fn(),
  toastSuccess: vi.fn(),
}));

function mutation(name: string) {
  let fn = mocks.mutations.get(name);
  if (!fn) {
    fn = vi.fn().mockResolvedValue(null);
    mocks.mutations.set(name, fn);
  }
  return fn;
}

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => mocks.navigate,
  useCanGoBack: () => false,
  Link: ({
    to,
    children,
    ...props
  }: AnchorHTMLAttributes<HTMLAnchorElement> & {
    to: string;
    children: ReactNode;
  }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("convex/react", () => ({
  useMutation: (name: string) => mutation(name),
  useAction: () => vi.fn(),
}));

vi.mock("convex-helpers/react/cache", () => ({
  useQuery: (name: string, args: unknown) => {
    if (args === "skip") return undefined;
    const byArgs = mocks.queryByArgs.get(name);
    return byArgs ? byArgs(args) : mocks.queryResults.get(name);
  },
  usePaginatedQuery: () => ({
    results: [],
    status: "Exhausted",
    loadMore: () => {},
  }),
}));

vi.mock("../../../../convex/_generated/api", () => ({
  api: {
    memoryHome: { today: "memoryHome.today" },
    packs: {
      get: "packs.get",
      resolveMembers: "packs.resolveMembers",
      touch: "packs.touch",
      stopMemorizing: "packs.stopMemorizing",
      setUnifiedReview: "packs.setUnifiedReview",
      listMine: "packs.listMine",
      addVerse: "packs.addVerse",
    },
    passageMemory: {
      getForPack: "passageMemory.getForPack",
      ensureDueBackfill: "passageMemory.ensureDueBackfill",
    },
    savedVerses: { listForChapter: "savedVerses.listForChapter" },
    verseMemory: {
      verseDetail: "verseMemory.verseDetail",
      stopMemorizing: "verseMemory.stopMemorizing",
    },
  },
}));

vi.mock("@/hooks/use-esv-reference", () => ({
  useEsvReference: (ref: { startVerse: number; endVerse: number } | null) => ({
    data: ref
      ? {
          canonical: "Psalm 16",
          copyright: "ESV",
          verses: Array.from(
            { length: ref.endVerse - ref.startVerse + 1 },
            (_, index) => ({
              number: ref.startVerse + index,
              text:
                ref.startVerse + index === 1
                  ? "Preserve me, O God, for in you I take refuge."
                  : `Verse ${ref.startVerse + index} text.`,
            }),
          ),
        }
      : null,
    loading: false,
    error: null,
  }),
}));

vi.mock("@/hooks/use-start-passage", () => ({
  useStartPassage: () => ({
    start: mocks.startPassage,
    pending: false,
    error: null,
  }),
}));

vi.mock("@/components/memory/memorize/memorize-context", () => ({
  useMemorizeSheet: () => ({ open: vi.fn() }),
}));

vi.mock("@/hooks/use-live-now", () => ({ useLiveNow: () => NOW }));

vi.mock("@/lib/viewer-timezone", () => ({ getViewerTimeZone: () => "UTC" }));

vi.mock("sonner", () => ({
  toast: { success: mocks.toastSuccess, error: vi.fn() },
}));

function scopeFor(chapter: number) {
  return {
    books: ["Psalms"],
    chapterRanges: [
      { book: "Psalms", startChapter: chapter, endChapter: chapter },
    ],
    tags: [],
    tagMatchMode: "any" as const,
  };
}

const PACKS: Record<string, unknown> = {
  psalm16: {
    _id: "psalm16",
    name: "Psalm 16",
    kind: "scope",
    scope: scopeFor(16),
    createdAt: NOW - 10 * DAY_MS,
    lastOpenedAt: NOW - DAY_MS,
  },
  merced: {
    _id: "merced",
    name: "Merced Team",
    kind: "custom",
    createdAt: Date.UTC(2026, 8, 12, 12),
    lastOpenedAt: NOW - DAY_MS,
  },
  psalm23: {
    _id: "psalm23",
    name: "Psalm 23",
    kind: "scope",
    scope: scopeFor(23),
    createdAt: NOW - 40 * DAY_MS,
    lastOpenedAt: NOW - DAY_MS,
  },
};

function piece(
  index: number,
  startVerse: number,
  endVerse: number,
  attachment: PassagePiece["attachment"],
  extra: Partial<PassagePiece> = {},
): PassagePiece {
  return {
    index,
    book: "Psalms",
    chapter: 16,
    startVerse,
    endVerse,
    sectionIndex: 0,
    attachment,
    learnStage: attachment === "solid" ? 3 : 0,
    stageReps: 0,
    ...(attachment === "unreached" ? {} : { dueAt: NOW - HOUR_MS }),
    ...extra,
  };
}

function passageView(extra: Record<string, unknown> = {}) {
  return {
    _id: "pm1",
    packId: "psalm16",
    status: "building",
    pieces: [
      piece(0, 1, 4, "solid"),
      piece(1, 5, 6, "unreached"),
      piece(2, 7, 11, "unreached"),
    ],
    addsOnDay: 0,
    ease: 2.5,
    intervalDays: 0,
    dueAt: NOW,
    consecutiveCorrect: 0,
    lapses: 0,
    stageReps: 0,
    createdAt: NOW - 10 * DAY_MS,
    updatedAt: NOW - DAY_MS,
    remainingIntroduces: 5,
    frontierIndex: 1,
    rehearsalStartIndex: 0,
    ropePieceIndexes: [0],
    ...extra,
  };
}

function member(verseRefId: string, extra: Record<string, unknown> = {}) {
  return {
    verseRefId,
    book: "Luke",
    chapter: 9,
    startVerse: 23,
    endVerse: 24,
    status: "reviewing",
    learnStage: 3,
    stageReps: 0,
    ease: 2.5,
    intervalDays: 6.6,
    consecutiveCorrect: 3,
    lapses: 0,
    dueAt: NOW - HOUR_MS,
    isDue: true,
    ...extra,
  };
}

const MERCED_MEMBERS = [
  member("luke"),
  member("josh", {
    book: "Joshua",
    chapter: 1,
    startVerse: 9,
    endVerse: 9,
    status: "learning",
    learnStage: 2,
    intervalDays: 0,
    dueAt: NOW + 12 * HOUR_MS,
    isDue: false,
  }),
  member("isa", {
    book: "Isaiah",
    chapter: 41,
    startVerse: 10,
    endVerse: 10,
    status: "new",
    learnStage: 0,
    intervalDays: 0,
    dueAt: NOW,
    isDue: false,
  }),
];

const PSALM_23_MEMBERS = [
  member("p23a", {
    book: "Psalms",
    chapter: 23,
    startVerse: 1,
    endVerse: 3,
    dueAt: NOW + 3 * DAY_MS,
    isDue: false,
  }),
  member("p23b", {
    book: "Psalms",
    chapter: 23,
    startVerse: 4,
    endVerse: 6,
  }),
];

let passages: Record<string, unknown> = {};
let membersByPack: Record<string, unknown> = {};

function renderHost(panel: string, from?: "verses") {
  return render(
    <TooltipProvider>
      <MemoryPanelHost panel={panel} from={from} />
    </TooltipProvider>,
  );
}

beforeEach(() => {
  mocks.queryResults.clear();
  mocks.queryByArgs.clear();
  mocks.mutations.clear();
  mocks.navigate.mockReset();
  mocks.startPassage.mockReset();
  mocks.startPassage.mockResolvedValue(undefined);
  mocks.toastSuccess.mockReset();
  passages = { psalm16: passageView() };
  membersByPack = {
    psalm16: [],
    merced: MERCED_MEMBERS,
    psalm23: PSALM_23_MEMBERS,
  };
  mocks.queryByArgs.set(
    "packs.get",
    (args) => PACKS[(args as { id: string }).id] ?? null,
  );
  mocks.queryByArgs.set(
    "packs.resolveMembers",
    (args) => membersByPack[(args as { id: string }).id] ?? [],
  );
  mocks.queryByArgs.set(
    "passageMemory.getForPack",
    (args) => passages[(args as { packId: string }).packId] ?? null,
  );
  mocks.queryResults.set("savedVerses.listForChapter", [
    {
      verseRefId: "heart-ps16",
      book: "Psalms",
      chapter: 16,
      startVerse: 1,
      endVerse: 11,
      passageMemoryId: "pm1",
    },
    {
      verseRefId: "heart-ps16-8",
      book: "Psalms",
      chapter: 16,
      startVerse: 8,
      endVerse: 8,
    },
  ]);
});

describe("PackDetail for a passage", () => {
  it("shows the Learned bar, today's step and a chip per verse", () => {
    renderHost("pack:psalm16");
    const dialog = screen.getByRole("dialog", { name: "Psalm 16" });

    expect(within(dialog).getByText(/Passage · 11 verses/)).toBeInTheDocument();
    expect(
      within(dialog).getByText(/hearted as one passage/),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByRole("link", { name: "Continue · about 4 min" }),
    ).toHaveAttribute(
      "href",
      "/memory/psalm16/learn?return=%2Fmemory%3Fpanel%3Dpack%253Apsalm16",
    );
    expect(
      within(dialog).getByRole("link", { name: "Open in reader" }),
    ).toHaveAttribute("href", "/passage/Psalms-16");
    expect(
      within(dialog).queryByRole("link", { name: /Practice anytime/ }),
    ).not.toBeInTheDocument();

    expect(
      within(dialog).getByText("Today, day 1 of 3 for verses 5–6:"),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByRole("progressbar", {
        name: "4 of 11 verses learned",
      }),
    ).toHaveAttribute("aria-valuenow", "36");
    expect(
      within(dialog).getByText(/^Mastery starts once all 11 are learned/),
    ).toBeInTheDocument();

    expect(within(dialog).getAllByText("Memorized")).toHaveLength(4);
    expect(within(dialog).getAllByText("Today: day 1 of 3")).toHaveLength(2);
    expect(within(dialog).getAllByText("Up next")).toHaveLength(5);
    expect(
      within(dialog).getByText("Preserve me, O God, for in you I take refuge."),
    ).toHaveClass("font-serif", "truncate");
    expect(
      within(dialog).getAllByRole("img", { name: "Also hearted on its own" }),
    ).toHaveLength(1);
  });

  it("waits with Up next tomorrow once today's verses are in", () => {
    passages = {
      psalm16: passageView({
        pieces: [
          piece(0, 1, 4, "solid"),
          piece(1, 5, 6, "learning", {
            learnStage: 2,
            dueAt: NOW + 12 * HOUR_MS,
          }),
          piece(2, 7, 11, "unreached"),
        ],
        addsOnDay: 5,
        addDayKey: localDayIndex(NOW, new Date(NOW).getTimezoneOffset()),
      }),
    };
    renderHost("pack:psalm16");

    expect(
      screen.getByRole("button", { name: /^Up next tomorrow/ }),
    ).toBeDisabled();
    expect(screen.getAllByText("Tomorrow: day 2 of 3")).toHaveLength(2);
  });

  it("recites a memorized passage that is due", () => {
    passages = {
      psalm16: passageView({
        status: "reviewing",
        pieces: [piece(0, 1, 11, "solid")],
        intervalDays: 6.6,
        dueAt: NOW - HOUR_MS,
      }),
    };
    renderHost("pack:psalm16");

    expect(
      screen.getByRole("link", { name: "Recite Psalm 16" }),
    ).toHaveAttribute(
      "href",
      "/memory/psalm16/review?return=%2Fmemory%3Fpanel%3Dpack%253Apsalm16",
    );
    expect(
      screen.getByRole("progressbar", { name: "Mastery 22%" }),
    ).toBeInTheDocument();
  });

  it("confirms Stop memorizing, clears it and closes the drawer", async () => {
    renderHost("pack:psalm16");

    await userEvent.click(screen.getByRole("button", { name: "More actions" }));
    expect(
      screen.queryByRole("menuitemcheckbox", {
        name: /Review together as one recitation/,
      }),
    ).not.toBeInTheDocument();
    await userEvent.click(
      await screen.findByRole("menuitem", { name: "Stop memorizing" }),
    );

    const confirm = await screen.findByRole("dialog", {
      name: "Stop memorizing Psalm 16?",
    });
    expect(
      within(confirm).getByText(
        "This clears your progress on Psalm 16. Your heart stays.",
      ),
    ).toBeInTheDocument();
    await userEvent.click(
      within(confirm).getByRole("button", { name: "Stop memorizing" }),
    );

    await waitFor(() =>
      expect(mocks.mutations.get("packs.stopMemorizing")).toHaveBeenCalledWith(
        expect.objectContaining({ id: "psalm16" }),
      ),
    );
    await waitFor(() =>
      expect(mocks.navigate).toHaveBeenLastCalledWith({
        to: "/memory",
        search: {},
      }),
    );
    expect(mocks.toastSuccess).toHaveBeenCalledWith(
      "Stopped memorizing Psalm 16.",
    );
  });
});

describe("PackDetail for a pack", () => {
  const RETURN = "return=%2Fmemory%3Fpanel%3Dpack%253Amerced%26from%3Dverses";

  it("shows both bars and per-verse Review, Practice and Learn", () => {
    renderHost("pack:merced", "verses");
    const dialog = screen.getByRole("dialog", { name: "Merced Team" });

    expect(
      within(dialog).getByText("Pack · 3 verses · added Sep 12"),
    ).toBeInTheDocument();
    // One review due and one Up-next verse: the pack's blended session runs both.
    expect(
      within(dialog).getByRole("link", { name: "Continue · 2 verses today" }),
    ).toHaveAttribute("href", `/memory/today?packId=merced&${RETURN}`);
    expect(
      within(dialog).getByRole("link", { name: "Practice anytime" }),
    ).toHaveAttribute("href", `/memory/merced/practice?${RETURN}`);
    expect(
      within(dialog).queryByRole("link", { name: "Open in reader" }),
    ).not.toBeInTheDocument();

    expect(
      within(dialog).getByRole("progressbar", {
        name: "1 of 3 verses learned",
      }),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByRole("progressbar", { name: /^Mastery/ }),
    ).toBeInTheDocument();

    expect(
      within(dialog).getByText("Memorized · review due today · mastery 22%"),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByRole("link", { name: "Review Luke 9:23-24" }),
    ).toHaveAttribute(
      "href",
      `/memory/review?book=Luke&chapter=9&startVerse=23&endVerse=24&${RETURN}`,
    );
    expect(
      within(dialog).getByRole("link", { name: "Practice Luke 9:23-24" }),
    ).toBeInTheDocument();

    expect(
      within(dialog).getByText("Learning · tomorrow: fill in the blanks"),
    ).toBeInTheDocument();
    expect(
      within(dialog).queryByRole("link", { name: /Joshua 1:9$/ }),
    ).toHaveAttribute("href", "/memory?panel=verse%3Ajosh");
    expect(
      within(dialog).queryByRole("link", { name: /^(Learn|Review) Joshua/ }),
    ).not.toBeInTheDocument();

    expect(
      within(dialog).getByText("Up next · starts when you're ready"),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByRole("link", { name: "Learn Isaiah 41:10" }),
    ).toHaveAttribute(
      "href",
      `/memory/learn?book=Isaiah&chapter=41&startVerse=10&endVerse=10&${RETURN}`,
    );
  });

  it("confirms Stop memorizing with the pack copy, then goes back to Your verses", async () => {
    renderHost("pack:merced", "verses");

    await userEvent.click(screen.getByRole("button", { name: "More actions" }));
    await userEvent.click(
      await screen.findByRole("menuitem", { name: "Stop memorizing" }),
    );
    const confirm = await screen.findByRole("dialog", {
      name: "Stop memorizing Merced Team?",
    });
    expect(
      within(confirm).getByText(
        "Verses that aren't in another pack leave Today. Your progress is saved if you start again.",
      ),
    ).toBeInTheDocument();
    await userEvent.click(
      within(confirm).getByRole("button", { name: "Stop memorizing" }),
    );

    await waitFor(() =>
      expect(mocks.navigate).toHaveBeenLastCalledWith({
        href: "/memory?panel=verses",
      }),
    );
  });

  it("offers Learn it as a passage for a legacy chapter pack", async () => {
    renderHost("pack:psalm23");

    expect(
      screen.getByText(/Want to learn all of Psalm 23 in order\?/),
    ).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", { name: "Learn it as a passage" }),
    );
    expect(mocks.startPassage).toHaveBeenCalledTimes(1);
  });

  it("turns on Review together from the ⋯ menu and goes to recite", async () => {
    renderHost("pack:psalm23");

    await userEvent.click(screen.getByRole("button", { name: "More actions" }));
    await userEvent.click(
      await screen.findByRole("menuitemcheckbox", {
        name: "Review together as one recitation",
      }),
    );
    const dialog = await screen.findByRole("dialog", {
      name: "Review Psalm 23 together?",
    });
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Turn on and recite" }),
    );

    await waitFor(() =>
      expect(
        mocks.mutations.get("packs.setUnifiedReview"),
      ).toHaveBeenCalledWith({ id: "psalm23", enabled: true, now: NOW }),
    );
    await waitFor(() =>
      expect(mocks.navigate).toHaveBeenLastCalledWith({
        href: "/memory/psalm23/review?return=%2Fmemory%3Fpanel%3Dpack%253Apsalm23",
      }),
    );
  });

  it("says so when the pack is gone", () => {
    renderHost("pack:missing");
    expect(
      screen.getByRole("dialog", { name: "Not found" }),
    ).toBeInTheDocument();
  });
});

describe("PackDetail on its full page", () => {
  it("returns sessions to the page and links back to Your verses", () => {
    render(
      <TooltipProvider>
        <MemoryPanelPage
          panel={{ kind: "pack", packId: "merced" }}
          from="verses"
        />
      </TooltipProvider>,
    );

    expect(
      screen.getByRole("heading", { level: 1, name: "Merced Team" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Back to Your verses" }),
    ).toHaveAttribute("href", "/memory/verses");
    expect(
      screen.getByRole("link", { name: "Continue · 2 verses today" }),
    ).toHaveAttribute(
      "href",
      "/memory/today?packId=merced&return=%2Fmemory%2Fmerced%3Ffrom%3Dverses",
    );
    expect(
      screen.queryByRole("link", { name: "Open full page" }),
    ).not.toBeInTheDocument();
  });
});

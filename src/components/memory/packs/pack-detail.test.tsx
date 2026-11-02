import type { AnchorHTMLAttributes, ReactNode } from "react";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  MemoryPanelHost,
  MemoryPanelPage,
} from "@/components/memory/drawer/memory-panel-host";
import { TooltipProvider } from "@/components/ui/tooltip";
import { memoryProgressFraction } from "@/lib/mastery-ring";
import {
  dismissLearnPackForToday,
  learnDismissDayKey,
  readLearnPacksDismissedToday,
} from "@/lib/learn-dismissed-packs";
import {
  START_OVER_CONFIRM_BODY,
  START_OVER_MENU_LABEL,
  STARTED_OVER_LABEL,
  startOverPassageBody,
} from "@/lib/memory-copy";
import { DAY_MS } from "@/lib/memory-scheduler";
import { localDayIndex } from "@/lib/passage-frontier";
import type { PassagePiece } from "@/lib/passage-pieces";

const HOUR_MS = 60 * 60 * 1000;
/** Monday, Oct 12, 2026. */
const NOW = Date.UTC(2026, 9, 12, 18);

const mocks = vi.hoisted(() => ({
  queryResults: new Map<string, unknown>(),
  queryByArgs: new Map<string, (args: unknown) => unknown>(),
  queryCalls: [] as Array<[string, unknown]>,
  mutations: new Map<string, ReturnType<typeof vi.fn>>(),
  navigate: vi.fn(),
  startPassage: vi.fn(),
  toast: vi.fn(),
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
    mocks.queryCalls.push([name, args]);
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
      remove: "packs.remove",
      setUnifiedReview: "packs.setUnifiedReview",
      listMine: "packs.listMine",
      addVerse: "packs.addVerse",
      rename: "packs.rename",
      removeVerse: "packs.removeVerse",
      restoreVerse: "packs.restoreVerse",
      reorder: "packs.reorder",
    },
    passageMemory: {
      getForPack: "passageMemory.getForPack",
      ensureDueBackfill: "passageMemory.ensureDueBackfill",
      startOver: "passageMemory.startOver",
    },
    savedVerses: {
      listForChapter: "savedVerses.listForChapter",
      listHearted: "savedVerses.listHearted",
    },
    verseMemory: {
      verseDetail: "verseMemory.verseDetail",
      stopMemorizing: "verseMemory.stopMemorizing",
      startOver: "verseMemory.startOver",
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
  toast: Object.assign(mocks.toast, {
    success: mocks.toastSuccess,
    error: vi.fn(),
  }),
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
  psalm16x: {
    _id: "psalm16x",
    name: "Psalm 16",
    kind: "scope",
    scope: scopeFor(16),
    createdAt: NOW - 10 * DAY_MS,
    lastOpenedAt: NOW - DAY_MS,
  },
  mercedxx: {
    _id: "mercedxx",
    name: "Merced Team",
    kind: "custom",
    createdAt: Date.UTC(2026, 8, 12, 12),
    lastOpenedAt: NOW - DAY_MS,
  },
  psalm23x: {
    _id: "psalm23x",
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
    packId: "psalm16x",
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
  mocks.queryCalls.length = 0;
  mocks.mutations.clear();
  mocks.navigate.mockReset();
  mocks.startPassage.mockReset();
  mocks.startPassage.mockResolvedValue(undefined);
  mocks.toast.mockReset();
  mocks.toastSuccess.mockReset();
  passages = { psalm16x: passageView() };
  membersByPack = {
    psalm16x: [],
    mercedxx: MERCED_MEMBERS,
    psalm23x: PSALM_23_MEMBERS,
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
    renderHost("pack:psalm16x");
    const dialog = screen.getByRole("dialog", { name: "Psalm 16" });

    expect(within(dialog).getByText(/Passage · 11 verses/)).toBeInTheDocument();
    expect(
      within(dialog).getByText(/hearted as one passage/),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByRole("link", { name: "Continue · about 7 min" }),
    ).toHaveAttribute(
      "href",
      "/memory/psalm16x/learn?return=%2Fmemory%2Fpsalm16x",
    );
    expect(
      within(dialog).getByRole("link", { name: "Open in reader" }),
    ).toHaveAttribute("href", "/passage/Psalms-16");
    expect(
      within(dialog).queryByRole("link", { name: /Practice anytime/ }),
    ).not.toBeInTheDocument();

    expect(within(dialog).getByText("Today:")).toBeInTheDocument();
    expect(
      within(dialog).getByText(
        "read verses 5–6, then type them with first letters.",
      ),
    ).toBeInTheDocument();
    expect(within(dialog).queryByText(/day \d of 3/i)).not.toBeInTheDocument();
    expect(
      within(dialog).getByRole("progressbar", {
        name: "4 of 11 verses learned",
      }),
    ).toHaveAttribute("aria-valuenow", "36");
    expect(
      within(dialog).getByText(/^Mastery starts once all 11 are learned/),
    ).toBeInTheDocument();

    expect(within(dialog).getAllByText("Memorized")).toHaveLength(4);
    expect(within(dialog).getAllByText("Learning today")).toHaveLength(2);
    expect(within(dialog).getAllByText("Up next")).toHaveLength(5);
    expect(
      within(dialog).getByText("Preserve me, O God, for in you I take refuge."),
    ).toHaveClass("font-serif", "truncate");
    expect(
      within(dialog).getAllByRole("img", { name: "Also hearted on its own" }),
    ).toHaveLength(1);
  });

  it("says which memorized verses came from before the passage", () => {
    passages = {
      psalm16x: passageView({
        pieces: [
          piece(0, 1, 4, "solid"),
          piece(1, 5, 6, "solid", { carriedOver: true }),
          piece(2, 7, 11, "unreached"),
        ],
      }),
    };
    renderHost("pack:psalm16x");
    const dialog = screen.getByRole("dialog", { name: "Psalm 16" });

    expect(within(dialog).getAllByText("Memorized")).toHaveLength(6);
    const suffixes = within(dialog).getAllByText("· from before");
    expect(suffixes).toHaveLength(2);
    expect(suffixes[0]?.parentElement).toHaveTextContent(
      "Memorized · from before",
    );
  });

  it("waits with Up next tomorrow once today's verses are in", () => {
    passages = {
      psalm16x: passageView({
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
    renderHost("pack:psalm16x");

    expect(
      screen.getByRole("button", { name: /^Up next tomorrow/ }),
    ).toBeDisabled();
    expect(screen.getAllByText("Learning")).toHaveLength(2);
  });

  it("reviews a memorized passage that is due", () => {
    passages = {
      psalm16x: passageView({
        status: "reviewing",
        pieces: [piece(0, 1, 11, "solid")],
        intervalDays: 6.6,
        dueAt: NOW - HOUR_MS,
      }),
    };
    renderHost("pack:psalm16x");

    expect(
      screen.getByRole("link", { name: "Review Psalm 16" }),
    ).toHaveAttribute(
      "href",
      "/memory/psalm16x/review?return=%2Fmemory%2Fpsalm16x",
    );
    expect(
      screen.getByRole("progressbar", {
        name: `Mastery ${Math.round(
          memoryProgressFraction("reviewing", 3, 0, 6.6, undefined, 2.5) * 100,
        )}%`,
      }),
    ).toBeInTheDocument();
  });

  it("confirms Stop memorizing, clears it and closes the drawer", async () => {
    renderHost("pack:psalm16x");

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
        expect.objectContaining({ id: "psalm16x" }),
      ),
    );
    await waitFor(() =>
      expect(mocks.navigate).toHaveBeenLastCalledWith({
        to: "/memory",
        search: {},
        replace: true,
      }),
    );
    expect(mocks.toastSuccess).toHaveBeenCalledWith(
      "Stopped memorizing Psalm 16.",
    );
  });
});

describe("PackDetail for a pack", () => {
  const RETURN = "return=%2Fmemory%2Fmercedxx";

  it("shows both bars and per-verse Review, Practice and Learn", () => {
    renderHost("pack:mercedxx", "verses");
    const dialog = screen.getByRole("dialog", { name: "Merced Team" });

    expect(
      within(dialog).getByText("Pack · 3 verses · added Sep 12"),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByRole("link", { name: "Continue · 2 verses today" }),
    ).toHaveAttribute("href", `/memory/today?packId=mercedxx&${RETURN}`);
    expect(
      within(dialog).getByRole("link", { name: "Practice anytime" }),
    ).toHaveAttribute("href", `/memory/mercedxx/practice?${RETURN}`);
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
      within(dialog).getByText(
        `Memorized · review due today · mastery ${Math.round(
          memoryProgressFraction("reviewing", 3, 0, 6.6, undefined, 2.5) * 100,
        )}%`,
      ),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByRole("link", { name: "Review Luke 9:23–24" }),
    ).toHaveAttribute(
      "href",
      `/memory/review?book=Luke&chapter=9&startVerse=23&endVerse=24&${RETURN}`,
    );
    expect(
      within(dialog).getByRole("link", { name: "Practice Luke 9:23–24" }),
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

  it("deletes a pack without stopping its verses, then goes back to Your verses", async () => {
    renderHost("pack:mercedxx", "verses");

    await userEvent.click(screen.getByRole("button", { name: "More actions" }));
    expect(
      screen.queryByRole("menuitem", { name: "Stop memorizing" }),
    ).not.toBeInTheDocument();
    await userEvent.click(
      await screen.findByRole("menuitem", { name: "Delete pack" }),
    );
    const confirm = await screen.findByRole("dialog", {
      name: "Delete Merced Team?",
    });
    expect(
      within(confirm).getByText(
        "Verses you've started stay in Memory with their progress. Ones you haven't started stay in your hearts.",
      ),
    ).toBeInTheDocument();
    await userEvent.click(
      within(confirm).getByRole("button", { name: "Delete pack" }),
    );

    await waitFor(() =>
      expect(mocks.mutations.get("packs.remove")).toHaveBeenCalledWith({
        id: "mercedxx",
      }),
    );
    expect(mocks.mutations.get("packs.stopMemorizing")).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(mocks.navigate).toHaveBeenLastCalledWith({
        href: "/memory?panel=verses",
        replace: true,
      }),
    );
  });

  it("offers Learn it as a passage for a legacy chapter pack", async () => {
    renderHost("pack:psalm23x");

    expect(
      screen.getByText(/Want to learn all of Psalm 23 in order\?/),
    ).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", { name: "Learn it as a passage" }),
    );
    expect(mocks.startPassage).toHaveBeenCalledTimes(1);
  });

  it("turns on Review together from the ⋯ menu and goes to recite", async () => {
    renderHost("pack:psalm23x");

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
      ).toHaveBeenCalledWith({ id: "psalm23x", enabled: true, now: NOW }),
    );
    await waitFor(() =>
      expect(mocks.navigate).toHaveBeenLastCalledWith({
        href: "/memory/psalm23x/review?return=%2Fmemory%2Fpsalm23x",
      }),
    );
  });

  it("says so when the pack is gone", () => {
    renderHost("pack:missing1");
    expect(
      screen.getByRole("dialog", { name: "Not found" }),
    ).toBeInTheDocument();
  });
});

describe("PackDetail on its full page", () => {
  it("shows Not found for a junk pack id without querying packs.get", () => {
    render(
      <TooltipProvider>
        <MemoryPanelPage
          panel={{ kind: "pack", packId: "xyz" }}
          from={undefined}
        />
      </TooltipProvider>,
    );

    expect(
      screen.getByRole("heading", { level: 1, name: "Not found" }),
    ).toBeInTheDocument();
    expect(mocks.queryCalls).toContainEqual(["packs.get", "skip"]);
    expect(
      mocks.queryCalls.filter(
        ([name, args]) => name === "packs.get" && args !== "skip",
      ),
    ).toHaveLength(0);
  });

  it("shows Not found for a document-shaped junk pack id without throwing", () => {
    render(
      <TooltipProvider>
        <MemoryPanelPage
          panel={{ kind: "pack", packId: "abcdefgh" }}
          from={undefined}
        />
      </TooltipProvider>,
    );

    expect(
      screen.getByRole("heading", { level: 1, name: "Not found" }),
    ).toBeInTheDocument();
    expect(mocks.queryCalls).toContainEqual(["packs.get", { id: "abcdefgh" }]);
    expect(mocks.queryCalls).toContainEqual([
      "packs.resolveMembers",
      expect.objectContaining({ id: "abcdefgh" }),
    ]);
    expect(mocks.queryCalls).toContainEqual([
      "passageMemory.getForPack",
      expect.objectContaining({ packId: "abcdefgh" }),
    ]);
    expect(mutation("packs.touch")).not.toHaveBeenCalled();
  });

  it("returns sessions to the page and links back to Your verses", () => {
    render(
      <TooltipProvider>
        <MemoryPanelPage
          panel={{ kind: "pack", packId: "mercedxx" }}
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
      "/memory/today?packId=mercedxx&return=%2Fmemory%2Fmercedxx%3Ffrom%3Dverses",
    );
    expect(
      screen.queryByRole("link", { name: "Open full page" }),
    ).not.toBeInTheDocument();
  });
});

describe("PackDetail editing a pack", () => {
  function rowNames() {
    return within(screen.getByRole("region", { name: "Verses" }))
      .getAllByRole("listitem")
      .map((item) => within(item).getAllByRole("link")[0]?.textContent);
  }

  it("renames from the pencil: Enter saves, Esc cancels", async () => {
    renderHost("pack:mercedxx");

    await userEvent.click(screen.getByRole("button", { name: "Rename" }));
    const field = screen.getByRole("textbox", { name: "Name" });
    expect(field).toHaveFocus();
    await userEvent.keyboard("{Escape}");
    expect(
      screen.getByRole("dialog", { name: "Merced Team" }),
    ).toBeInTheDocument();
    expect(mocks.mutations.get("packs.rename")).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole("button", { name: "Rename" }));
    await userEvent.clear(screen.getByRole("textbox", { name: "Name" }));
    await userEvent.type(
      screen.getByRole("textbox", { name: "Name" }),
      "Merced Crew{Enter}",
    );
    expect(mocks.mutations.get("packs.rename")).toHaveBeenCalledWith({
      id: "mercedxx",
      name: "Merced Crew",
    });
    await waitFor(() =>
      expect(mocks.toastSuccess).toHaveBeenCalledWith("Pack renamed"),
    );
  });

  it("does not save an empty name", async () => {
    renderHost("pack:mercedxx");

    await userEvent.click(screen.getByRole("button", { name: "Rename" }));
    await userEvent.clear(screen.getByRole("textbox", { name: "Name" }));
    await userEvent.keyboard("{Enter}");

    expect(mocks.mutations.get("packs.rename")).not.toHaveBeenCalled();
    expect(
      screen.getByRole("dialog", { name: "Merced Team" }),
    ).toBeInTheDocument();
  });

  it("moves verses with Move up / Move down and announces each move", async () => {
    // Like the server: the saved order is what resolveMembers returns next,
    // and each save finishes when the test says so.
    const saves: Array<() => void> = [];
    mocks.mutations.set(
      "packs.reorder",
      vi.fn(({ orderedVerseRefIds }: { orderedVerseRefIds: string[] }) => {
        membersByPack = {
          ...membersByPack,
          mercedxx: orderedVerseRefIds.map((id) =>
            MERCED_MEMBERS.find((member) => member.verseRefId === id),
          ),
        };
        return new Promise<null>((resolve) => saves.push(() => resolve(null)));
      }),
    );
    const host = () => (
      <TooltipProvider>
        <MemoryPanelHost panel="pack:mercedxx" from={undefined} />
      </TooltipProvider>
    );
    const view = render(host());
    expect(rowNames()).toEqual(["Luke 9:23–24", "Joshua 1:9", "Isaiah 41:10"]);

    await userEvent.click(
      screen.getByRole("button", { name: "Options for Luke 9:23–24" }),
    );
    expect(
      await screen.findByRole("menuitem", { name: "Move up" }),
    ).toHaveAttribute("data-disabled");
    await userEvent.click(screen.getByRole("menuitem", { name: "Move down" }));

    expect(rowNames()).toEqual(["Joshua 1:9", "Luke 9:23–24", "Isaiah 41:10"]);
    expect(mocks.mutations.get("packs.reorder")).toHaveBeenCalledWith({
      id: "mercedxx",
      orderedVerseRefIds: ["josh", "luke", "isa"],
    });
    expect(screen.getByRole("status")).toHaveTextContent(
      "Moved Luke 9:23–24 to 2 of 3.",
    );
    // The query pushes the saved order, then the save finishes.
    view.rerender(host());
    await act(async () => {
      saves.shift()?.();
      await Promise.resolve();
    });
    expect(rowNames()).toEqual(["Joshua 1:9", "Luke 9:23–24", "Isaiah 41:10"]);
    expect(mocks.toastSuccess).toHaveBeenCalledWith("New order saved", {
      id: "pack-order-mercedxx",
    });

    await userEvent.click(
      screen.getByRole("button", { name: "Options for Isaiah 41:10" }),
    );
    await userEvent.click(
      await screen.findByRole("menuitem", { name: "Move up" }),
    );
    expect(mocks.mutations.get("packs.reorder")).toHaveBeenLastCalledWith({
      id: "mercedxx",
      orderedVerseRefIds: ["josh", "isa", "luke"],
    });
    expect(screen.getByRole("status")).toHaveTextContent(
      "Moved Isaiah 41:10 to 2 of 3.",
    );
  });

  it("removes a verse with an Undo that puts it back at its old place", async () => {
    mutation("packs.removeVerse").mockResolvedValue(1);
    renderHost("pack:mercedxx");

    await userEvent.click(
      screen.getByRole("button", { name: "Remove Joshua 1:9" }),
    );
    expect(mocks.mutations.get("packs.removeVerse")).toHaveBeenCalledWith({
      id: "mercedxx",
      verseRefId: "josh",
    });
    await waitFor(() => expect(mocks.toast).toHaveBeenCalledTimes(1));
    const [message, options] = mocks.toast.mock.calls[0] as [
      string,
      { action: { label: string; onClick: () => void } },
    ];
    expect(message).toBe("Removed Joshua 1:9.");
    expect(options.action.label).toBe("Undo");

    options.action.onClick();
    expect(mocks.mutations.get("packs.restoreVerse")).toHaveBeenCalledWith({
      id: "mercedxx",
      verseRefId: "josh",
      order: 1,
    });
  });

  it("adds a verse by reference from the inline row, and Esc closes only the row", async () => {
    renderHost("pack:mercedxx");

    await userEvent.click(screen.getByRole("button", { name: "Add verses" }));
    const search = screen.getByRole("searchbox", {
      name: "Search by reference",
    });
    expect(search).toHaveFocus();
    expect(search).toHaveAttribute(
      "placeholder",
      "A reference like John 14:27",
    );

    await userEvent.type(search, "John 14:27");
    await userEvent.click(
      screen.getByRole("button", { name: "Add John 14:27" }),
    );
    expect(mocks.mutations.get("packs.addVerse")).toHaveBeenCalledWith({
      id: "mercedxx",
      book: "John",
      chapter: 14,
      startVerse: 27,
      endVerse: 27,
    });

    await userEvent.clear(search);
    await userEvent.type(search, "Joshua 1:9");
    expect(screen.getByText("Added")).toBeInTheDocument();

    await userEvent.keyboard("{Escape}");
    expect(
      screen.queryByRole("searchbox", { name: "Search by reference" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("dialog", { name: "Merced Team" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add verses" })).toHaveFocus();
  });

  it("offers Add verses on an empty pack", async () => {
    membersByPack = { ...membersByPack, mercedxx: [] };
    renderHost("pack:mercedxx");

    expect(
      screen.getByText(
        "No verses yet. Add verses from the reader with Memorize, or tap Add verses.",
      ),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Add verses" }));
    expect(
      screen.getByRole("searchbox", { name: "Search by reference" }),
    ).toBeInTheDocument();
  });

  it("leaves chapter packs and passages without add, remove or reorder", () => {
    renderHost("pack:psalm23x");
    expect(
      screen.queryByRole("button", { name: "Add verses" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /^Remove / }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Options for Psalm 23:1–3" }),
    ).toBeInTheDocument();
  });
});

async function openMenuItem(name: string, item: string | RegExp) {
  await userEvent.click(screen.getByRole("button", { name }));
  await userEvent.click(await screen.findByRole("menuitem", { name: item }));
}

describe("PackDetail Start over", () => {
  beforeEach(() => {
    localStorage.clear();
    mutation("passageMemory.startOver").mockResolvedValue({});
    mutation("verseMemory.startOver").mockResolvedValue({});
  });

  it("hides Start over on a whole pack and on a passage with nothing reached", async () => {
    const packView = renderHost("pack:mercedxx");
    await userEvent.click(screen.getByRole("button", { name: "More actions" }));
    expect(
      screen.queryByRole("menuitem", {
        name: new RegExp(START_OVER_MENU_LABEL),
      }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("menuitem", { name: "Delete pack" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("menuitem", { name: /Refresh/ }),
    ).not.toBeInTheDocument();
    packView.unmount();

    passages = {
      psalm16x: passageView({
        pieces: [
          piece(0, 1, 4, "unreached"),
          piece(1, 5, 6, "unreached"),
          piece(2, 7, 11, "unreached"),
        ],
      }),
    };
    renderHost("pack:psalm16x");
    await userEvent.click(screen.getByRole("button", { name: "More actions" }));
    expect(
      screen.queryByRole("menuitem", {
        name: new RegExp(START_OVER_MENU_LABEL),
      }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("menuitem", { name: "Stop memorizing" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Start · about 7 min" }),
    ).toBeInTheDocument();
  });

  it("asks to confirm a passage Start over with the follow-up line and resets every verse", async () => {
    renderHost("pack:psalm16x");
    await openMenuItem("More actions", new RegExp(START_OVER_MENU_LABEL));

    expect(
      await screen.findByRole("heading", { name: "Start Psalm 16 over?" }),
    ).toBeInTheDocument();
    expect(screen.getByText(startOverPassageBody(11))).toBeInTheDocument();
    expect(screen.queryByRole("radio")).not.toBeInTheDocument();
    expect(screen.queryByText(/shaky/i)).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Start over" }));
    expect(await screen.findByRole("status")).toHaveTextContent(
      STARTED_OVER_LABEL,
    );
    expect(mocks.mutations.get("passageMemory.startOver")).toHaveBeenCalledWith(
      expect.objectContaining({ packId: "psalm16x" }),
    );
    expect(mocks.mutations.get("verseMemory.startOver")).not.toHaveBeenCalled();
    expect(screen.queryByText("Undo")).not.toBeInTheDocument();
    expect(mocks.toast).not.toHaveBeenCalled();
    expect(mocks.toastSuccess).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole("button", { name: "More actions" }));
    expect(
      screen.queryByRole("menuitem", {
        name: new RegExp(START_OVER_MENU_LABEL),
      }),
    ).not.toBeInTheDocument();
    expect(
      screen.getAllByRole("link", {
        name: /^Continue · about 7 min$|^Start · about 7 min$/,
      }),
    ).toHaveLength(1);
  });

  it("keeps passage verse rows as chips with no menu", () => {
    renderHost("pack:psalm16x");
    expect(
      screen.queryByRole("button", { name: /^Options for/ }),
    ).not.toBeInTheDocument();
    expect(screen.getAllByText("Memorized").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Up next").length).toBeGreaterThan(0);
  });

  it("hides Start over on a custom row with no progress and on a preset row with none", async () => {
    renderHost("pack:mercedxx");
    await userEvent.click(
      screen.getByRole("button", { name: "Options for Isaiah 41:10" }),
    );
    expect(
      screen.getByRole("menuitem", { name: "Move up" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("menuitem", { name: "Remove" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("menuitem", {
        name: new RegExp(START_OVER_MENU_LABEL),
      }),
    ).not.toBeInTheDocument();

    membersByPack = {
      ...membersByPack,
      psalm23x: [
        member("p23a", {
          book: "Psalms",
          chapter: 23,
          startVerse: 1,
          endVerse: 3,
          status: "new",
          learnStage: 0,
          stageReps: 0,
          lastReviewedAt: undefined,
          dueAt: NOW,
          isDue: false,
        }),
      ],
    };
    renderHost("pack:psalm23x");
    expect(
      screen.queryByRole("button", { name: /^Options for/ }),
    ).not.toBeInTheDocument();
  });

  it("puts Start over in the custom row menu and as the only preset item", async () => {
    const custom = renderHost("pack:mercedxx");
    await userEvent.click(
      screen.getByRole("button", { name: "Options for Luke 9:23–24" }),
    );
    expect(
      screen.getByRole("menuitem", { name: "Move up" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("menuitem", { name: new RegExp(START_OVER_MENU_LABEL) }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("menuitem", { name: "Remove" }),
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole("button", { name: /^Options for Luke/ }),
    ).toHaveLength(1);
    custom.unmount();

    renderHost("pack:psalm23x");
    await userEvent.click(
      screen.getByRole("button", { name: "Options for Psalm 23:1–3" }),
    );
    expect(
      screen.getByRole("menuitem", { name: new RegExp(START_OVER_MENU_LABEL) }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("menuitem", { name: "Move up" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("menuitem", { name: "Remove" }),
    ).not.toBeInTheDocument();
  });

  it("asks to confirm a row Start over with the verse line and only resets that verse", async () => {
    renderHost("pack:mercedxx");
    await openMenuItem(
      "Options for Luke 9:23–24",
      new RegExp(START_OVER_MENU_LABEL),
    );
    expect(
      await screen.findByRole("heading", { name: "Start Luke 9:23–24 over?" }),
    ).toBeInTheDocument();
    expect(screen.getByText(START_OVER_CONFIRM_BODY)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Start over" }));
    expect(await screen.findByText(STARTED_OVER_LABEL)).toBeInTheDocument();
    expect(mocks.mutations.get("verseMemory.startOver")).toHaveBeenCalledWith(
      expect.objectContaining({ verseRefId: "luke" }),
    );
    expect(
      mocks.mutations.get("passageMemory.startOver"),
    ).not.toHaveBeenCalled();
    expect(
      screen.getByText("Learning · tomorrow: fill in the blanks"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Up next · starts when you're ready"),
    ).toBeInTheDocument();
    expect(screen.queryByText("Undo")).not.toBeInTheDocument();
  });

  it("keeps the row controls visible while Start over is open", async () => {
    renderHost("pack:mercedxx");
    const options = screen.getByRole("button", {
      name: "Options for Luke 9:23–24",
    });
    const remove = screen.getByRole("button", {
      name: "Remove Luke 9:23–24",
    });
    expect(options).not.toHaveAttribute("data-confirm-open");
    expect(remove).not.toHaveAttribute("data-confirm-open");

    await openMenuItem(
      "Options for Luke 9:23–24",
      new RegExp(START_OVER_MENU_LABEL),
    );
    expect(
      await screen.findByRole("heading", { name: "Start Luke 9:23–24 over?" }),
    ).toBeInTheDocument();
    expect(options).toHaveAttribute("data-confirm-open");
    expect(remove).toHaveAttribute("data-confirm-open");
    expect(options.className).toContain(
      "pointer-fine:data-[confirm-open]:opacity-100",
    );
    expect(remove.className).toContain(
      "pointer-fine:data-[confirm-open]:opacity-100",
    );
  });

  it("returns focus to the custom row menu after Start over", async () => {
    renderHost("pack:mercedxx");
    await openMenuItem(
      "Options for Luke 9:23–24",
      new RegExp(START_OVER_MENU_LABEL),
    );
    await userEvent.click(screen.getByRole("button", { name: "Start over" }));
    expect(await screen.findByText(STARTED_OVER_LABEL)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Options for Luke 9:23–24" }),
    ).toHaveFocus();
  });

  it("returns focus to Learn when a preset row loses its menu", async () => {
    membersByPack = {
      ...membersByPack,
      psalm23x: [
        member("p23a", {
          book: "Psalms",
          chapter: 23,
          startVerse: 1,
          endVerse: 3,
          status: "learning",
          learnStage: 2,
          stageReps: 1,
          lastReviewedAt: NOW - DAY_MS,
          dueAt: NOW,
          isDue: true,
        }),
      ],
    };
    renderHost("pack:psalm23x");
    await openMenuItem(
      "Options for Psalm 23:1–3",
      new RegExp(START_OVER_MENU_LABEL),
    );
    await userEvent.click(screen.getByRole("button", { name: "Start over" }));
    expect(await screen.findByText(STARTED_OVER_LABEL)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Options for Psalm 23:1–3" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Continue learning Psalm 23:1–3" }),
    ).toHaveFocus();
  });

  it("keeps the confirm open when Start over fails", async () => {
    mutation("passageMemory.startOver").mockRejectedValueOnce(
      new Error("offline"),
    );
    renderHost("pack:psalm16x");
    await openMenuItem("More actions", new RegExp(START_OVER_MENU_LABEL));
    await userEvent.click(screen.getByRole("button", { name: "Start over" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Couldn't start over. Try again.",
    );
    expect(
      screen.getByRole("heading", { name: "Start Psalm 16 over?" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("leaves a That's enough for today dismissal when Start over fails", async () => {
    const dayKey = learnDismissDayKey(Date.now());
    dismissLearnPackForToday("psalm16x", dayKey);
    mutation("passageMemory.startOver").mockRejectedValueOnce(
      new Error("offline"),
    );
    renderHost("pack:psalm16x");
    await openMenuItem("More actions", new RegExp(START_OVER_MENU_LABEL));
    await userEvent.click(screen.getByRole("button", { name: "Start over" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Couldn't start over. Try again.",
    );
    expect(readLearnPacksDismissedToday(dayKey).has("psalm16x")).toBe(true);
  });

  it("clears the That's enough for today dismissal after a passage reset", async () => {
    const dayKey = learnDismissDayKey(Date.now());
    dismissLearnPackForToday("psalm16x", dayKey);
    renderHost("pack:psalm16x");
    await openMenuItem("More actions", new RegExp(START_OVER_MENU_LABEL));
    await userEvent.click(screen.getByRole("button", { name: "Start over" }));
    expect(await screen.findByRole("status")).toHaveTextContent(
      STARTED_OVER_LABEL,
    );
    expect(readLearnPacksDismissedToday(dayKey).has("psalm16x")).toBe(false);
  });

  it("shows no row menus on an empty pack", () => {
    membersByPack = { ...membersByPack, mercedxx: [] };
    renderHost("pack:mercedxx");
    expect(
      screen.queryByRole("button", { name: /^Options for/ }),
    ).not.toBeInTheDocument();
  });
});

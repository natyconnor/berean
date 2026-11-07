import type { AnchorHTMLAttributes, ReactNode } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TooltipProvider } from "@/components/ui/tooltip";
import {
  REFRESH_MENU_LABEL,
  REFRESH_START_ERROR,
  START_OVER_CONFIRM_BODY,
  START_OVER_MENU_LABEL,
  STARTED_OVER_LABEL,
} from "@/lib/memory-copy";
import { DAY_MS } from "@/lib/memory-scheduler";

import { VerseMemoryMenu } from "./memory-restart-menu";
import { VerseDetailBody, type VerseDetailData } from "./verse-detail";

const NOW = Date.UTC(2026, 9, 12, 18, 0, 0);
const RETURN_TO = "/memory/verse/v1";

const mocks = vi.hoisted(() => ({
  openSheet: vi.fn(),
  navigate: vi.fn(),
  startOver: vi.fn(),
  stopMemorizing: vi.fn(),
  getPassage: vi.fn(),
}));

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => mocks.navigate,
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
  useMutation: (name: string) =>
    name === "verseMemory.startOver" ? mocks.startOver : mocks.stopMemorizing,
  useAction: () => mocks.getPassage,
}));

vi.mock("convex-helpers/react/cache", () => ({
  useQuery: () => undefined,
  usePaginatedQuery: () => ({
    results: [],
    status: "Exhausted",
    loadMore: () => {},
  }),
}));

vi.mock("../../../convex/_generated/api", () => ({
  api: {
    esv: { getPassage: "esv.getPassage" },
    packs: { listMine: "packs.listMine", addVerse: "packs.addVerse" },
    verseMemory: {
      verseDetail: "verseMemory.verseDetail",
      startOver: "verseMemory.startOver",
      stopMemorizing: "verseMemory.stopMemorizing",
    },
  },
}));

vi.mock("./memorize/memorize-context", () => ({
  useMemorizeSheet: () => ({ open: mocks.openSheet }),
}));

function detail(overrides: Partial<VerseDetailData> = {}): VerseDetailData {
  return {
    verseRefId: "v1" as VerseDetailData["verseRefId"],
    book: "Romans",
    chapter: 8,
    startVerse: 28,
    endVerse: 28,
    isHearted: true,
    heartedAt: NOW - 30 * DAY_MS,
    inMemory: true,
    isDue: false,
    status: "reviewing",
    learnStage: 3,
    stageReps: 0,
    ease: 2.5,
    intervalDays: 8,
    dueAt: NOW + 3 * DAY_MS,
    lapses: 0,
    consecutiveCorrect: 4,
    lastReviewedAt: NOW - 8 * DAY_MS,
    startedOverAt: undefined,
    attempts: [
      {
        quality: "exact",
        accuracy: 98,
        stage: 3,
        mode: "review",
        createdAt: NOW - 8 * DAY_MS,
      },
      {
        quality: "exact",
        accuracy: 94,
        stage: 3,
        mode: "learn",
        createdAt: NOW - 12 * DAY_MS,
      },
    ],
    difficulty: {
      attemptCount: 2,
      averageAccuracy: 96,
      worstAccuracy: 94,
      hardestStage: 3,
    },
    ...overrides,
  };
}

function renderBody(
  data: VerseDetailData,
  extras: { now?: number; timeZone?: string } = {},
) {
  return render(
    <TooltipProvider>
      <VerseDetailBody
        detail={data}
        now={extras.now ?? NOW}
        returnTo={RETURN_TO}
        timeZone={extras.timeZone ?? "UTC"}
      />
    </TooltipProvider>,
  );
}

const JARGON =
  /\b(Interval|Ease|Lapses|Stage journey|Difficulty|Hardest stage)\b/;

describe("VerseDetailBody", () => {
  beforeEach(() => {
    mocks.openSheet.mockReset();
    mocks.startOver.mockReset();
    mocks.stopMemorizing.mockReset();
    mocks.startOver.mockResolvedValue({});
    mocks.stopMemorizing.mockResolvedValue(null);
  });

  it("shows plain facts and no scheduler jargon", () => {
    const { container } = renderBody(detail());

    expect(container.textContent).not.toMatch(JARGON);
    expect(screen.getByText("Next review")).toBeInTheDocument();
    expect(screen.getByText("Thu, Oct 15")).toBeInTheDocument();
    expect(screen.getByText("Gap between reviews")).toBeInTheDocument();
    expect(screen.getByText("8 days")).toBeInTheDocument();
    expect(screen.queryByText("Times it slipped")).not.toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Your steps" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "How it's going" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Solid")).toBeInTheDocument();
  });

  it("shows slips once there are some", () => {
    renderBody(detail({ lapses: 2 }));
    expect(screen.getByText("Times it slipped")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("links Review and Practice with a return for a due verse", () => {
    renderBody(detail({ dueAt: NOW - 1000, isDue: true }));

    expect(screen.getByRole("link", { name: "Review" })).toHaveAttribute(
      "href",
      "/memory/review?book=Romans&chapter=8&startVerse=28&endVerse=28&return=%2Fmemory%2Fverse%2Fv1",
    );
    expect(screen.getByRole("link", { name: "Practice" })).toHaveAttribute(
      "href",
      "/memory/practice?book=Romans&chapter=8&startVerse=28&endVerse=28&return=%2Fmemory%2Fverse%2Fv1",
    );
    expect(
      screen.getByRole("button", { name: "Add to pack" }),
    ).toBeInTheDocument();
  });

  it("offers Continue learning while learning and nothing while today's step is done", () => {
    const { unmount } = renderBody(
      detail({
        status: "learning",
        learnStage: 2,
        intervalDays: 0,
        dueAt: NOW - 1000,
        lastReviewedAt: undefined,
        attempts: [],
        difficulty: null,
      }),
    );
    expect(
      screen.getByRole("link", { name: "Continue learning" }),
    ).toHaveAttribute(
      "href",
      "/memory/learn?book=Romans&chapter=8&startVerse=28&endVerse=28&return=%2Fmemory%2Fverse%2Fv1",
    );
    expect(screen.getAllByText("Fill in the blanks").length).toBeGreaterThan(0);
    expect(
      screen.getByText("This fills in after you practice it."),
    ).toBeInTheDocument();
    unmount();

    renderBody(
      detail({
        status: "learning",
        learnStage: 2,
        intervalDays: 0,
        dueAt: NOW + 12 * 60 * 60 * 1000,
        lastReviewedAt: NOW - 60_000,
      }),
    );
    expect(
      screen.queryByRole("link", { name: /learn/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText("Nice. Tomorrow you'll try it with blanks."),
    ).toBeInTheDocument();
  });

  it("names a same-day spring-forward lock Later today with the unlock time", () => {
    const now = new Date(2026, 2, 8, 0, 30).getTime();
    const dueAt = new Date(2026, 2, 8, 5, 57).getTime();
    renderBody(
      detail({
        status: "learning",
        learnStage: 2,
        intervalDays: 0,
        dueAt,
        lastReviewedAt: undefined,
        attempts: [],
        difficulty: null,
      }),
      { now, timeZone: "America/Los_Angeles" },
    );

    expect(
      screen.getByText("Nice. Later today you'll try it with blanks."),
    ).toBeInTheDocument();
    expect(screen.getByText("Later today")).toBeInTheDocument();
    const visible = screen.getByText("Learning · Later today");
    expect(visible).toHaveAttribute("title", "Unlocks at 5:57 AM");
    expect(visible).toHaveAttribute("aria-hidden", "true");
    expect(
      screen.getByText("Learning, unlocks later today at 5:57 AM"),
    ).toHaveClass("sr-only");
  });

  it("shows a try's accuracy and day when hovering the accuracy trend", () => {
    renderBody(detail());

    const chart = screen.getByRole("img", { name: /^Accuracy across/ });
    vi.spyOn(chart, "getBoundingClientRect").mockReturnValue({
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      bottom: 56,
      right: 280,
      width: 280,
      height: 56,
      toJSON: () => ({}),
    });

    fireEvent.pointerMove(chart, { clientX: 0, clientY: 20 });
    expect(screen.getByRole("tooltip")).toHaveTextContent("94%");
    expect(screen.getByRole("tooltip")).toHaveTextContent("Wed, Sep 30");

    fireEvent.pointerMove(chart, { clientX: 280, clientY: 20 });
    expect(screen.getByRole("tooltip")).toHaveTextContent("98%");
    expect(screen.getByRole("tooltip")).toHaveTextContent("Sun, Oct 4");

    fireEvent.pointerLeave(chart);
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("steps through tries with the arrow keys once the trend has focus", async () => {
    renderBody(detail());

    const chart = screen.getByRole("img", { name: /^Accuracy across/ });
    act(() => chart.focus());
    expect(chart).toHaveFocus();
    expect(screen.getByRole("tooltip")).toHaveTextContent("98%");
    expect(chart).toHaveAccessibleDescription(/98%\s*Sun, Oct 4/);

    await userEvent.keyboard("{ArrowLeft}");
    expect(screen.getByRole("tooltip")).toHaveTextContent("94%");
    expect(screen.getByText("94%, Wed, Sep 30")).toBeInTheDocument();

    await userEvent.keyboard("{End}");
    expect(screen.getByRole("tooltip")).toHaveTextContent("98%");

    act(() => chart.blur());
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("counts How it's going only from the reset", () => {
    renderBody(
      detail({
        startedOverAt: NOW - DAY_MS,
        attempts: [
          {
            quality: "exact",
            accuracy: 98,
            stage: 3,
            mode: "review",
            createdAt: NOW - 8 * DAY_MS,
          },
          {
            quality: "exact",
            accuracy: 94,
            stage: 3,
            mode: "learn",
            createdAt: NOW - 12 * DAY_MS,
          },
        ],
      }),
    );

    expect(
      screen.getByText("This fills in after you practice it."),
    ).toBeInTheDocument();
    expect(screen.queryByText("Solid")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("img", { name: /^Accuracy across/ }),
    ).not.toBeInTheDocument();
  });

  it("offers Memorize again for a verse no longer in Memory", async () => {
    renderBody(detail({ inMemory: false }));

    await userEvent.click(
      screen.getByRole("button", { name: "Memorize Romans 8:28" }),
    );
    expect(mocks.openSheet).toHaveBeenCalledWith({
      kind: "spans",
      spans: [{ book: "Romans", chapter: 8, startVerse: 28, endVerse: 28 }],
    });
  });
});

function renderMenu(
  overrides: Partial<Parameters<typeof VerseMemoryMenu>[0]> = {},
) {
  return render(
    <VerseMemoryMenu
      verseRefId={"v1" as VerseDetailData["verseRefId"]}
      reference="Romans 8:28"
      verse={{ book: "Romans", chapter: 8, startVerse: 28, endVerse: 28 }}
      status="reviewing"
      dueAt={Date.now() + 3 * DAY_MS}
      learnStage={3}
      stageReps={0}
      lastReviewedAt={NOW - 8 * DAY_MS}
      returnTo={RETURN_TO}
      onStopped={() => {}}
      {...overrides}
    />,
  );
}

async function openStartOverConfirm() {
  await userEvent.click(screen.getByRole("button", { name: "More actions" }));
  await userEvent.click(
    await screen.findByRole("menuitem", {
      name: new RegExp(START_OVER_MENU_LABEL),
    }),
  );
}

describe("VerseMemoryMenu", () => {
  beforeEach(() => {
    mocks.startOver.mockReset();
    mocks.stopMemorizing.mockReset();
    mocks.startOver.mockResolvedValue({});
    mocks.stopMemorizing.mockResolvedValue(null);
  });

  it("hides Start over on a New verse with nothing done", async () => {
    renderMenu({
      status: "new",
      learnStage: 0,
      stageReps: 0,
      lastReviewedAt: undefined,
    });
    await userEvent.click(screen.getByRole("button", { name: "More actions" }));
    expect(
      screen.queryByRole("menuitem", {
        name: new RegExp(START_OVER_MENU_LABEL),
      }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("menuitem", { name: "Stop memorizing" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("separator")).not.toBeInTheDocument();
  });

  it("shows Start over after real progress or when Memorized", async () => {
    const { unmount } = renderMenu({
      status: "learning",
      learnStage: 2,
      lastReviewedAt: undefined,
    });
    await userEvent.click(screen.getByRole("button", { name: "More actions" }));
    expect(
      screen.getByRole("menuitem", { name: new RegExp(START_OVER_MENU_LABEL) }),
    ).toBeInTheDocument();
    expect(screen.getByRole("separator")).toBeInTheDocument();
    unmount();

    renderMenu({ status: "reviewing", learnStage: 3 });
    await userEvent.click(screen.getByRole("button", { name: "More actions" }));
    expect(
      screen.getByRole("menuitem", { name: new RegExp(START_OVER_MENU_LABEL) }),
    ).toBeInTheDocument();
  });

  it("asks to confirm with the follow-up wording", async () => {
    renderMenu();
    await openStartOverConfirm();
    expect(
      await screen.findByRole("heading", { name: "Start Romans 8:28 over?" }),
    ).toBeInTheDocument();
    expect(screen.getByText(START_OVER_CONFIRM_BODY)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Start over" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
  });

  it("shows Started over. after confirm and hides the item", async () => {
    renderMenu();
    await openStartOverConfirm();
    await userEvent.click(screen.getByRole("button", { name: "Start over" }));
    expect(await screen.findByRole("status")).toHaveTextContent(
      STARTED_OVER_LABEL,
    );
    expect(screen.queryByText("Undo")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "More actions" }));
    expect(
      screen.queryByRole("menuitem", {
        name: new RegExp(START_OVER_MENU_LABEL),
      }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("menuitem", { name: "Stop memorizing" }),
    ).toBeInTheDocument();
  });

  it("keeps the confirm open and shows the error when Start over fails", async () => {
    mocks.startOver.mockRejectedValueOnce(new Error("offline"));
    renderMenu();
    await openStartOverConfirm();
    await userEvent.click(screen.getByRole("button", { name: "Start over" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Couldn't start over. Try again.",
    );
    expect(
      screen.getByRole("heading", { name: "Start Romans 8:28 over?" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});

const ROMANS_8 = {
  canonical: "Romans 8",
  copyright: "ESV",
  verses: [{ number: 28, text: "And we know that for those who love God" }],
};

async function openMenu() {
  await userEvent.click(screen.getByRole("button", { name: "More actions" }));
  await screen.findByRole("menuitem", { name: "Stop memorizing" });
}

function navigatedHref(): URL {
  const [arg] = mocks.navigate.mock.calls[0] as [{ href: string }];
  return new URL(arg.href, "https://app.test");
}

function refreshItem() {
  return screen.queryByRole("menuitem", { name: REFRESH_MENU_LABEL });
}

describe("VerseMemoryMenu Refresh", () => {
  beforeEach(() => {
    sessionStorage.clear();
    mocks.startOver.mockClear();
    mocks.navigate.mockReset();
    mocks.navigate.mockResolvedValue(undefined);
    mocks.getPassage.mockReset();
    mocks.getPassage.mockResolvedValue(ROMANS_8);
  });

  it.each([
    ["New", { status: "new", learnStage: 0, lastReviewedAt: undefined }],
    [
      "Learning with real progress",
      { status: "learning", learnStage: 2, lastReviewedAt: undefined },
    ],
  ] as const)("hides Refresh on a %s verse", async (_, overrides) => {
    renderMenu(overrides);
    await openMenu();
    expect(refreshItem()).not.toBeInTheDocument();
  });

  it.each(["reviewing", "mastered"] as const)(
    "shows Refresh above Start over on a %s verse",
    async (status) => {
      renderMenu({ status });
      await openMenu();
      const items = screen
        .getAllByRole("menuitem")
        .map((item) => item.textContent);
      expect(items[0]).toBe(REFRESH_MENU_LABEL);
      expect(items[1]).toContain(START_OVER_MENU_LABEL);
      expect(refreshItem()).not.toHaveAttribute("aria-disabled");
    },
  );

  it("opens a not-due verse's refresher in Practice, returning here", async () => {
    renderMenu({ dueAt: Date.now() + 3 * DAY_MS });
    await openMenu();
    await userEvent.click(refreshItem()!);
    await vi.waitFor(() => expect(mocks.navigate).toHaveBeenCalledTimes(1));
    const href = navigatedHref();
    expect(href.pathname).toBe("/memory/practice");
    expect(href.searchParams.get("refresh")).toBe("1");
    expect(href.searchParams.get("book")).toBe("Romans");
    expect(href.searchParams.get("startVerse")).toBe("28");
    expect(href.searchParams.get("return")).toBe(RETURN_TO);
  });

  it("opens a due verse's refresher in Review", async () => {
    renderMenu({ dueAt: Date.now() - DAY_MS });
    await openMenu();
    await userEvent.click(refreshItem()!);
    await vi.waitFor(() => expect(mocks.navigate).toHaveBeenCalledTimes(1));
    const href = navigatedHref();
    expect(href.pathname).toBe("/memory/review");
    expect(href.searchParams.get("refresh")).toBe("1");
    expect(href.searchParams.get("return")).toBe(RETURN_TO);
  });

  it("shows the error in place when the refresher can't start, then retries", async () => {
    mocks.getPassage.mockRejectedValueOnce(new Error("offline"));
    renderMenu();
    await openMenu();
    await userEvent.click(refreshItem()!);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      REFRESH_START_ERROR,
    );
    expect(mocks.navigate).not.toHaveBeenCalled();
    expect(mocks.startOver).not.toHaveBeenCalled();

    await openMenu();
    await userEvent.click(refreshItem()!);
    await vi.waitFor(() => expect(mocks.navigate).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
